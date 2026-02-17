/**
 * comptime macro - Evaluate expressions at compile time
 *
 * Inspired by Zig's comptime keyword, this macro evaluates expressions
 * during compilation and replaces them with their computed values.
 *
 * Uses Node's vm module to execute transpiled TypeScript in a sandbox,
 * giving full JavaScript semantics (closures, recursion, all operators,
 * built-in methods) without maintaining a custom interpreter.
 *
 * Usage:
 *   const x = comptime(() => 5 * 5);           // becomes: const x = 25;
 *   const factorial5 = comptime(() => {
 *     let result = 1;
 *     for (let i = 1; i <= 5; i++) result *= i;
 *     return result;
 *   });                                         // becomes: const factorial5 = 120;
 */

import * as ts from "typescript";
import * as vm from "node:vm";
import { defineExpressionMacro, globalRegistry } from "../core/registry.js";
import { MacroContext, ComptimeValue } from "../core/types.js";
import { MacroContextImpl } from "../core/context.js";

/** Maximum execution time for comptime evaluation (ms) */
const COMPTIME_TIMEOUT_MS = 5000;

/** Maximum iteration limit hint (for documentation; actual enforcement is via timeout) */
const MAX_ITERATIONS = 100_000;

/**
 * Shared sandbox object. The sandbox is stateless (no mutable globals leak
 * between evaluations) so we can reuse it across all comptime calls,
 * avoiding the cost of re-creating the sandbox + vm.createContext() per call.
 */
let sharedSandbox: Record<string, unknown> | undefined;
let sharedContext: vm.Context | undefined;

/**
 * Compiled regex for cleaning transpiled output. Created once, reused.
 */
const RE_USE_STRICT = /^"use strict";\s*/;
const RE_DEFINE_PROPERTY = /\s*Object\.defineProperty\(exports.*\n?/g;
const RE_EXPORTS_VOID = /\s*exports\.\S+ = void 0;\s*/g;

/**
 * Shared compiler options for transpileModule. Allocated once.
 */
const TRANSPILE_OPTIONS: ts.TranspileOptions = {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    strict: false,
    removeComments: true,
  },
  reportDiagnostics: true,
};

export const comptimeMacro = defineExpressionMacro({
  name: "comptime",
  module: "typemacro",
  description: "Evaluate an expression at compile time",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    if (args.length !== 1) {
      ctx.reportError(callExpr, "comptime expects exactly one argument");
      return callExpr;
    }

    const arg = args[0];

    // If it's an arrow function or function expression, evaluate via vm
    if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
      return evaluateViaVm(ctx as MacroContextImpl, arg, callExpr);
    }

    // For simple expressions, try the lightweight AST evaluator first
    const result = ctx.evaluate(arg);

    if (result.kind === "error") {
      // Fall back to vm-based evaluation for complex expressions
      return evaluateViaVm(ctx as MacroContextImpl, arg, callExpr);
    }

    return (ctx as MacroContextImpl).comptimeValueToExpression(result);
  },
});

/**
 * Evaluate a TypeScript expression/function at compile time using Node's vm module.
 *
 * This transpiles the source to JavaScript, runs it in a sandboxed context,
 * and converts the result back to a TypeScript AST node.
 */
function evaluateViaVm(
  ctx: MacroContextImpl,
  node: ts.Node,
  callExpr: ts.CallExpression,
): ts.Expression {
  const sourceText = node.getText ? node.getText() : nodeToString(node, ctx);

  // Wrap in an IIFE if it's a function — call it immediately
  const isFunction = ts.isArrowFunction(node) || ts.isFunctionExpression(node);
  const codeToEval = isFunction ? `(${sourceText})()` : `(${sourceText})`;

  // Transpile TypeScript to JavaScript (reuse shared compiler options)
  const { outputText, diagnostics } = ts.transpileModule(
    codeToEval,
    TRANSPILE_OPTIONS,
  );

  if (diagnostics && diagnostics.length > 0) {
    const messages = diagnostics.map((d) =>
      ts.flattenDiagnosticMessageText(d.messageText, "\n"),
    );
    ctx.reportError(
      callExpr,
      `Cannot transpile comptime expression: ${messages.join("; ")}`,
    );
    return callExpr;
  }

  // Strip the trailing export {} that transpileModule sometimes adds
  const cleanedJs = outputText
    .replace(RE_USE_STRICT, "")
    .replace(RE_DEFINE_PROPERTY, "")
    .replace(RE_EXPORTS_VOID, "");

  try {
    // Reuse shared sandbox + context across all comptime calls.
    // The sandbox contains only pure functions (Math, JSON, etc.) so
    // there's no state leakage between evaluations.
    if (!sharedContext) {
      sharedSandbox = createComptimeSandbox();
      sharedContext = vm.createContext(sharedSandbox);
    }

    const result = vm.runInContext(cleanedJs, sharedContext, {
      timeout: COMPTIME_TIMEOUT_MS,
      filename: "comptime-eval.js",
    });

    return jsValueToExpression(ctx, result, callExpr);
  } catch (error: unknown) {
    ctx.reportError(
      callExpr,
      formatComptimeError(error, sourceText, ctx, callExpr),
    );
    return callExpr;
  }
}

/**
 * Format a comptime evaluation error with source context.
 *
 * Includes the original source snippet, file location, and a clear
 * explanation of what went wrong -- not just the raw vm error.
 */
function formatComptimeError(
  error: unknown,
  sourceText: string,
  ctx: MacroContextImpl,
  callExpr: ts.CallExpression,
): string {
  const rawMessage = error instanceof Error ? error.message : String(error);

  // Get source location
  const sourceFile = ctx.sourceFile;
  const start = callExpr.getStart(sourceFile);
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
  const location = `${sourceFile.fileName}:${line + 1}:${character + 1}`;

  // Truncate long source snippets
  const maxSnippetLen = 200;
  const snippet =
    sourceText.length > maxSnippetLen
      ? sourceText.slice(0, maxSnippetLen) + "..."
      : sourceText;

  // Detect common error patterns and provide helpful messages
  let hint = "";
  if (rawMessage.includes("Script execution timed out")) {
    hint =
      `\n  Hint: The expression took longer than ${COMPTIME_TIMEOUT_MS}ms to evaluate. ` +
      `Check for infinite loops or very expensive computations.`;
  } else if (
    rawMessage.includes("is not defined") ||
    rawMessage.includes("is not a function")
  ) {
    const match = rawMessage.match(/(\w+) is not (defined|a function)/);
    const name = match?.[1] ?? "unknown";
    hint =
      `\n  Hint: '${name}' is not available in the comptime sandbox. ` +
      `Only safe built-ins (Math, JSON, Array, etc.) are accessible. ` +
      `File I/O, network, and process access are intentionally blocked.`;
  } else if (rawMessage.includes("Cannot read properties of")) {
    hint =
      "\n  Hint: A null/undefined value was accessed. " +
      "Check that all variables are properly initialized.";
  }

  return (
    `Compile-time evaluation failed at ${location}\n` +
    `  Source: comptime(${snippet})\n` +
    `  Error: ${rawMessage}${hint}`
  );
}

/**
 * Create a sandboxed environment for comptime evaluation.
 * Only safe, side-effect-free globals are exposed.
 */
function createComptimeSandbox(): Record<string, unknown> {
  return {
    // Safe built-ins
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    WeakMap,
    WeakSet,
    JSON,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    NaN,
    Infinity,
    undefined,

    // Console for debugging (output goes to build log)
    console: {
      log: (...args: unknown[]) => console.log("[comptime]", ...args),
      warn: (...args: unknown[]) => console.warn("[comptime]", ...args),
      error: (...args: unknown[]) => console.error("[comptime]", ...args),
    },
  };
}

/**
 * Convert a JavaScript runtime value to a TypeScript AST expression.
 */
function jsValueToExpression(
  ctx: MacroContextImpl,
  value: unknown,
  errorNode: ts.Node,
): ts.Expression {
  if (value === null) {
    return ctx.factory.createNull();
  }

  if (value === undefined) {
    return ctx.factory.createIdentifier("undefined");
  }

  if (typeof value === "number") {
    if (value < 0) {
      return ctx.factory.createPrefixUnaryExpression(
        ts.SyntaxKind.MinusToken,
        ctx.factory.createNumericLiteral(Math.abs(value)),
      );
    }
    if (!isFinite(value)) {
      return ctx.factory.createIdentifier(value > 0 ? "Infinity" : "-Infinity");
    }
    if (isNaN(value)) {
      return ctx.factory.createIdentifier("NaN");
    }
    return ctx.factory.createNumericLiteral(value);
  }

  if (typeof value === "string") {
    return ctx.factory.createStringLiteral(value);
  }

  if (typeof value === "boolean") {
    return value ? ctx.factory.createTrue() : ctx.factory.createFalse();
  }

  if (typeof value === "bigint") {
    return ctx.factory.createBigIntLiteral(value.toString());
  }

  if (Array.isArray(value)) {
    const elements = value.map((el) => jsValueToExpression(ctx, el, errorNode));
    return ctx.factory.createArrayLiteralExpression(elements);
  }

  if (value instanceof RegExp) {
    return ctx.factory.createCallExpression(
      ctx.factory.createIdentifier("RegExp"),
      undefined,
      [
        ctx.factory.createStringLiteral(value.source),
        ctx.factory.createStringLiteral(value.flags),
      ],
    );
  }

  if (typeof value === "object") {
    const properties: ts.PropertyAssignment[] = [];
    for (const [key, val] of Object.entries(value)) {
      properties.push(
        ctx.factory.createPropertyAssignment(
          /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
            ? ctx.factory.createIdentifier(key)
            : ctx.factory.createStringLiteral(key),
          jsValueToExpression(ctx, val, errorNode),
        ),
      );
    }
    return ctx.factory.createObjectLiteralExpression(properties, true);
  }

  // Functions, symbols, etc. cannot be serialized to AST
  ctx.reportError(
    errorNode,
    `Cannot serialize comptime result of type ${typeof value} to AST`,
  );
  return ctx.factory.createIdentifier("undefined");
}

/**
 * Convert a TS node to its source text when getText() is unavailable
 * (e.g., for synthetically created nodes).
 * Uses the context's shared printer to avoid creating a new one per call.
 */
function nodeToString(node: ts.Node, ctx: MacroContextImpl): string {
  return ctx.printer.printNode(ts.EmitHint.Expression, node, ctx.sourceFile);
}

/**
 * Convert a JS value to a ComptimeValue (for interop with the lightweight evaluator).
 */
export function jsToComptimeValue(value: unknown): ComptimeValue {
  if (value === null) return { kind: "null" };
  if (value === undefined) return { kind: "undefined" };
  if (typeof value === "number") return { kind: "number", value };
  if (typeof value === "string") return { kind: "string", value };
  if (typeof value === "boolean") return { kind: "boolean", value };
  if (Array.isArray(value)) {
    return { kind: "array", elements: value.map(jsToComptimeValue) };
  }
  if (typeof value === "object") {
    const properties = new Map<string, ComptimeValue>();
    for (const [k, v] of Object.entries(value)) {
      properties.set(k, jsToComptimeValue(v));
    }
    return { kind: "object", properties };
  }
  return {
    kind: "error",
    message: `Cannot convert ${typeof value} to ComptimeValue`,
  };
}

// Register the macro
globalRegistry.register(comptimeMacro);
