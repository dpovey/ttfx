/**
 * Core module exports for @ttfx/core
 */

export * from "./types.js";
export * from "./registry.js";
export * from "./context.js";

// Re-export commonly used types for convenience
export type {
  MacroKind,
  MacroContext,
  ComptimeValue,
  MacroDefinition,
  ExpressionMacro,
  AttributeMacro,
  DeriveMacro,
  TaggedTemplateMacroDef,
  TypeMacro,
  LabeledBlockMacro,
  MacroRegistry,
  DeriveTypeInfo,
  DeriveFieldInfo,
  ExtensionMethodInfo,
  ExtensionMethodRegistry,
} from "./types.js";
