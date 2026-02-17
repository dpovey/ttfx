/**
 * Labeled Block Comprehension Macros
 *
 * Provides two complementary comprehension forms using labeled statements:
 *
 * ## `let: yield` — Monadic (sequential) comprehension
 *
 * ```typescript
 * let: {
 *   user << fetchUser(id)          // monadic bind (flatMap/then)
 *   name = user.name.toUpperCase() // pure map (no effect)
 *   _ << log(name)                 // bind, discard result
 *   posts << fetchPosts(user.id) || fetchCachedPosts(user.id)  // bind with orElse fallback
 *   if (posts.length > 0) {}       // guard/filter
 * }
 * yield: { ({ user, name, posts }) }
 * ```
 *
 * Statement types inside `let:` block:
 *
 *   `name << expr`        — Monadic bind. Calls .flatMap() (or .then() for Promises).
 *   `_ << expr`           — Monadic bind, discard result. Runs effect for side effects.
 *   `name = expr`         — Pure map. Computes a value without unwrapping an effect.
 *   `name << expr || alt` — Bind with orElse fallback. Calls .orElse(() => alt) on failure.
 *   `if (cond) {}`        — Guard/filter. Short-circuits if condition is false.
 *
 * The `yield:` (or `pure:`) block provides the final return expression.
 * If omitted, the last binding's result is returned directly.
 *
 * Promise support: When the first monadic expression is a Promise/thenable
 * (detected via the type checker), `.then()` is emitted instead of `.flatMap()`.
 *
 * ## `par: yield` — Applicative (parallel/independent) comprehension
 *
 * ```typescript
 * par: {
 *   user   << fetchUser(id)
 *   posts  << fetchPosts(postId)
 *   config << loadConfig()
 * }
 * yield: { ({ user, posts, config }) }
 * ```
 *
 * All bindings in a `par:` block must be independent — no binding may reference
 * a previous binding's name. The macro enforces this and reports an error if
 * a dependency is detected.
 *
 * Statement types inside `par:` block:
 *
 *   `name << expr`        — Independent effect. Extracted via applicative combination.
 *   `name = expr`         — Pure computation (must not reference other bindings).
 *
 * Guards (`if`) and orElse (`||`) are not supported in `par:` blocks.
 *
 * Transforms to:
 *   - Standard types: `first.map(a => b => c => yield).ap(second).ap(third)`
 *   - Promises: `Promise.all([first, second, third]).then(([a, b, c]) => yield)`
 */

import * as ts from "typescript";
import {
  defineLabeledBlockMacro,
  globalRegistry,
} from "../../core/registry.js";
import type { MacroContext } from "../../core/types.js";

// ============================================================================
// Comprehension typeclass — maps types to their chaining method names
// ============================================================================

/**
 * Describes how a monadic/applicative type chains operations in comprehensions.
 *
 * Instead of hardcoding `.flatMap()` / `.map()` / `.then()`, the comprehension
 * macro resolves method names from this registry. This makes `let:` and `par:`
 * work with any type that registers a ComprehensionInstance.
 *
 * Built-in instances are provided for:
 *   - Promise (bind: "then", map: "then", pure: "Promise.resolve", empty: "Promise.reject")
 *   - Standard monads (bind: "flatMap", map: "map") — the default fallback
 *
 * Users can register custom instances for their own types:
 *   registerComprehensionInstance("IO", {
 *     bind: "chain",
 *     map: "map",
 *     pure: "IO.of",
 *     empty: "IO.fail",
 *     orElse: "catchError",
 *     ap: "ap",
 *   });
 */
export interface ComprehensionInstance {
  /** Method name for monadic bind (e.g., "flatMap", "then", "chain") */
  bind: string;
  /** Method name for functor map (e.g., "map", "then") */
  map: string;
  /** Expression for lifting a pure value (e.g., "Promise.resolve", "Option.some") */
  pure?: string;
  /** Expression for the empty/zero value used in guards (e.g., "Promise.reject(...)") */
  empty?: string;
  /** Method name for error recovery/fallback (e.g., "orElse", "catch") */
  orElse?: string;
  /** Method name for applicative apply (e.g., "ap") — used by par: */
  ap?: string;
  /** Whether this type uses Promise.all for parallel composition */
  usePromiseAll?: boolean;
}

/** Registry of comprehension instances keyed by type name */
const comprehensionRegistry = new Map<string, ComprehensionInstance>();

/** Default instance for standard monads with .flatMap()/.map() */
const defaultComprehensionInstance: ComprehensionInstance = {
  bind: "flatMap",
  map: "map",
  orElse: "orElse",
  ap: "ap",
};

/** Built-in Promise instance */
const promiseComprehensionInstance: ComprehensionInstance = {
  bind: "then",
  map: "then",
  pure: "Promise.resolve",
  empty: 'Promise.reject(new Error("guard failed"))',
  orElse: "catch",
  ap: undefined,
  usePromiseAll: true,
};

// Register built-in instances
comprehensionRegistry.set("Promise", promiseComprehensionInstance);

// Option/Maybe types (fp-ts, Effect, custom)
comprehensionRegistry.set("Option", {
  bind: "flatMap",
  map: "map",
  pure: "Option.some",
  empty: "Option.none()",
  orElse: "orElse",
  ap: "ap",
});

// Either types
comprehensionRegistry.set("Either", {
  bind: "flatMap",
  map: "map",
  pure: "Either.right",
  empty: "Either.left(undefined)",
  orElse: "orElse",
  ap: "ap",
});

// Effect ecosystem
comprehensionRegistry.set("Effect", {
  bind: "flatMap",
  map: "map",
  pure: "Effect.succeed",
  empty: "Effect.fail(undefined)",
  orElse: "catchAll",
  ap: "ap",
});

// IO/Task types
comprehensionRegistry.set("IO", {
  bind: "chain",
  map: "map",
  pure: "IO.of",
  empty: "IO.fail(undefined)",
  orElse: "catchError",
  ap: "ap",
});

// Array (list monad)
comprehensionRegistry.set("Array", {
  bind: "flatMap",
  map: "map",
  pure: undefined, // Array.of or [value]
  empty: undefined, // []
  ap: undefined,
});

/**
 * Register a comprehension instance for a type.
 * This tells the `let:` and `par:` macros how to chain operations on this type.
 */
export function registerComprehensionInstance(
  typeName: string,
  instance: ComprehensionInstance,
): void {
  comprehensionRegistry.set(typeName, instance);
}

/**
 * Look up a comprehension instance for a type.
 * Returns the registered instance, or undefined if not found.
 */
export function getComprehensionInstance(
  typeName: string,
): ComprehensionInstance | undefined {
  return comprehensionRegistry.get(typeName);
}

/**
 * Get all registered comprehension instances (for documentation/debugging).
 */
export function getAllComprehensionInstances(): Map<
  string,
  ComprehensionInstance
> {
  return new Map(comprehensionRegistry);
}

// ============================================================================
// Comprehension step types
// ============================================================================

/** Monadic bind: `name << expr` */
interface BindStep {
  kind: "bind";
  name: string;
  expression: ts.Expression;
  /** If present, the orElse fallback expression (from `<< expr || fallback`) */
  orElse?: ts.Expression;
  node: ts.Node;
}

/** Pure map: `name = expr` */
interface MapStep {
  kind: "map";
  name: string;
  expression: ts.Expression;
  node: ts.Node;
}

/** Guard/filter: `if (cond) {}` */
interface GuardStep {
  kind: "guard";
  condition: ts.Expression;
  node: ts.Node;
}

type ComprehensionStep = BindStep | MapStep | GuardStep;

// ============================================================================
// Step extraction
// ============================================================================

/**
 * Extract comprehension steps from the body of a `let:` block.
 */
function extractSteps(
  ctx: MacroContext,
  block: ts.Block,
): ComprehensionStep[] | undefined {
  const steps: ComprehensionStep[] = [];

  for (const stmt of block.statements) {
    // Guard: if (condition) {}
    if (ts.isIfStatement(stmt)) {
      steps.push({
        kind: "guard",
        condition: stmt.expression,
        node: stmt,
      });
      continue;
    }

    if (!ts.isExpressionStatement(stmt)) {
      ctx.reportError(
        stmt,
        "let: block statements must be `name << expr`, `name = expr`, or `if (cond) {}`",
      );
      return undefined;
    }

    const expr = stmt.expression;

    if (!ts.isBinaryExpression(expr)) {
      ctx.reportError(
        stmt,
        "Expected `name << expression` or `name = expression`",
      );
      return undefined;
    }

    const opKind = expr.operatorToken.kind;

    // Pure map: name = expr
    if (opKind === ts.SyntaxKind.FirstAssignment) {
      if (!ts.isIdentifier(expr.left)) {
        ctx.reportError(expr.left, "Left side of = must be an identifier");
        return undefined;
      }
      steps.push({
        kind: "map",
        name: expr.left.text,
        expression: expr.right,
        node: stmt,
      });
      continue;
    }

    // Monadic bind: name << expr  or  name << expr || fallback
    // Due to operator precedence, `name << expr || fallback` parses as
    // (name << expr) || fallback — a BinaryExpression with || at the top.
    if (opKind === ts.SyntaxKind.BarBarToken) {
      // Check if left side is a << expression
      const lhs = expr.left;
      if (
        ts.isBinaryExpression(lhs) &&
        lhs.operatorToken.kind === ts.SyntaxKind.LessThanLessThanToken &&
        ts.isIdentifier(lhs.left)
      ) {
        steps.push({
          kind: "bind",
          name: lhs.left.text,
          expression: lhs.right,
          orElse: expr.right,
          node: stmt,
        });
        continue;
      }
    }

    // Same for ?? (nullish coalescing) — treat as orElse too
    if (opKind === ts.SyntaxKind.QuestionQuestionToken) {
      const lhs = expr.left;
      if (
        ts.isBinaryExpression(lhs) &&
        lhs.operatorToken.kind === ts.SyntaxKind.LessThanLessThanToken &&
        ts.isIdentifier(lhs.left)
      ) {
        steps.push({
          kind: "bind",
          name: lhs.left.text,
          expression: lhs.right,
          orElse: expr.right,
          node: stmt,
        });
        continue;
      }
    }

    // Plain bind: name << expr
    if (opKind === ts.SyntaxKind.LessThanLessThanToken) {
      if (!ts.isIdentifier(expr.left)) {
        ctx.reportError(
          expr.left,
          "Left side of << must be an identifier (variable name or _)",
        );
        return undefined;
      }
      steps.push({
        kind: "bind",
        name: expr.left.text,
        expression: expr.right,
        node: stmt,
      });
      continue;
    }

    ctx.reportError(
      stmt,
      "Expected `name << expression`, `name = expression`, or `if (cond) {}`",
    );
    return undefined;
  }

  return steps;
}

/**
 * Extract the return expression from a `yield:` or `pure:` block.
 * The block should contain exactly one expression statement.
 */
function extractReturnExpr(
  ctx: MacroContext,
  block: ts.Block,
): ts.Expression | undefined {
  if (block.statements.length !== 1) {
    ctx.reportError(
      block,
      "yield:/pure: block must contain exactly one expression",
    );
    return undefined;
  }

  const stmt = block.statements[0];
  if (!ts.isExpressionStatement(stmt)) {
    ctx.reportError(stmt, "yield:/pure: block must contain an expression");
    return undefined;
  }

  return stmt.expression;
}

// ============================================================================
// Type-aware method resolution (Comprehension typeclass)
// ============================================================================

/**
 * Check if a type is Promise-like (has a .then() method but no .flatMap()).
 * Uses the type checker when available, falls back to structural check.
 */
function isPromiseLike(ctx: MacroContext, expr: ts.Expression): boolean {
  try {
    const type = ctx.typeChecker.getTypeAtLocation(expr);
    const hasThen = type.getProperty("then") !== undefined;
    const hasFlatMap = type.getProperty("flatMap") !== undefined;
    // It's Promise-like if it has .then() but not .flatMap()
    return hasThen && !hasFlatMap;
  } catch {
    return false;
  }
}

/**
 * Try to extract the type name from an expression for comprehension instance lookup.
 * Looks at the return type of the expression and extracts the outer type constructor name.
 * E.g., for `fetchUser(id)` returning `Option<User>`, extracts "Option".
 */
function extractTypeName(
  ctx: MacroContext,
  expr: ts.Expression,
): string | undefined {
  try {
    const type = ctx.typeChecker.getTypeAtLocation(expr);
    const typeStr = ctx.typeChecker.typeToString(type);

    // Extract the outer type constructor name from "TypeName<...>"
    const match = typeStr.match(/^(\w+)\s*</);
    if (match) return match[1];

    // Check symbol name
    const symbol = type.getSymbol();
    if (symbol) return symbol.getName();

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the comprehension instance for the first bind expression.
 *
 * Resolution order:
 *   1. Extract type name from the expression and look up in comprehension registry
 *   2. Check if the type is Promise-like (structural check)
 *   3. Fall back to default instance (flatMap/map)
 *
 * This is the core of the typeclass-driven comprehension system. Instead of
 * hardcoding `.flatMap()` and `.then()`, the macro resolves method names from
 * registered ComprehensionInstances.
 */
function resolveComprehensionInstance(
  ctx: MacroContext,
  steps: ComprehensionStep[],
): ComprehensionInstance {
  const firstBind = steps.find((s): s is BindStep => s.kind === "bind");
  if (!firstBind) return defaultComprehensionInstance;

  // 1. Try to resolve from the comprehension registry by type name
  const typeName = extractTypeName(ctx, firstBind.expression);
  if (typeName) {
    const instance = comprehensionRegistry.get(typeName);
    if (instance) return instance;
  }

  // 2. Structural check for Promise-like types
  if (isPromiseLike(ctx, firstBind.expression)) {
    return promiseComprehensionInstance;
  }

  // 3. Default: standard monad with .flatMap()/.map()
  return defaultComprehensionInstance;
}

/**
 * Determine the chaining method names based on the first monadic expression.
 *
 * This is the backward-compatible wrapper that returns the simple { bind, map }
 * object used by the chain builder. It delegates to resolveComprehensionInstance
 * for the actual resolution.
 */
function resolveMethodNames(
  ctx: MacroContext,
  steps: ComprehensionStep[],
): { bind: string; map: string } {
  const instance = resolveComprehensionInstance(ctx, steps);
  return { bind: instance.bind, map: instance.map };
}

// ============================================================================
// Chain builder
// ============================================================================

/**
 * Build the comprehension chain from steps and a return expression.
 *
 * Handles:
 *   - bind steps → .flatMap(name => ...) or .then(name => ...)
 *   - map steps → inlined as a const in the next arrow body
 *   - guard steps → .filter(pred) or ternary short-circuit
 *   - orElse → .orElse(() => fallback) wrapping the bind expression
 */
function buildChain(
  ctx: MacroContext,
  steps: ComprehensionStep[],
  returnExpr: ts.Expression,
  methods: { bind: string; map: string },
): ts.Expression {
  const factory = ctx.factory;

  if (steps.length === 0) {
    return returnExpr;
  }

  // We build from inside out. Start with the return expression and wrap
  // each step around it, going from the last step to the first.

  let inner: ts.Expression = returnExpr;

  // Process steps from last to first
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    const isLast = i === steps.length - 1;
    // For the last bind step, use .map(); for all others, use .flatMap()
    // (unless the inner expression is already a chain, in which case .flatMap())

    switch (step.kind) {
      case "bind": {
        // Determine method: last bind before return uses map, others use flatMap
        const isLastBind = !steps.slice(i + 1).some((s) => s.kind === "bind");
        const method = isLastBind ? methods.map : methods.bind;

        let effectExpr = step.expression;

        // Wrap with orElse if present
        if (step.orElse) {
          effectExpr = factory.createCallExpression(
            factory.createPropertyAccessExpression(effectExpr, "orElse"),
            undefined,
            [
              factory.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                step.orElse,
              ),
            ],
          );
        }

        inner = factory.createCallExpression(
          factory.createPropertyAccessExpression(effectExpr, method),
          undefined,
          [
            factory.createArrowFunction(
              undefined,
              undefined,
              [
                factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  factory.createIdentifier(step.name),
                ),
              ],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              inner,
            ),
          ],
        );
        break;
      }

      case "map": {
        // Pure map step: wrap inner in an IIFE that binds the computed value.
        // ((name) => inner)(expr)
        // This is cleaner than a block + const declaration because it stays
        // as a single expression.
        inner = factory.createCallExpression(
          factory.createParenthesizedExpression(
            factory.createArrowFunction(
              undefined,
              undefined,
              [
                factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  factory.createIdentifier(step.name),
                ),
              ],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              inner,
            ),
          ),
          undefined,
          [step.expression],
        );
        break;
      }

      case "guard": {
        // Guard step: we need a monadic "empty" to short-circuit.
        // For now, generate a ternary: cond ? inner : <empty>
        // The "empty" depends on the monad — we'll use a convention:
        // If the type has .empty(), use it. Otherwise use undefined.
        // TODO: Use typeclass to resolve the empty/zero value.
        //
        // For now, we wrap the remaining chain in a conditional:
        //   cond ? (rest of chain) : monad.empty()
        //
        // Since we don't know the monad type at this point in the
        // inside-out build, we emit a filter-style approach:
        // The previous bind's expression gets .filter() if available.
        // As a fallback, emit a ternary that throws.
        //
        // Simplest correct approach: emit the guard as a ternary
        // wrapping the inner expression. The caller must ensure the
        // types work out.
        inner = factory.createConditionalExpression(
          step.condition,
          factory.createToken(ts.SyntaxKind.QuestionToken),
          inner,
          factory.createToken(ts.SyntaxKind.ColonToken),
          // Fallback: call a hypothetical .empty() or return undefined
          // For now, use undefined — the typeclass TODO will fix this properly
          factory.createIdentifier("undefined"),
        );
        break;
      }
    }
  }

  return inner;
}

// ============================================================================
// The Macro
// ============================================================================

export const letBlockMacro = defineLabeledBlockMacro({
  name: "let-block-comprehension",
  label: "let",
  description:
    "Monadic do-notation using labeled blocks: `let: { f << expr } yield: { f }`",
  continuationLabels: ["yield", "pure"],

  expand(
    ctx: MacroContext,
    mainBlock: ts.LabeledStatement,
    continuation: ts.LabeledStatement | undefined,
  ): ts.Statement | ts.Statement[] {
    const factory = ctx.factory;

    // The main block must be a Block
    if (!ts.isBlock(mainBlock.statement)) {
      ctx.reportError(mainBlock, "let: must be followed by a block { ... }");
      return mainBlock;
    }

    // Extract steps
    const steps = extractSteps(ctx, mainBlock.statement);
    if (!steps || steps.length === 0) {
      ctx.reportError(
        mainBlock,
        "let: block must contain at least one binding or guard",
      );
      return mainBlock;
    }

    // Must have at least one bind step
    const hasBindStep = steps.some((s) => s.kind === "bind");
    if (!hasBindStep) {
      ctx.reportError(
        mainBlock,
        "let: block must contain at least one `name << expression` binding",
      );
      return mainBlock;
    }

    // Resolve method names (flatMap/map vs then/then)
    const methods = resolveMethodNames(ctx, steps);

    // Extract return expression from continuation, or default to last binding
    let returnExpr: ts.Expression;
    if (continuation) {
      if (!ts.isBlock(continuation.statement)) {
        ctx.reportError(
          continuation,
          `${continuation.label.text}: must be followed by a block { ... }`,
        );
        return mainBlock;
      }

      const extracted = extractReturnExpr(ctx, continuation.statement);
      if (!extracted) {
        return mainBlock;
      }
      returnExpr = extracted;
    } else {
      // No yield/pure block — return the last bind step's result directly.
      const lastBind = [...steps]
        .reverse()
        .find((s): s is BindStep => s.kind === "bind");
      if (!lastBind) {
        ctx.reportError(mainBlock, "No bind step found for implicit return");
        return mainBlock;
      }

      // Remove the last bind from steps and use its expression as the tail
      const stepsWithoutLast = steps.slice(0, steps.lastIndexOf(lastBind));
      const chain = buildChain(
        ctx,
        stepsWithoutLast,
        lastBind.expression,
        methods,
      );
      return factory.createExpressionStatement(chain);
    }

    // Build the chain
    const chain = buildChain(ctx, steps, returnExpr, methods);

    return factory.createExpressionStatement(chain);
  },
});

// Register the macro
globalRegistry.register(letBlockMacro);

// ============================================================================
// Applicative (par:) comprehension
// ============================================================================

/**
 * Extract only bind and map steps from a `par:` block.
 * Guards and orElse are not supported in applicative context.
 */
function extractParSteps(
  ctx: MacroContext,
  block: ts.Block,
): (BindStep | MapStep)[] | undefined {
  const steps: (BindStep | MapStep)[] = [];

  for (const stmt of block.statements) {
    if (ts.isIfStatement(stmt)) {
      ctx.reportError(
        stmt,
        "par: blocks do not support guards (if). Use let: for monadic comprehensions with guards.",
      );
      return undefined;
    }

    if (!ts.isExpressionStatement(stmt)) {
      ctx.reportError(
        stmt,
        "par: block statements must be `name << expr` or `name = expr`",
      );
      return undefined;
    }

    const expr = stmt.expression;

    if (!ts.isBinaryExpression(expr)) {
      ctx.reportError(
        stmt,
        "Expected `name << expression` or `name = expression`",
      );
      return undefined;
    }

    const opKind = expr.operatorToken.kind;

    // Pure map: name = expr
    if (opKind === ts.SyntaxKind.FirstAssignment) {
      if (!ts.isIdentifier(expr.left)) {
        ctx.reportError(expr.left, "Left side of = must be an identifier");
        return undefined;
      }
      steps.push({
        kind: "map",
        name: expr.left.text,
        expression: expr.right,
        node: stmt,
      });
      continue;
    }

    // Reject orElse (||, ??) in par: blocks
    if (
      opKind === ts.SyntaxKind.BarBarToken ||
      opKind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      const lhs = expr.left;
      if (
        ts.isBinaryExpression(lhs) &&
        lhs.operatorToken.kind === ts.SyntaxKind.LessThanLessThanToken
      ) {
        ctx.reportError(
          stmt,
          "par: blocks do not support orElse (||/??). Use let: for monadic comprehensions with fallbacks.",
        );
        return undefined;
      }
    }

    // Plain bind: name << expr
    if (opKind === ts.SyntaxKind.LessThanLessThanToken) {
      if (!ts.isIdentifier(expr.left)) {
        ctx.reportError(
          expr.left,
          "Left side of << must be an identifier (variable name or _)",
        );
        return undefined;
      }
      steps.push({
        kind: "bind",
        name: expr.left.text,
        expression: expr.right,
        node: stmt,
      });
      continue;
    }

    ctx.reportError(
      stmt,
      "Expected `name << expression` or `name = expression`",
    );
    return undefined;
  }

  return steps;
}

/**
 * Collect all identifiers referenced in an expression (shallow scan).
 */
function collectReferencedIdentifiers(expr: ts.Expression): Set<string> {
  const refs = new Set<string>();
  function walk(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      refs.add(node.text);
    }
    ts.forEachChild(node, walk);
  }
  walk(expr);
  return refs;
}

/**
 * Validate that no step in a par: block references a previous step's binding.
 * Returns true if all steps are independent; reports errors and returns false otherwise.
 */
function validateIndependence(
  ctx: MacroContext,
  steps: (BindStep | MapStep)[],
): boolean {
  const boundNames = new Set<string>();
  let valid = true;

  for (const step of steps) {
    const refs = collectReferencedIdentifiers(step.expression);
    for (const ref of refs) {
      if (boundNames.has(ref)) {
        ctx.reportError(
          step.node,
          `par: bindings must be independent, but '${step.name}' references '${ref}' from a previous binding. ` +
            `Use let: for sequential/dependent bindings.`,
        );
        valid = false;
      }
    }
    boundNames.add(step.name);
  }

  return valid;
}

/**
 * Build the applicative combination for standard (non-Promise) types.
 *
 * Given binds [a << fa, b << fb, c << fc] and yield expr:
 *   fa.map(a => b => c => expr).ap(fb).ap(fc)
 *
 * Map steps are inlined as IIFEs in the yield expression, same as in let:.
 */
function buildApplicativeChain(
  ctx: MacroContext,
  steps: (BindStep | MapStep)[],
  returnExpr: ts.Expression,
): ts.Expression {
  const factory = ctx.factory;

  const bindSteps = steps.filter((s): s is BindStep => s.kind === "bind");
  const mapSteps = steps.filter((s): s is MapStep => s.kind === "map");

  // Wrap the return expression with IIFE bindings for map steps.
  // Map steps in par: are pure computations that don't depend on bindings
  // (independence is already validated), so we wrap them around the yield.
  let yieldExpr = returnExpr;
  for (let i = mapSteps.length - 1; i >= 0; i--) {
    const step = mapSteps[i];
    yieldExpr = factory.createCallExpression(
      factory.createParenthesizedExpression(
        factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              factory.createIdentifier(step.name),
            ),
          ],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          yieldExpr,
        ),
      ),
      undefined,
      [step.expression],
    );
  }

  if (bindSteps.length === 0) {
    // No bind steps — just pure computation
    return yieldExpr;
  }

  if (bindSteps.length === 1) {
    // Single bind — just .map()
    return factory.createCallExpression(
      factory.createPropertyAccessExpression(bindSteps[0].expression, "map"),
      undefined,
      [
        factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              factory.createIdentifier(bindSteps[0].name),
            ),
          ],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          yieldExpr,
        ),
      ],
    );
  }

  // Multiple binds: first.map(a => b => c => yield).ap(second).ap(third)
  // Build the curried function: a => b => c => yieldExpr
  let curriedBody: ts.Expression = yieldExpr;
  for (let i = bindSteps.length - 1; i >= 1; i--) {
    curriedBody = factory.createArrowFunction(
      undefined,
      undefined,
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          factory.createIdentifier(bindSteps[i].name),
        ),
      ],
      undefined,
      factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      curriedBody,
    );
  }

  // first.map(a => <curried>)
  let chain: ts.Expression = factory.createCallExpression(
    factory.createPropertyAccessExpression(bindSteps[0].expression, "map"),
    undefined,
    [
      factory.createArrowFunction(
        undefined,
        undefined,
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            factory.createIdentifier(bindSteps[0].name),
          ),
        ],
        undefined,
        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        curriedBody,
      ),
    ],
  );

  // .ap(second).ap(third)...
  for (let i = 1; i < bindSteps.length; i++) {
    chain = factory.createCallExpression(
      factory.createPropertyAccessExpression(chain, "ap"),
      undefined,
      [bindSteps[i].expression],
    );
  }

  return chain;
}

/**
 * Build the applicative combination for Promises using Promise.all.
 *
 * Given binds [a << fa, b << fb, c << fc] and yield expr:
 *   Promise.all([fa, fb, fc]).then(([a, b, c]) => expr)
 */
function buildPromiseAll(
  ctx: MacroContext,
  steps: (BindStep | MapStep)[],
  returnExpr: ts.Expression,
): ts.Expression {
  const factory = ctx.factory;

  const bindSteps = steps.filter((s): s is BindStep => s.kind === "bind");
  const mapSteps = steps.filter((s): s is MapStep => s.kind === "map");

  // Wrap the return expression with IIFE bindings for map steps
  let yieldExpr = returnExpr;
  for (let i = mapSteps.length - 1; i >= 0; i--) {
    const step = mapSteps[i];
    yieldExpr = factory.createCallExpression(
      factory.createParenthesizedExpression(
        factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              factory.createIdentifier(step.name),
            ),
          ],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          yieldExpr,
        ),
      ),
      undefined,
      [step.expression],
    );
  }

  if (bindSteps.length === 0) {
    return yieldExpr;
  }

  if (bindSteps.length === 1) {
    // Single Promise — just .then()
    return factory.createCallExpression(
      factory.createPropertyAccessExpression(bindSteps[0].expression, "then"),
      undefined,
      [
        factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              factory.createIdentifier(bindSteps[0].name),
            ),
          ],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          yieldExpr,
        ),
      ],
    );
  }

  // Promise.all([fa, fb, fc])
  const allCall = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      factory.createIdentifier("Promise"),
      "all",
    ),
    undefined,
    [factory.createArrayLiteralExpression(bindSteps.map((s) => s.expression))],
  );

  // .then(([a, b, c]) => yieldExpr)
  const destructuredParam = factory.createParameterDeclaration(
    undefined,
    undefined,
    factory.createArrayBindingPattern(
      bindSteps.map((s) =>
        factory.createBindingElement(
          undefined,
          undefined,
          factory.createIdentifier(s.name),
        ),
      ),
    ),
  );

  return factory.createCallExpression(
    factory.createPropertyAccessExpression(allCall, "then"),
    undefined,
    [
      factory.createArrowFunction(
        undefined,
        undefined,
        [destructuredParam],
        undefined,
        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        yieldExpr,
      ),
    ],
  );
}

// ============================================================================
// The par: Macro
// ============================================================================

export const parBlockMacro = defineLabeledBlockMacro({
  name: "par-block-comprehension",
  label: "par",
  description:
    "Applicative comprehension using labeled blocks: `par: { a << fa; b << fb } yield: { f(a, b) }`",
  continuationLabels: ["yield", "pure"],

  expand(
    ctx: MacroContext,
    mainBlock: ts.LabeledStatement,
    continuation: ts.LabeledStatement | undefined,
  ): ts.Statement | ts.Statement[] {
    const factory = ctx.factory;

    if (!ts.isBlock(mainBlock.statement)) {
      ctx.reportError(mainBlock, "par: must be followed by a block { ... }");
      return mainBlock;
    }

    // Extract steps (only bind and map — no guards or orElse)
    const steps = extractParSteps(ctx, mainBlock.statement);
    if (!steps || steps.length === 0) {
      ctx.reportError(
        mainBlock,
        "par: block must contain at least one binding",
      );
      return mainBlock;
    }

    // Must have at least one bind step
    const hasBindStep = steps.some((s) => s.kind === "bind");
    if (!hasBindStep) {
      ctx.reportError(
        mainBlock,
        "par: block must contain at least one `name << expression` binding",
      );
      return mainBlock;
    }

    // Validate independence — no step may reference a previous step's binding
    if (!validateIndependence(ctx, steps)) {
      return mainBlock;
    }

    // Extract return expression from continuation
    if (!continuation) {
      ctx.reportError(
        mainBlock,
        "par: requires a yield: or pure: block (applicative must have an explicit combining expression)",
      );
      return mainBlock;
    }

    if (!ts.isBlock(continuation.statement)) {
      ctx.reportError(
        continuation,
        `${continuation.label.text}: must be followed by a block { ... }`,
      );
      return mainBlock;
    }

    const returnExpr = extractReturnExpr(ctx, continuation.statement);
    if (!returnExpr) {
      return mainBlock;
    }

    // Resolve comprehension instance to determine parallel strategy
    const comprehension = resolveComprehensionInstance(ctx, steps);
    const usePromiseAll = comprehension.usePromiseAll === true;

    const result = usePromiseAll
      ? buildPromiseAll(ctx, steps, returnExpr)
      : buildApplicativeChain(ctx, steps, returnExpr);

    return factory.createExpressionStatement(result);
  },
});

// Register both macros
globalRegistry.register(parBlockMacro);

// ============================================================================
// Type-level placeholder exports
// ============================================================================

/**
 * Placeholder for the `let:` labeled block comprehension macro.
 *
 * Usage:
 * ```typescript
 * let: {
 *   user << fetchUser(id)          // monadic bind
 *   name = user.name.toUpperCase() // pure map
 *   _ << log(name)                 // bind, discard result
 *   posts << getPosts() || getCachedPosts()  // bind with orElse
 *   if (posts.length > 0) {}       // guard
 * }
 * yield: { ({ user, name, posts }) }
 * ```
 */
export const let_ = undefined as never;

/**
 * Placeholder for the `par:` labeled block comprehension macro.
 *
 * Usage:
 * ```typescript
 * par: {
 *   user   << fetchUser(id)
 *   posts  << fetchPosts(postId)
 *   config << loadConfig()
 * }
 * yield: { ({ user, posts, config }) }
 * ```
 *
 * All bindings must be independent — no binding may reference a previous
 * binding's name. For Promises, emits `Promise.all`. For other types,
 * emits `.map().ap().ap()` chains.
 */
export const par_ = undefined as never;

/**
 * Placeholder for the `yield:` continuation label.
 */
export const yield_ = undefined as never;

/**
 * Placeholder for the `pure:` continuation label (Haskell-style alias for yield).
 */
export const pure_ = undefined as never;
