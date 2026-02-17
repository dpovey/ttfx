/**
 * Effect Do-Comprehension Macro
 *
 * Provides Scala-style for-comprehension syntax for monadic types.
 * Works with Effect, Promise, Option, Either, and other flatMappable types.
 *
 * @example
 * ```typescript
 * // Generator-style syntax
 * const result = Do(function*() {
 *   const user = yield* fetchUser(id);
 *   const posts = yield* fetchPosts(user.id);
 *   const comments = yield* fetchComments(posts[0].id);
 *   return { user, posts, comments };
 * });
 *
 * // Transforms to:
 * const result = fetchUser(id).flatMap(user =>
 *   fetchPosts(user.id).flatMap(posts =>
 *     fetchComments(posts[0].id).map(comments =>
 *       ({ user, posts, comments })
 *     )
 *   )
 * );
 * ```
 */

import * as ts from "typescript";
import { defineExpressionMacro, globalRegistry } from "../../core/registry.js";
import { MacroContext } from "../../core/types.js";

// ============================================================================
// Monad Interface (for type documentation)
// ============================================================================

/**
 * Interface for types that support do-comprehension
 */
export interface Monad<A> {
  map<B>(f: (a: A) => B): Monad<B>;
  flatMap<B>(f: (a: A) => Monad<B>): Monad<B>;
}

// ============================================================================
// Do Macro
// ============================================================================

export const doMacro = defineExpressionMacro({
  name: "Do",
  description: "Transform generator-style code into flatMap chains",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    if (args.length !== 1) {
      ctx.reportError(
        callExpr,
        "Do() expects exactly one generator function argument",
      );
      return callExpr;
    }

    const arg = args[0];

    // Must be a generator function
    if (!ts.isFunctionExpression(arg) || !arg.asteriskToken) {
      ctx.reportError(
        callExpr,
        "Do() expects a generator function (function*() { ... })",
      );
      return callExpr;
    }

    if (!arg.body) {
      ctx.reportError(callExpr, "Do() generator function must have a body");
      return callExpr;
    }

    // Extract yield statements and transform to flatMap chain
    return transformGeneratorToFlatMap(ctx, arg.body);
  },
});

/**
 * Transform a generator function body into nested flatMap calls
 */
function transformGeneratorToFlatMap(
  ctx: MacroContext,
  body: ts.Block,
): ts.Expression {
  const factory = ctx.factory;
  const statements = Array.from(body.statements);

  // Find all yield* expressions and the final return
  const bindings: Array<{
    name: ts.Identifier;
    expression: ts.Expression;
  }> = [];
  let returnExpr: ts.Expression | undefined;

  for (const stmt of statements) {
    // Variable declaration with yield*
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          // Check for yield* expression
          if (
            ts.isYieldExpression(decl.initializer) &&
            decl.initializer.asteriskToken
          ) {
            if (decl.initializer.expression) {
              bindings.push({
                name: decl.name,
                expression: decl.initializer.expression,
              });
            }
          }
        }
      }
    }

    // Return statement
    if (ts.isReturnStatement(stmt) && stmt.expression) {
      returnExpr = stmt.expression;
    }
  }

  if (bindings.length === 0) {
    ctx.reportError(
      body,
      "Do() generator must have at least one yield* expression",
    );
    return factory.createIdentifier("undefined");
  }

  if (!returnExpr) {
    ctx.reportError(body, "Do() generator must have a return statement");
    return factory.createIdentifier("undefined");
  }

  // Build the flatMap chain from inside out
  // Start with the innermost: lastEffect.map(lastVar => returnExpr)
  let result = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      bindings[bindings.length - 1].expression,
      "map",
    ),
    undefined,
    [
      factory.createArrowFunction(
        undefined,
        undefined,
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            bindings[bindings.length - 1].name,
          ),
        ],
        undefined,
        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        returnExpr,
      ),
    ],
  );

  // Wrap with flatMaps from inside out
  for (let i = bindings.length - 2; i >= 0; i--) {
    const binding = bindings[i];
    result = factory.createCallExpression(
      factory.createPropertyAccessExpression(binding.expression, "flatMap"),
      undefined,
      [
        factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              binding.name,
            ),
          ],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          result,
        ),
      ],
    );
  }

  return result;
}

// ============================================================================
// ForYield Macro - Alternative syntax closer to Scala
// ============================================================================

export const forYieldMacro = defineExpressionMacro({
  name: "forYield",
  description: "Scala-style for-yield comprehension",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    // forYield([...bindings], yieldExpr)
    // where bindings are [name, expression] pairs

    if (args.length < 2) {
      ctx.reportError(
        callExpr,
        "forYield() expects bindings array and yield expression",
      );
      return callExpr;
    }

    const factory = ctx.factory;
    const bindingsArg = args[0];
    const yieldExpr = args[args.length - 1];

    if (!ts.isArrayLiteralExpression(bindingsArg)) {
      ctx.reportError(callExpr, "First argument must be an array of bindings");
      return callExpr;
    }

    // Parse bindings
    const bindings: Array<{ name: string; expr: ts.Expression }> = [];

    for (const element of bindingsArg.elements) {
      if (
        ts.isArrayLiteralExpression(element) &&
        element.elements.length === 2
      ) {
        const nameEl = element.elements[0];
        const exprEl = element.elements[1];

        if (ts.isStringLiteral(nameEl)) {
          bindings.push({
            name: nameEl.text,
            expr: exprEl,
          });
        }
      }
    }

    if (bindings.length === 0) {
      ctx.reportError(callExpr, "forYield() needs at least one binding");
      return callExpr;
    }

    // Build the chain
    let result = factory.createCallExpression(
      factory.createPropertyAccessExpression(
        bindings[bindings.length - 1].expr,
        "map",
      ),
      undefined,
      [
        factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              factory.createIdentifier(bindings[bindings.length - 1].name),
            ),
          ],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          yieldExpr,
        ),
      ],
    );

    for (let i = bindings.length - 2; i >= 0; i--) {
      const binding = bindings[i];
      result = factory.createCallExpression(
        factory.createPropertyAccessExpression(binding.expr, "flatMap"),
        undefined,
        [
          factory.createArrowFunction(
            undefined,
            undefined,
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                factory.createIdentifier(binding.name),
              ),
            ],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            result,
          ),
        ],
      );
    }

    return result;
  },
});

// ============================================================================
// Async Do - For Promises
// ============================================================================

export const asyncDoMacro = defineExpressionMacro({
  name: "asyncDo",
  description: "Transform async generator-style code into Promise chains",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    const factory = ctx.factory;

    if (args.length !== 1) {
      ctx.reportError(
        callExpr,
        "asyncDo() expects exactly one generator function argument",
      );
      return callExpr;
    }

    const arg = args[0];

    if (!ts.isFunctionExpression(arg) || !arg.asteriskToken) {
      ctx.reportError(
        callExpr,
        "asyncDo() expects a generator function (function*() { ... })",
      );
      return callExpr;
    }

    if (!arg.body) {
      ctx.reportError(
        callExpr,
        "asyncDo() generator function must have a body",
      );
      return callExpr;
    }

    // Extract yield* expressions
    const statements = Array.from(arg.body.statements);
    const bindings: Array<{ name: ts.Identifier; expression: ts.Expression }> =
      [];
    let returnExpr: ts.Expression | undefined;

    for (const stmt of statements) {
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.initializer) {
            if (
              ts.isYieldExpression(decl.initializer) &&
              decl.initializer.asteriskToken
            ) {
              if (decl.initializer.expression) {
                bindings.push({
                  name: decl.name,
                  expression: decl.initializer.expression,
                });
              }
            }
          }
        }
      }

      if (ts.isReturnStatement(stmt) && stmt.expression) {
        returnExpr = stmt.expression;
      }
    }

    if (bindings.length === 0 || !returnExpr) {
      return callExpr;
    }

    // Build Promise.then chain
    let result = factory.createCallExpression(
      factory.createPropertyAccessExpression(
        bindings[bindings.length - 1].expression,
        "then",
      ),
      undefined,
      [
        factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              bindings[bindings.length - 1].name,
            ),
          ],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          returnExpr,
        ),
      ],
    );

    for (let i = bindings.length - 2; i >= 0; i--) {
      const binding = bindings[i];
      result = factory.createCallExpression(
        factory.createPropertyAccessExpression(binding.expression, "then"),
        undefined,
        [
          factory.createArrowFunction(
            undefined,
            undefined,
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                binding.name,
              ),
            ],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            result,
          ),
        ],
      );
    }

    return result;
  },
});

// ============================================================================
// For Comprehension - Scala-style fluent syntax
// ============================================================================

/**
 * Scala-style for comprehension with fluent builder syntax
 *
 * @example
 * ```typescript
 * // Scala:
 * // for {
 * //   user <- fetchUser(id)
 * //   posts <- fetchPosts(user.id)
 * // } yield { user, posts }
 *
 * // TypeScript with For macro:
 * const result = For(fetchUser(id))
 *   .let("user")
 *   .then(user => fetchPosts(user.id))
 *   .let("posts")
 *   .yield(({ user, posts }) => ({ user, posts }));
 *
 * // Transforms to:
 * // fetchUser(id).flatMap(user =>
 * //   fetchPosts(user.id).map(posts =>
 * //     ({ user, posts })
 * //   )
 * // )
 * ```
 */
export const forMacro = defineExpressionMacro({
  name: "For",
  description: "Scala-style for comprehension with fluent builder",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    // For(effect).let("x").then(x => ...).let("y").yield(...)
    // We need to walk the method chain and collect bindings

    const factory = ctx.factory;

    // Walk up the chain to find the full expression
    let current: ts.Node = callExpr;
    while (current.parent && ts.isPropertyAccessExpression(current.parent)) {
      current = current.parent.parent!; // Go to the call expression
    }

    // Parse the chain starting from For(...)
    const chain = parseForChain(ctx, callExpr);
    if (!chain) {
      return callExpr;
    }

    // Build the flatMap/map chain
    return buildForChain(ctx, chain);
  },
});

interface ForBinding {
  name: string;
  effect: ts.Expression;
  transform?: ts.Expression; // Arrow function for .then()
}

interface ForChain {
  bindings: ForBinding[];
  yieldExpr: ts.Expression;
}

function parseForChain(
  ctx: MacroContext,
  forCall: ts.CallExpression,
): ForChain | null {
  const bindings: ForBinding[] = [];
  let yieldExpr: ts.Expression | undefined;

  // Start with the initial effect from For(effect)
  if (forCall.arguments.length !== 1) {
    ctx.reportError(forCall, "For() expects exactly one effect argument");
    return null;
  }

  let currentEffect = forCall.arguments[0];
  let current: ts.Node = forCall.parent!;

  // Walk the method chain
  while (current) {
    if (ts.isPropertyAccessExpression(current)) {
      const methodName = current.name.text;
      const callParent = current.parent;

      if (
        ts.isCallExpression(callParent) &&
        callParent.expression === current
      ) {
        if (methodName === "let" || methodName === "bind") {
          // .let("name") or .bind("name")
          const nameArg = callParent.arguments[0];
          if (ts.isStringLiteral(nameArg)) {
            bindings.push({
              name: nameArg.text,
              effect: currentEffect,
            });
          }
          current = callParent.parent!;
        } else if (methodName === "then" || methodName === "flatMap") {
          // .then(x => nextEffect)
          const transformArg = callParent.arguments[0];
          if (
            ts.isArrowFunction(transformArg) ||
            ts.isFunctionExpression(transformArg)
          ) {
            // The transform produces the next effect
            currentEffect = callParent; // Will be replaced during expansion
            // Store the transform for later
            if (bindings.length > 0) {
              bindings[bindings.length - 1].transform = transformArg;
            }
          }
          current = callParent.parent!;
        } else if (methodName === "yield" || methodName === "map") {
          // .yield(({ x, y }) => result)
          yieldExpr = callParent.arguments[0];
          break;
        } else {
          current = current.parent!;
        }
      } else {
        current = current.parent!;
      }
    } else {
      current = current.parent!;
    }
  }

  if (bindings.length === 0) {
    ctx.reportError(
      forCall,
      "For comprehension needs at least one .let() binding",
    );
    return null;
  }

  if (!yieldExpr) {
    ctx.reportError(forCall, "For comprehension needs a .yield() at the end");
    return null;
  }

  return { bindings, yieldExpr };
}

function buildForChain(ctx: MacroContext, chain: ForChain): ts.Expression {
  const factory = ctx.factory;
  const { bindings, yieldExpr } = chain;

  // Start with the innermost: lastEffect.map(yield)
  let result = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      bindings[bindings.length - 1].effect,
      "map",
    ),
    undefined,
    [yieldExpr],
  );

  // Wrap with flatMaps from inside out
  for (let i = bindings.length - 2; i >= 0; i--) {
    const binding = bindings[i];
    const nextBinding = bindings[i + 1];

    // Create: effect.flatMap(name => nextExpr)
    let body: ts.Expression;
    if (nextBinding.transform) {
      // There's a transform function, we need to call it
      body = factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createCallExpression(nextBinding.transform, undefined, [
            factory.createIdentifier(binding.name),
          ]),
          "flatMap",
        ),
        undefined,
        [
          factory.createArrowFunction(
            undefined,
            undefined,
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                factory.createIdentifier(nextBinding.name),
              ),
            ],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            result,
          ),
        ],
      );
    } else {
      body = result;
    }

    result = factory.createCallExpression(
      factory.createPropertyAccessExpression(binding.effect, "flatMap"),
      undefined,
      [
        factory.createArrowFunction(
          undefined,
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              factory.createIdentifier(binding.name),
            ),
          ],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          body,
        ),
      ],
    );
  }

  return result;
}

// ============================================================================
// for$ Tagged Template - Even more Scala-like syntax
// ============================================================================

/**
 * Tagged template for Scala-style for comprehension
 *
 * @example
 * ```typescript
 * // Usage:
 * const result = for$`
 *   user <- ${fetchUser(id)}
 *   posts <- ${fetchPosts}
 *   if ${posts.length > 0}
 * `.yield(({ user, posts }) => ({ user, posts }));
 * ```
 */
export const forTemplateMacro = defineExpressionMacro({
  name: "for$",
  description: "Tagged template for Scala-style for comprehension",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    // This is a tagged template literal
    if (args.length !== 1 || !ts.isTaggedTemplateExpression(callExpr.parent!)) {
      ctx.reportError(
        callExpr,
        "for$ must be used as a tagged template literal",
      );
      return callExpr;
    }

    // For now, return the call - full implementation would parse the template
    // and extract bindings like "user <- ${expr}"
    return callExpr;
  },
});

// ============================================================================
// comprehend() - Object literal syntax closest to Scala
// ============================================================================

/**
 * Object-literal based for comprehension - closest to Scala's syntax
 *
 * @example
 * ```typescript
 * // Scala:
 * // for {
 * //   user <- fetchUser(id)
 * //   posts <- fetchPosts(user.id)
 * //   if posts.length > 0
 * // } yield (user, posts)
 *
 * // TypeScript equivalent:
 * const result = comprehend({
 *   user: fetchUser(id),
 *   posts: ({ user }) => fetchPosts(user.id),
 *   _if: ({ posts }) => posts.length > 0,
 *   _yield: ({ user, posts }) => ({ user, posts }),
 * });
 *
 * // Transforms to:
 * // fetchUser(id).flatMap(user =>
 * //   fetchPosts(user.id)
 * //     .filter(posts => posts.length > 0)
 * //     .map(posts => ({ user, posts }))
 * // )
 * ```
 *
 * Keys starting with _ are special:
 * - _if: filter condition
 * - _yield: final mapping (required)
 * - _let: intermediate value (not an effect, just a computed value)
 */
export const comprehendMacro = defineExpressionMacro({
  name: "comprehend",
  description: "Object-literal based for comprehension like Scala",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    const factory = ctx.factory;

    if (args.length !== 1 || !ts.isObjectLiteralExpression(args[0])) {
      ctx.reportError(
        callExpr,
        "comprehend() expects an object literal argument",
      );
      return callExpr;
    }

    const objLit = args[0] as ts.ObjectLiteralExpression;
    const bindings: ComprehendBinding[] = [];
    let yieldExpr: ts.Expression | undefined;
    let filterExpr: ts.Expression | undefined;

    // Parse the object literal
    for (const prop of objLit.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;

      const name = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : "";

      if (name === "_yield" || name === "yield") {
        yieldExpr = prop.initializer;
      } else if (name === "_if" || name === "if") {
        filterExpr = prop.initializer;
      } else if (name.startsWith("_let_")) {
        // _let_x: value means assign x = value (not an effect)
        bindings.push({
          name: name.slice(5), // Remove "_let_" prefix
          value: prop.initializer,
          isLet: true,
        });
      } else {
        // Regular binding: name: effect or name: ctx => effect
        bindings.push({
          name,
          value: prop.initializer,
          isLet: false,
        });
      }
    }

    if (!yieldExpr) {
      ctx.reportError(callExpr, "comprehend() requires a _yield property");
      return callExpr;
    }

    if (bindings.length === 0) {
      ctx.reportError(callExpr, "comprehend() needs at least one binding");
      return callExpr;
    }

    // Build the expression from inside out
    return buildComprehend(ctx, bindings, yieldExpr, filterExpr);
  },
});

interface ComprehendBinding {
  name: string;
  value: ts.Expression;
  isLet: boolean; // If true, it's just a computed value, not an effect
}

function buildComprehend(
  ctx: MacroContext,
  bindings: ComprehendBinding[],
  yieldExpr: ts.Expression,
  filterExpr?: ts.Expression,
): ts.Expression {
  const factory = ctx.factory;

  // Collect all bound names for the context parameter
  const boundNames = bindings.map((b) => b.name);

  // Build from inside out
  // Start with the yield expression wrapped in map
  let result: ts.Expression = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      factory.createIdentifier("__lastEffect__"),
      "map",
    ),
    undefined,
    [ensureArrowWithContext(factory, yieldExpr, boundNames)],
  );

  // Add filter if present
  if (filterExpr) {
    result = factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier("__lastEffect__"),
        "filter",
      ),
      undefined,
      [ensureArrowWithContext(factory, filterExpr, boundNames)],
    );

    // Chain with map
    result = factory.createCallExpression(
      factory.createPropertyAccessExpression(result, "map"),
      undefined,
      [ensureArrowWithContext(factory, yieldExpr, boundNames)],
    );
  }

  // Work backwards through bindings
  for (let i = bindings.length - 1; i >= 0; i--) {
    const binding = bindings[i];
    const prevNames = bindings.slice(0, i).map((b) => b.name);

    if (i === bindings.length - 1) {
      // Replace __lastEffect__ with actual effect
      const effect = isArrowOrFunction(binding.value)
        ? factory.createCallExpression(binding.value, undefined, [
            createContextObject(factory, prevNames),
          ])
        : binding.value;

      // Replace placeholder
      result = replaceIdentifier(factory, result, "__lastEffect__", effect);

      if (i === 0) {
        // Single binding - just return the result
        break;
      }
    } else {
      // Wrap in flatMap for this binding
      const nextBindingNames = bindings.slice(0, i + 1).map((b) => b.name);
      const effect = isArrowOrFunction(binding.value)
        ? factory.createCallExpression(binding.value, undefined, [
            createContextObject(factory, prevNames),
          ])
        : binding.value;

      result = factory.createCallExpression(
        factory.createPropertyAccessExpression(effect, "flatMap"),
        undefined,
        [
          factory.createArrowFunction(
            undefined,
            undefined,
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                factory.createIdentifier(binding.name),
              ),
            ],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            result,
          ),
        ],
      );
    }
  }

  // Handle the first binding
  const firstBinding = bindings[0];
  const firstEffect = isArrowOrFunction(firstBinding.value)
    ? factory.createCallExpression(firstBinding.value, undefined, [
        factory.createObjectLiteralExpression([]),
      ])
    : firstBinding.value;

  if (bindings.length === 1) {
    // Just map or filter+map
    return factory.createCallExpression(
      factory.createPropertyAccessExpression(
        firstEffect,
        filterExpr ? "filter" : "map",
      ),
      undefined,
      [
        filterExpr
          ? ensureArrowWithContext(factory, filterExpr, [firstBinding.name])
          : ensureArrowWithContext(factory, yieldExpr, [firstBinding.name]),
      ],
    );
  }

  return factory.createCallExpression(
    factory.createPropertyAccessExpression(firstEffect, "flatMap"),
    undefined,
    [
      factory.createArrowFunction(
        undefined,
        undefined,
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            factory.createIdentifier(firstBinding.name),
          ),
        ],
        undefined,
        factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        result,
      ),
    ],
  );
}

function isArrowOrFunction(
  expr: ts.Expression,
): expr is ts.ArrowFunction | ts.FunctionExpression {
  return ts.isArrowFunction(expr) || ts.isFunctionExpression(expr);
}

function ensureArrowWithContext(
  factory: ts.NodeFactory,
  expr: ts.Expression,
  contextNames: string[],
): ts.ArrowFunction {
  if (ts.isArrowFunction(expr)) {
    return expr;
  }

  // Wrap in arrow function with destructured context
  return factory.createArrowFunction(
    undefined,
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createObjectBindingPattern(
          contextNames.map((name) =>
            factory.createBindingElement(
              undefined,
              undefined,
              factory.createIdentifier(name),
            ),
          ),
        ),
      ),
    ],
    undefined,
    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    expr,
  );
}

function createContextObject(
  factory: ts.NodeFactory,
  names: string[],
): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    names.map((name) =>
      factory.createShorthandPropertyAssignment(factory.createIdentifier(name)),
    ),
    false,
  );
}

function replaceIdentifier(
  factory: ts.NodeFactory,
  node: ts.Node,
  name: string,
  replacement: ts.Expression,
): ts.Expression {
  // Simple implementation - in real code would use visitor
  if (ts.isIdentifier(node) && node.text === name) {
    return replacement;
  }
  return node as ts.Expression;
}

// Register macros
globalRegistry.register(doMacro);
globalRegistry.register(forYieldMacro);
globalRegistry.register(asyncDoMacro);
globalRegistry.register(forMacro);
globalRegistry.register(forTemplateMacro);
globalRegistry.register(comprehendMacro);

// ============================================================================
// Runtime For Comprehension Builder (no macro transformation needed)
// ============================================================================

/**
 * Runtime for-comprehension builder with Scala-like fluent syntax.
 * This works at runtime without macro transformation.
 *
 * @example
 * ```typescript
 * // Scala:
 * // for {
 * //   x <- Some(1)
 * //   y <- Some(2)
 * // } yield x + y
 *
 * // TypeScript:
 * const result = For.of(some(1))
 *   .flatMap(x => some(2).map(y => x + y));
 *
 * // Or with named bindings:
 * const result = For.from({ x: some(1) })
 *   .bind("y", ({ x }) => some(x + 1))
 *   .yield(({ x, y }) => x + y);
 * ```
 */
export class ForComprehension<
  M extends Monad<unknown>,
  Ctx extends Record<string, unknown>,
> {
  private constructor(
    private readonly effect: M,
    private readonly context: Ctx,
  ) {}

  /**
   * Start a for comprehension with a single effect
   */
  static of<M extends Monad<unknown>, A>(
    effect: M & Monad<A>,
  ): ForComprehension<M, Record<string, never>> {
    return new ForComprehension(effect, {} as Record<string, never>);
  }

  /**
   * Start a for comprehension with named initial bindings
   *
   * @example
   * ```typescript
   * For.from({ user: fetchUser(id) })
   *   .bind("posts", ({ user }) => fetchPosts(user.id))
   *   .yield(({ user, posts }) => ({ user, posts }));
   * ```
   */
  static from<Name extends string, M extends Monad<unknown>, A>(
    bindings: Record<Name, M & Monad<A>>,
  ): ForComprehensionBuilder<{ [K in Name]: A }> {
    const entries = Object.entries(bindings) as [Name, M & Monad<A>][];
    if (entries.length !== 1) {
      throw new Error("For.from() expects exactly one binding");
    }
    const [name, effect] = entries[0];
    return new ForComprehensionBuilder(effect as Monad<A>, name);
  }
}

/**
 * Builder for chaining for-comprehension bindings
 */
export class ForComprehensionBuilder<Ctx extends Record<string, unknown>> {
  private bindings: Array<{
    name: string;
    effect: Monad<unknown> | ((ctx: Ctx) => Monad<unknown>);
  }> = [];

  constructor(
    private readonly initialEffect: Monad<unknown>,
    private readonly initialName: string,
  ) {
    this.bindings.push({ name: initialName, effect: initialEffect });
  }

  /**
   * Add a new binding to the comprehension
   *
   * @example
   * ```typescript
   * For.from({ x: some(1) })
   *   .bind("y", ({ x }) => some(x + 1))
   *   .bind("z", ({ x, y }) => some(x + y))
   *   .yield(({ x, y, z }) => x + y + z);
   * ```
   */
  bind<Name extends string, A>(
    name: Name,
    effect: (ctx: Ctx) => Monad<A>,
  ): ForComprehensionBuilder<Ctx & { [K in Name]: A }> {
    this.bindings.push({
      name,
      effect: effect as (ctx: Ctx) => Monad<unknown>,
    });
    return this as unknown as ForComprehensionBuilder<Ctx & { [K in Name]: A }>;
  }

  /**
   * Add a guard/filter condition (requires the monad to support filter)
   * Note: This creates a binding that uses filter on the previous effect
   *
   * @example
   * ```typescript
   * // For monads with filter support:
   * For.from({ x: someList([1, 2, 3, 4, 5]) })
   *   .filter(({ x }) => x > 2)
   *   .yield(({ x }) => x * 2);
   * ```
   */
  filter(predicate: (ctx: Ctx) => boolean): ForComprehensionBuilder<Ctx> {
    // Store the filter predicate - will be applied during yield()
    // This is a simplified implementation; full support would need
    // to track filters separately and apply them in the chain
    console.warn(
      "guard/filter in For comprehension is not fully implemented yet",
    );
    return this;
  }

  /**
   * Complete the comprehension with a yield expression
   *
   * @example
   * ```typescript
   * For.from({ x: some(1) })
   *   .bind("y", ({ x }) => some(x + 1))
   *   .yield(({ x, y }) => x + y);
   * // Returns Some(3)
   * ```
   */
  yield<B>(f: (ctx: Ctx) => B): Monad<B> {
    // Build the chain from inside out
    const bindings = this.bindings;

    if (bindings.length === 1) {
      const b = bindings[0];
      const effect =
        typeof b.effect === "function" ? b.effect({} as Ctx) : b.effect;
      return effect.map((val: unknown) => f({ [b.name]: val } as Ctx));
    }

    // Build nested flatMaps
    const buildChain = (index: number, ctx: Ctx): Monad<B> => {
      if (index === bindings.length - 1) {
        // Last binding - use map for the yield
        const b = bindings[index];
        const effect =
          typeof b.effect === "function" ? b.effect(ctx) : b.effect;
        return effect.map((val: unknown) =>
          f({ ...ctx, [b.name]: val } as Ctx),
        );
      }

      const b = bindings[index];
      const effect = typeof b.effect === "function" ? b.effect(ctx) : b.effect;

      return effect.flatMap((val: unknown) => {
        const newCtx = { ...ctx, [b.name]: val } as Ctx;
        return buildChain(index + 1, newCtx);
      });
    };

    return buildChain(0, {} as Ctx);
  }

  /**
   * Alias for yield (for cases where yield is a reserved word concern)
   */
  map<B>(f: (ctx: Ctx) => B): Monad<B> {
    return this.yield(f);
  }
}

// Export the For namespace
export const For = ForComprehension;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Simple Option type for demonstration
 */
export class Option<A> {
  private constructor(
    private readonly _value: A | null,
    private readonly _isSome: boolean,
  ) {}

  static some<A>(value: A): Option<A> {
    return new Option(value, true);
  }

  static none<A>(): Option<A> {
    return new Option<A>(null, false);
  }

  /** Get the value (undefined if None) */
  get value(): A | undefined {
    return this._isSome ? this._value! : undefined;
  }

  isSome(): boolean {
    return this._isSome;
  }

  isNone(): boolean {
    return !this._isSome;
  }

  map<B>(f: (a: A) => B): Option<B> {
    if (this._isSome) {
      return Option.some(f(this._value!));
    }
    return Option.none();
  }

  flatMap<B>(f: (a: A) => Option<B>): Option<B> {
    if (this._isSome) {
      return f(this._value!);
    }
    return Option.none();
  }

  getOrElse(defaultValue: A): A {
    return this._isSome ? this._value! : defaultValue;
  }
}

/**
 * Simple Either type for demonstration
 */
export class Either<L, R> {
  private constructor(
    private readonly _left: L | null,
    private readonly _right: R | null,
    public readonly isRight: boolean,
  ) {}

  static left<L, R>(value: L): Either<L, R> {
    return new Either<L, R>(value, null, false);
  }

  static right<L, R>(value: R): Either<L, R> {
    return new Either<L, R>(null, value, true);
  }

  /** Get the right value (undefined if Left) */
  get value(): R | undefined {
    return this.isRight ? this._right! : undefined;
  }

  /** Get the left (error) value (undefined if Right) */
  get error(): L | undefined {
    return this.isRight ? undefined : this._left!;
  }

  isLeft(): boolean {
    return !this.isRight;
  }

  map<B>(f: (r: R) => B): Either<L, B> {
    if (this.isRight) {
      return Either.right(f(this._right!));
    }
    return Either.left(this._left!);
  }

  flatMap<B>(f: (r: R) => Either<L, B>): Either<L, B> {
    if (this.isRight) {
      return f(this._right!);
    }
    return Either.left(this._left!);
  }

  fold<B>(onLeft: (l: L) => B, onRight: (r: R) => B): B {
    return this.isRight ? onRight(this._right!) : onLeft(this._left!);
  }
}

/**
 * Simple IO monad for demonstration
 */
export class IO<A> {
  constructor(private readonly _run: () => A) {}

  static of<A>(value: A): IO<A> {
    return new IO(() => value);
  }

  static suspend<A>(f: () => A): IO<A> {
    return new IO(f);
  }

  map<B>(f: (a: A) => B): IO<B> {
    return new IO(() => f(this._run()));
  }

  flatMap<B>(f: (a: A) => IO<B>): IO<B> {
    return new IO(() => f(this._run())._run());
  }

  run(): A {
    return this._run();
  }
}

// ============================================================================
// Helper functions for cleaner syntax
// ============================================================================

/** Create a Some value */
export function some<A>(value: A): Option<A> {
  return Option.some(value);
}

/** Create a None value */
export function none<A>(): Option<A> {
  return Option.none();
}

/** Create a Left (error) value */
export function left<L, R>(value: L): Either<L, R> {
  return Either.left(value);
}

/** Create a Right (success) value */
export function right<L, R>(value: R): Either<L, R> {
  return Either.right(value);
}

/** Create an IO from a thunk */
export function io<A>(f: () => A): IO<A> {
  return new IO(f);
}
