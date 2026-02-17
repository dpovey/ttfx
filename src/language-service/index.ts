/**
 * typemacro TypeScript Language Service Plugin
 *
 * Provides IDE integration for typemacro:
 * - Suppresses false-positive diagnostics from macro invocations
 * - Adds custom diagnostics for macro errors
 * - Provides completions inside @derive() decorators
 * - Shows macro expansion info on hover
 *
 * Configure in tsconfig.json:
 * {
 *   "compilerOptions": {
 *     "plugins": [{ "name": "typemacro/language-service" }]
 *   }
 * }
 */

import type * as ts from "typescript";

/** Known expression macro names from the typemacro core */
const EXPRESSION_MACROS = new Set([
  "comptime",
  "ops",
  "pipe",
  "compose",
  "summon",
  "extend",
  "typeInfo",
  "fieldNames",
  "validator",
]);

/**
 * Known typeclass method names and their providing typeclasses.
 * Used by the language service to detect implicit extension method calls
 * and suppress false "Property does not exist" diagnostics.
 *
 * Maps method name → { typeclass, extraParams, returnType }
 */
const TYPECLASS_EXTENSION_METHODS: Record<
  string,
  { typeclass: string; description: string; returnType: string }
> = {
  show: {
    typeclass: "Show",
    description: "Convert to a human-readable string representation",
    returnType: "string",
  },
  eq: {
    typeclass: "Eq",
    description: "Check equality with another value",
    returnType: "boolean",
  },
  neq: {
    typeclass: "Eq",
    description: "Check inequality with another value",
    returnType: "boolean",
  },
  compare: {
    typeclass: "Ord",
    description: "Compare ordering with another value (-1, 0, or 1)",
    returnType: "-1 | 0 | 1",
  },
  hash: {
    typeclass: "Hash",
    description: "Compute a hash code for this value",
    returnType: "number",
  },
  combine: {
    typeclass: "Semigroup",
    description: "Combine with another value using the Semigroup operation",
    returnType: "self",
  },
  empty: {
    typeclass: "Monoid",
    description: "Get the identity element for this type",
    returnType: "self",
  },
  map: {
    typeclass: "Functor",
    description: "Apply a function to the contained value(s)",
    returnType: "self",
  },
};

/** Set of all known extension method names for quick lookup */
const EXTENSION_METHOD_NAMES = new Set(
  Object.keys(TYPECLASS_EXTENSION_METHODS),
);

/** Known decorator macro names */
const DECORATOR_MACROS = new Set([
  "derive",
  "operators",
  "reflect",
  "typeclass",
  "instance",
  "deriving",
  "inline",
]);

/** Known derive macro names */
const DERIVE_MACROS = [
  { name: "Eq", description: "Generate equality comparison function" },
  { name: "Ord", description: "Generate ordering/comparison function" },
  { name: "Clone", description: "Generate deep clone function" },
  { name: "Debug", description: "Generate debug string representation" },
  { name: "Hash", description: "Generate hash function" },
  { name: "Default", description: "Generate default value factory" },
  { name: "Json", description: "Generate JSON serialization/deserialization" },
  { name: "Builder", description: "Generate builder pattern class" },
];

/** Known tagged template macro names */
const TAGGED_TEMPLATE_MACROS = new Set([
  "sql",
  "regex",
  "html",
  "fmt",
  "json",
  "raw",
  "units",
]);

/** Diagnostic codes that are commonly false positives from macro usage */
const SUPPRESSED_DIAGNOSTIC_CODES = new Set([
  // "Decorators are not valid here" -- interfaces with @derive
  1206,
  // "An expression of type 'void' cannot be tested for truthiness" -- macro returns
  1345,
  // "'XYZ' is declared but its value is never read" -- macro-generated bindings
  6133,
  // "Cannot find name 'XYZ'" -- references to macro-generated identifiers
  2304,
  // "Property 'X' does not exist on type 'Y'" -- extension methods
  2339,
]);

function init(modules: { typescript: typeof ts }) {
  const tsModule = modules.typescript;

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const log = (msg: string) => {
      info.project.projectService.logger.info(`[typemacro] ${msg}`);
    };

    log("Language service plugin initialized");

    const proxy = Object.create(null) as ts.LanguageService;
    const oldLS = info.languageService;

    // Create pass-through proxy for all methods
    for (const k of Object.keys(oldLS)) {
      const prop = (oldLS as unknown as Record<string, unknown>)[k];
      if (typeof prop === "function") {
        (proxy as unknown as Record<string, unknown>)[k] = (
          ...args: unknown[]
        ): unknown => {
          return (prop as Function).apply(oldLS, args);
        };
      }
    }

    // -----------------------------------------------------------------------
    // Override: getSemanticDiagnostics
    // Suppress false positives from macro invocations
    // -----------------------------------------------------------------------
    proxy.getSemanticDiagnostics = (fileName: string): ts.Diagnostic[] => {
      const diagnostics = oldLS.getSemanticDiagnostics(fileName);
      const program = oldLS.getProgram();
      if (!program) return diagnostics;

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return diagnostics;

      return diagnostics.filter((diag) => {
        // Always keep diagnostics that aren't from our suppression list
        if (!SUPPRESSED_DIAGNOSTIC_CODES.has(diag.code)) return true;

        // Check if the diagnostic is near a macro invocation
        if (diag.start === undefined) return true;

        const node = findNodeAtPosition(tsModule, sourceFile, diag.start);
        if (!node) return true;

        // Suppress "Decorators are not valid here" on macro decorators
        if (diag.code === 1206) {
          const decorator = findAncestor(tsModule, node, tsModule.isDecorator);
          if (decorator && tsModule.isDecorator(decorator)) {
            const name = getDecoratorName(tsModule, decorator as ts.Decorator);
            if (name && DECORATOR_MACROS.has(name)) {
              log(`Suppressed diagnostic ${diag.code} for @${name}`);
              return false;
            }
          }
        }

        // Suppress "Cannot find name" for macro-generated identifiers
        if (diag.code === 2304) {
          if (isNearMacroInvocation(tsModule, sourceFile, node)) {
            log(`Suppressed diagnostic ${diag.code} near macro invocation`);
            return false;
          }
        }

        // Suppress "Property 'X' does not exist on type 'Y'" for extension methods
        if (diag.code === 2339) {
          if (isExtensionMethodCall(tsModule, sourceFile, node)) {
            log(`Suppressed diagnostic ${diag.code} for extension method call`);
            return false;
          }
        }

        return true;
      });
    };

    // -----------------------------------------------------------------------
    // Override: getCompletionsAtPosition
    // Provide completions inside @derive() and other macro contexts
    // -----------------------------------------------------------------------
    proxy.getCompletionsAtPosition = (
      fileName: string,
      position: number,
      options: ts.GetCompletionsAtPositionOptions | undefined,
    ): ts.WithMetadata<ts.CompletionInfo> | undefined => {
      const prior = oldLS.getCompletionsAtPosition(fileName, position, options);

      const program = oldLS.getProgram();
      if (!program) return prior;

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return prior;

      const node = findNodeAtPosition(tsModule, sourceFile, position);
      if (!node) return prior;

      // Check if we're inside a @derive() call
      const deriveContext = findDeriveContext(tsModule, node);
      if (deriveContext) {
        const deriveEntries: ts.CompletionEntry[] = DERIVE_MACROS.map(
          (macro) => ({
            name: macro.name,
            kind: tsModule.ScriptElementKind.constElement,
            kindModifiers: "",
            sortText: `0${macro.name}`,
            labelDetails: {
              description: macro.description,
            },
          }),
        );

        if (prior) {
          return {
            ...prior,
            entries: [...deriveEntries, ...prior.entries],
          };
        }

        return {
          isGlobalCompletion: false,
          isMemberCompletion: false,
          isNewIdentifierLocation: false,
          entries: deriveEntries,
        };
      }

      // Check if we're in a member access position (x.|) where extension
      // methods should be suggested
      const extensionEntries = getExtensionMethodCompletions(
        tsModule,
        sourceFile,
        node,
        program,
      );
      if (extensionEntries.length > 0) {
        if (prior) {
          return {
            ...prior,
            entries: [...extensionEntries, ...prior.entries],
          };
        }

        return {
          isGlobalCompletion: false,
          isMemberCompletion: true,
          isNewIdentifierLocation: false,
          entries: extensionEntries,
        };
      }

      return prior;
    };

    // -----------------------------------------------------------------------
    // Override: getQuickInfoAtPosition
    // Show macro info on hover
    // -----------------------------------------------------------------------
    proxy.getQuickInfoAtPosition = (
      fileName: string,
      position: number,
    ): ts.QuickInfo | undefined => {
      const prior = oldLS.getQuickInfoAtPosition(fileName, position);

      const program = oldLS.getProgram();
      if (!program) return prior;

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return prior;

      const node = findNodeAtPosition(tsModule, sourceFile, position);
      if (!node) return prior;

      if (tsModule.isIdentifier(node)) {
        const name = node.text;

        if (EXPRESSION_MACROS.has(name)) {
          return {
            kind: tsModule.ScriptElementKind.functionElement,
            kindModifiers: "typemacro",
            textSpan: {
              start: node.getStart(sourceFile),
              length: node.getWidth(sourceFile),
            },
            displayParts: [
              {
                text: `(typemacro expression macro) ${name}`,
                kind: "text",
              },
            ],
            documentation: [
              {
                text: "This call is expanded at compile time by the typemacro transformer.",
                kind: "text",
              },
            ],
          };
        }

        if (DECORATOR_MACROS.has(name)) {
          return {
            kind: tsModule.ScriptElementKind.functionElement,
            kindModifiers: "typemacro",
            textSpan: {
              start: node.getStart(sourceFile),
              length: node.getWidth(sourceFile),
            },
            displayParts: [
              {
                text: `(typemacro decorator macro) @${name}`,
                kind: "text",
              },
            ],
            documentation: [
              {
                text: "This decorator is processed at compile time by the typemacro transformer.",
                kind: "text",
              },
            ],
          };
        }

        if (TAGGED_TEMPLATE_MACROS.has(name)) {
          return {
            kind: tsModule.ScriptElementKind.functionElement,
            kindModifiers: "typemacro",
            textSpan: {
              start: node.getStart(sourceFile),
              length: node.getWidth(sourceFile),
            },
            displayParts: [
              {
                text: `(typemacro tagged template macro) ${name}\`...\``,
                kind: "text",
              },
            ],
            documentation: [
              {
                text: "This tagged template is processed at compile time by the typemacro transformer.",
                kind: "text",
              },
            ],
          };
        }

        // Check if this is an extension method call (e.g., x.show())
        const extInfo = getExtensionMethodHoverInfo(
          tsModule,
          sourceFile,
          node,
          program,
        );
        if (extInfo) {
          return {
            kind: tsModule.ScriptElementKind.memberFunctionElement,
            kindModifiers: "typemacro extension",
            textSpan: {
              start: node.getStart(sourceFile),
              length: node.getWidth(sourceFile),
            },
            displayParts: [
              {
                text: extInfo.displayText,
                kind: "text",
              },
            ],
            documentation: [
              {
                text: extInfo.documentation,
                kind: "text",
              },
            ],
          };
        }
      }

      return prior;
    };

    return proxy;
  }

  return { create };
}

// ---------------------------------------------------------------------------
// AST Utility Functions
// ---------------------------------------------------------------------------

function findNodeAtPosition(
  ts: typeof import("typescript"),
  sourceFile: ts.SourceFile,
  position: number,
): ts.Node | undefined {
  function find(node: ts.Node): ts.Node | undefined {
    if (position >= node.getStart(sourceFile) && position < node.getEnd()) {
      return ts.forEachChild(node, find) ?? node;
    }
    return undefined;
  }
  return find(sourceFile);
}

function findAncestor(
  ts: typeof import("typescript"),
  node: ts.Node,
  predicate: (node: ts.Node) => boolean,
): ts.Node | undefined {
  let current: ts.Node | undefined = node;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function getDecoratorName(
  ts: typeof import("typescript"),
  decorator: ts.Decorator,
): string | undefined {
  const expr = decorator.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    return expr.expression.text;
  }
  return undefined;
}

function findDeriveContext(
  ts: typeof import("typescript"),
  node: ts.Node,
): boolean {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isCallExpression(current)) {
      if (
        ts.isIdentifier(current.expression) &&
        current.expression.text === "derive"
      ) {
        return true;
      }
    }
    if (ts.isDecorator(current)) {
      const name = getDecoratorName(ts, current);
      if (name === "derive") return true;
    }
    current = current.parent;
  }
  return false;
}

function isNearMacroInvocation(
  ts: typeof import("typescript"),
  sourceFile: ts.SourceFile,
  node: ts.Node,
): boolean {
  // Walk up to find if this node is inside or adjacent to a macro call
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isCallExpression(current)) {
      if (ts.isIdentifier(current.expression)) {
        if (EXPRESSION_MACROS.has(current.expression.text)) return true;
      }
    }
    if (ts.isTaggedTemplateExpression(current)) {
      if (ts.isIdentifier(current.tag)) {
        if (TAGGED_TEMPLATE_MACROS.has(current.tag.text)) return true;
      }
    }
    // Check siblings in the same block for macro-generated code
    if (ts.isBlock(current) || ts.isSourceFile(current)) {
      for (const stmt of current.statements ?? []) {
        if (
          ts.isExpressionStatement(stmt) &&
          ts.isCallExpression(stmt.expression)
        ) {
          if (ts.isIdentifier(stmt.expression.expression)) {
            if (EXPRESSION_MACROS.has(stmt.expression.expression.text))
              return true;
          }
        }
      }
    }
    current = current.parent;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Extension Method Support
// ---------------------------------------------------------------------------

/**
 * Check if a node is an extension method call.
 * Used to suppress "Property 'X' does not exist on type 'Y'" diagnostics
 * when X is a known typeclass extension method.
 *
 * Detects patterns like: identifier.extensionMethod(...)
 * where extensionMethod is a known typeclass method name.
 */
function isExtensionMethodCall(
  ts: typeof import("typescript"),
  sourceFile: ts.SourceFile,
  node: ts.Node,
): boolean {
  // The diagnostic node is typically the property name identifier.
  // Check if it's a known extension method name.
  if (ts.isIdentifier(node) && EXTENSION_METHOD_NAMES.has(node.text)) {
    // Verify it's in a property access position (x.show)
    const parent = node.parent;
    if (parent && ts.isPropertyAccessExpression(parent)) {
      // Verify the parent is a call expression (x.show())
      const grandParent = parent.parent;
      if (grandParent && ts.isCallExpression(grandParent)) {
        return true;
      }
      // Also suppress for bare property access (x.show without call)
      // since the user might be mid-typing
      return true;
    }
  }

  // Also check the diagnostic message text for the property name
  // (TS sometimes points to the property access expression itself)
  if (ts.isPropertyAccessExpression(node)) {
    if (EXTENSION_METHOD_NAMES.has(node.name.text)) {
      return true;
    }
  }

  return false;
}

/**
 * Get completion entries for extension methods at a member access position.
 * When the user types `x.` on a value that has derived typeclasses,
 * this injects the extension methods into the completion list.
 */
function getExtensionMethodCompletions(
  ts: typeof import("typescript"),
  sourceFile: ts.SourceFile,
  node: ts.Node,
  program: ts.Program | undefined,
): ts.CompletionEntry[] {
  if (!program) return [];

  // Check if we're at a property access position (after a dot)
  // The node might be the identifier being typed, or the dot itself
  let propAccess: ts.PropertyAccessExpression | undefined;

  if (ts.isPropertyAccessExpression(node)) {
    propAccess = node;
  } else if (node.parent && ts.isPropertyAccessExpression(node.parent)) {
    propAccess = node.parent;
  }

  if (!propAccess) return [];

  // Get the type of the receiver (the expression before the dot)
  const checker = program.getTypeChecker();
  const receiverType = checker.getTypeAtLocation(propAccess.expression);

  // Check which extension methods are NOT already native properties
  const entries: ts.CompletionEntry[] = [];

  for (const [methodName, info] of Object.entries(
    TYPECLASS_EXTENSION_METHODS,
  )) {
    // Skip if this property already exists natively on the type
    const existingProp = receiverType.getProperty(methodName);
    if (existingProp) continue;

    const returnType =
      info.returnType === "self"
        ? checker.typeToString(receiverType)
        : info.returnType;

    entries.push({
      name: methodName,
      kind: ts.ScriptElementKind.memberFunctionElement,
      kindModifiers: "typemacro",
      sortText: `1_ext_${methodName}`,
      labelDetails: {
        description: `(extension via ${info.typeclass}) → ${returnType}`,
      },
    });
  }

  return entries;
}

/**
 * Get hover information for an extension method.
 * Shows the typeclass, signature, and description when hovering
 * over an extension method call like `x.show()`.
 */
function getExtensionMethodHoverInfo(
  ts: typeof import("typescript"),
  sourceFile: ts.SourceFile,
  node: ts.Identifier,
  program: ts.Program | undefined,
): { displayText: string; documentation: string } | undefined {
  if (!program) return undefined;

  const methodName = node.text;
  const info = TYPECLASS_EXTENSION_METHODS[methodName];
  if (!info) return undefined;

  // Check if this identifier is in a property access position
  const parent = node.parent;
  if (!parent || !ts.isPropertyAccessExpression(parent)) return undefined;

  // Verify the property doesn't exist natively (confirming it's an extension)
  const checker = program.getTypeChecker();
  const receiverType = checker.getTypeAtLocation(parent.expression);
  const existingProp = receiverType.getProperty(methodName);
  if (existingProp) return undefined;

  const typeName = checker.typeToString(receiverType);
  const returnType = info.returnType === "self" ? typeName : info.returnType;

  return {
    displayText: `(extension method via ${info.typeclass}) ${typeName}.${methodName}(): ${returnType}`,
    documentation:
      `${info.description}\n\n` +
      `Provided by the ${info.typeclass} typeclass. ` +
      `At compile time, this is rewritten to:\n` +
      `  ${info.typeclass}.summon<${typeName}>("${typeName}").${methodName}(...)`,
  };
}

// TS language service plugins use CommonJS module.exports = init pattern.
// tsup handles the CJS/ESM interop, so we use default export here.
export default init;
