/**
 * TypeScript Language Service Plugin for typesugar
 *
 * This plugin delegates to @typesugar/transformer's language service
 * implementation, which transforms source files before TypeScript processes them.
 *
 * Key features:
 * - Transforms custom syntax (|>, ::, F<_>) to valid TypeScript
 * - Expands macros (@derive, comptime, etc.)
 * - Maps diagnostics, completions, and definitions back to original positions
 * - Caches transformation results for performance
 */

import type * as ts from "typescript";

function init(modules: { typescript: typeof ts }) {
  // Delegate to the transformer's language service implementation
  const transformerPlugin = require("@typesugar/transformer/language-service");
  const initFn = transformerPlugin.default || transformerPlugin;
  return initFn(modules);
}

export = init;
