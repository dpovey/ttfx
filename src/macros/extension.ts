/**
 * Standalone Extension Methods for Concrete Types
 *
 * Scala 3 has two extension mechanisms:
 * 1. Typeclass-derived extensions (e.g., Show[A] adds .show() to any A with an instance)
 * 2. Standalone extensions on concrete types (e.g., `extension (n: Int) def isEven = ...`)
 *
 * ttfx's typeclass system handles (1). This module handles (2): enriching concrete
 * types with methods that don't go through typeclass instance resolution.
 *
 * The rewrite is simpler than typeclass extensions — there's no summon/instance
 * lookup, just a direct call to the registered function.
 *
 * Usage:
 *   registerExtensions("number", NumberExt);
 *   extend(42).clamp(0, 100)  // → NumberExt.clamp(42, 0, 100)
 *
 *   registerExtension("number", clamp);
 *   extend(42).clamp(0, 100)  // → clamp(42, 0, 100)
 */

import ts from "typescript";
import type { MacroContext, ExpressionMacro } from "../core/types.js";
import { defineExpressionMacro } from "../core/registry.js";
import { globalRegistry } from "../core/registry.js";

// ============================================================================
// Registry
// ============================================================================

export interface StandaloneExtensionInfo {
  /** The method name (e.g., "clamp") */
  methodName: string;
  /** The type this extension is for (e.g., "number", "string", "Array") */
  forType: string;
  /**
   * How to reference the function at the call site.
   * If qualifier is set: `qualifier.methodName(receiver, args)`
   * If not: `methodName(receiver, args)`
   */
  qualifier?: string;
}

const standaloneExtensionRegistry: StandaloneExtensionInfo[] = [];

export function registerStandaloneExtensionEntry(
  info: StandaloneExtensionInfo,
): void {
  const exists = standaloneExtensionRegistry.some(
    (e) =>
      e.methodName === info.methodName &&
      e.forType === info.forType &&
      e.qualifier === info.qualifier,
  );
  if (!exists) {
    standaloneExtensionRegistry.push(info);
  }
}

/**
 * Find a standalone extension method for a given method name and type.
 * Returns undefined if no standalone extension is registered.
 */
export function findStandaloneExtension(
  methodName: string,
  typeName: string,
): StandaloneExtensionInfo | undefined {
  return standaloneExtensionRegistry.find(
    (e) => e.methodName === methodName && e.forType === typeName,
  );
}

/**
 * Get all standalone extensions registered for a type.
 */
export function getStandaloneExtensionsForType(
  typeName: string,
): StandaloneExtensionInfo[] {
  return standaloneExtensionRegistry.filter((e) => e.forType === typeName);
}

/**
 * Get all registered standalone extensions.
 */
export function getAllStandaloneExtensions(): StandaloneExtensionInfo[] {
  return [...standaloneExtensionRegistry];
}

// ============================================================================
// registerExtensions — batch registration from a namespace object
// ============================================================================

export const registerExtensionsMacro: ExpressionMacro = defineExpressionMacro({
  name: "registerExtensions",
  description:
    "Register all methods of a namespace object as extension methods for a concrete type",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    if (args.length < 2) {
      ctx.reportError(
        callExpr,
        "registerExtensions() requires two arguments: a type name string and a namespace object",
      );
      return ctx.factory.createVoidZero();
    }

    const typeNameArg = args[0];
    const namespaceArg = args[1];

    // Extract type name from string literal
    if (!ts.isStringLiteral(typeNameArg)) {
      ctx.reportError(
        typeNameArg,
        "First argument to registerExtensions() must be a string literal",
      );
      return ctx.factory.createVoidZero();
    }
    const forType = typeNameArg.text;

    // Get the qualifier name (the identifier used for the namespace)
    let qualifierName: string | undefined;
    if (ts.isIdentifier(namespaceArg)) {
      qualifierName = namespaceArg.text;
    }

    // Use type checker to enumerate properties of the namespace object
    const namespaceType = ctx.typeChecker.getTypeAtLocation(namespaceArg);
    const properties = namespaceType.getProperties();

    for (const prop of properties) {
      const propType = ctx.typeChecker.getTypeOfSymbolAtLocation(
        prop,
        namespaceArg,
      );

      // Only register callable properties (functions)
      const callSignatures = propType.getCallSignatures();
      if (callSignatures.length === 0) continue;

      registerStandaloneExtensionEntry({
        methodName: prop.name,
        forType,
        qualifier: qualifierName,
      });
    }

    // Compile away to nothing
    return ctx.factory.createVoidZero();
  },
});

// ============================================================================
// registerExtension — single function registration
// ============================================================================

export const registerExtensionMacro: ExpressionMacro = defineExpressionMacro({
  name: "registerExtension",
  description:
    "Register a single function as an extension method for a concrete type",

  expand(
    ctx: MacroContext,
    callExpr: ts.CallExpression,
    args: readonly ts.Expression[],
  ): ts.Expression {
    if (args.length < 2) {
      ctx.reportError(
        callExpr,
        "registerExtension() requires two arguments: a type name string and a function",
      );
      return ctx.factory.createVoidZero();
    }

    const typeNameArg = args[0];
    const fnArg = args[1];

    if (!ts.isStringLiteral(typeNameArg)) {
      ctx.reportError(
        typeNameArg,
        "First argument to registerExtension() must be a string literal",
      );
      return ctx.factory.createVoidZero();
    }
    const forType = typeNameArg.text;

    // The function name is the method name
    let methodName: string | undefined;
    if (ts.isIdentifier(fnArg)) {
      methodName = fnArg.text;
    }

    if (!methodName) {
      ctx.reportError(
        fnArg,
        "Second argument to registerExtension() must be a function identifier",
      );
      return ctx.factory.createVoidZero();
    }

    registerStandaloneExtensionEntry({
      methodName,
      forType,
      qualifier: undefined, // bare function call
    });

    return ctx.factory.createVoidZero();
  },
});

// ============================================================================
// AST generation helpers for call-site rewriting
// ============================================================================

/**
 * Build the AST for a standalone extension method call.
 *
 * Given `extend(receiver).method(args)` and a resolved StandaloneExtensionInfo,
 * generates either:
 *   - `Qualifier.method(receiver, args)` (if qualifier is set)
 *   - `method(receiver, args)` (if no qualifier — bare function)
 */
export function buildStandaloneExtensionCall(
  factory: ts.NodeFactory,
  ext: StandaloneExtensionInfo,
  receiver: ts.Expression,
  extraArgs: readonly ts.Expression[],
): ts.CallExpression {
  let callee: ts.Expression;
  if (ext.qualifier) {
    callee = factory.createPropertyAccessExpression(
      factory.createIdentifier(ext.qualifier),
      ext.methodName,
    );
  } else {
    callee = factory.createIdentifier(ext.methodName);
  }

  return factory.createCallExpression(callee, undefined, [
    receiver,
    ...extraArgs,
  ]);
}

// ============================================================================
// Registration
// ============================================================================

globalRegistry.register(registerExtensionsMacro);
globalRegistry.register(registerExtensionMacro);

// ============================================================================
// Exports
// ============================================================================

export { standaloneExtensionRegistry };
