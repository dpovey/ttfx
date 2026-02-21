/**
 * typesugar TypeScript Language Service Plugin (v2 - Transform-First)
 *
 * This plugin intercepts file reads and serves transformed code to TypeScript,
 * enabling full IDE support (completions, hover, go-to-definition) for
 * macro-generated code.
 *
 * Architecture:
 * 1. Intercept getScriptSnapshot to serve transformed code
 * 2. Map incoming positions (editor → transformed)
 * 3. Map outgoing positions (transformed → editor)
 *
 * Configure in tsconfig.json:
 * {
 *   "compilerOptions": {
 *     "plugins": [{ "name": "@typesugar/transformer/language-service" }]
 *   }
 * }
 */

import type * as ts from "typescript";
import * as path from "path";
import { TransformationPipeline, type TransformResult } from "./pipeline.js";
import { IdentityPositionMapper, type PositionMapper, type TextRange } from "./position-mapper.js";

/**
 * Cache entry for transformed files
 */
interface TransformCacheEntry {
  result: TransformResult;
  version: string;
}

function init(modules: { typescript: typeof ts }) {
  console.log("[typesugar] Language service plugin v2 (transform-first) initializing...");
  const tsModule = modules.typescript;

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    console.log(
      "[typesugar] Creating language service proxy for project:",
      info.project.getProjectName()
    );

    const log = (msg: string) => {
      info.project.projectService.logger.info(`[typesugar] ${msg}`);
    };

    log("typesugar language service plugin v2 initialized");

    // ---------------------------------------------------------------------------
    // Transform cache and pipeline
    // ---------------------------------------------------------------------------
    const transformCache = new Map<string, TransformCacheEntry>();
    let pipeline: TransformationPipeline | null = null;

    /**
     * Get or create the transformation pipeline
     */
    function getPipeline(): TransformationPipeline {
      if (!pipeline) {
        const compilerOptions = info.project.getCompilerOptions();
        const fileNames = info.project.getFileNames();

        log(`Initializing pipeline with ${fileNames.length} files`);

        pipeline = new TransformationPipeline(compilerOptions, fileNames, {
          verbose: false,
          readFile: (fileName: string): string | undefined => {
            // Read from the original host to avoid cyclic interception
            const snapshot = originalGetScriptSnapshot(fileName);
            if (snapshot) {
              return snapshot.getText(0, snapshot.getLength());
            }
            return undefined;
          },
          fileExists: (fileName: string): boolean => {
            return info.languageServiceHost.fileExists?.(fileName) ?? false;
          },
        });
      }
      return pipeline;
    }

    /**
     * Get the script version for cache invalidation
     */
    function getScriptVersion(fileName: string): string {
      return info.languageServiceHost.getScriptVersion(fileName);
    }

    /**
     * Transform a file and cache the result
     */
    function getTransformResult(fileName: string): TransformResult | null {
      const normalizedFileName = path.normalize(fileName);

      // Check if we should transform this file
      const p = getPipeline();
      if (!p.shouldTransform(normalizedFileName)) {
        return null;
      }

      // Check cache validity
      const currentVersion = getScriptVersion(normalizedFileName);
      const cached = transformCache.get(normalizedFileName);

      if (cached && cached.version === currentVersion) {
        return cached.result;
      }

      // Invalidate stale cache entry
      if (cached) {
        p.invalidate(normalizedFileName);
      }

      try {
        const result = p.transform(normalizedFileName);

        // Only cache if transformation actually changed the file
        if (result.changed) {
          transformCache.set(normalizedFileName, {
            result,
            version: currentVersion,
          });
          log(`Transformed ${normalizedFileName} (${result.code.length} chars)`);
        }

        return result;
      } catch (error) {
        log(`Transform error for ${normalizedFileName}: ${error}`);
        return null;
      }
    }

    /**
     * Get the position mapper for a file
     */
    function getMapper(fileName: string): PositionMapper {
      const result = getTransformResult(fileName);
      return result?.mapper ?? new IdentityPositionMapper();
    }

    // ---------------------------------------------------------------------------
    // Intercept LanguageServiceHost.getScriptSnapshot
    // ---------------------------------------------------------------------------
    const originalGetScriptSnapshot = info.languageServiceHost.getScriptSnapshot.bind(
      info.languageServiceHost
    );

    info.languageServiceHost.getScriptSnapshot = (
      fileName: string
    ): ts.IScriptSnapshot | undefined => {
      const result = getTransformResult(fileName);

      if (result && result.changed) {
        // Return transformed code as a script snapshot
        return tsModule.ScriptSnapshot.fromString(result.code);
      }

      // Fall back to original snapshot
      return originalGetScriptSnapshot(fileName);
    };

    // ---------------------------------------------------------------------------
    // Create proxy for LanguageService methods
    // ---------------------------------------------------------------------------
    const proxy = Object.create(null) as ts.LanguageService;
    const oldLS = info.languageService;

    // Copy all methods from the original language service
    for (const k of Object.keys(oldLS)) {
      const prop = (oldLS as unknown as Record<string, unknown>)[k];
      if (typeof prop === "function") {
        (proxy as unknown as Record<string, unknown>)[k] = (...args: unknown[]): unknown => {
          return (prop as Function).apply(oldLS, args);
        };
      }
    }

    // ---------------------------------------------------------------------------
    // Override: Diagnostic methods (map positions back to original)
    // ---------------------------------------------------------------------------

    /**
     * Map a single diagnostic's positions back to original source
     */
    function mapDiagnostic(diag: ts.Diagnostic, mapper: PositionMapper): ts.Diagnostic | null {
      if (diag.start === undefined) return diag;

      const originalStart = mapper.toOriginal(diag.start);

      // If we can't map the position, it's in macro-generated code — suppress it
      if (originalStart === null) {
        return null;
      }

      // Map the length as well
      let originalLength = diag.length;
      if (diag.length !== undefined) {
        const originalEnd = mapper.toOriginal(diag.start + diag.length);
        if (originalEnd !== null) {
          originalLength = Math.max(1, originalEnd - originalStart);
        }
      }

      return {
        ...diag,
        start: originalStart,
        length: originalLength,
      };
    }

    /**
     * Map an array of diagnostics
     */
    function mapDiagnostics<T extends ts.Diagnostic>(
      diagnostics: readonly T[],
      fileName: string
    ): T[] {
      const mapper = getMapper(fileName);
      const mapped: T[] = [];

      for (const diag of diagnostics) {
        const mappedDiag = mapDiagnostic(diag, mapper);
        if (mappedDiag !== null) {
          mapped.push(mappedDiag as T);
        }
      }

      return mapped;
    }

    proxy.getSemanticDiagnostics = (fileName: string): ts.Diagnostic[] => {
      const diagnostics = oldLS.getSemanticDiagnostics(fileName);
      return mapDiagnostics(diagnostics, fileName);
    };

    proxy.getSyntacticDiagnostics = (fileName: string): ts.DiagnosticWithLocation[] => {
      const diagnostics = oldLS.getSyntacticDiagnostics(fileName);
      return mapDiagnostics(diagnostics, fileName);
    };

    proxy.getSuggestionDiagnostics = (fileName: string): ts.DiagnosticWithLocation[] => {
      const diagnostics = oldLS.getSuggestionDiagnostics(fileName);
      return mapDiagnostics(diagnostics, fileName);
    };

    // ---------------------------------------------------------------------------
    // Override: Position-based IDE features (map positions bidirectionally)
    // ---------------------------------------------------------------------------

    /**
     * Map a TextSpan back to original coordinates
     */
    function mapTextSpanToOriginal(span: ts.TextSpan, mapper: PositionMapper): ts.TextSpan | null {
      const originalStart = mapper.toOriginal(span.start);
      if (originalStart === null) return null;

      const originalEnd = mapper.toOriginal(span.start + span.length);
      const originalLength =
        originalEnd !== null ? Math.max(1, originalEnd - originalStart) : span.length;

      return { start: originalStart, length: originalLength };
    }

    proxy.getCompletionsAtPosition = (
      fileName: string,
      position: number,
      options: ts.GetCompletionsAtPositionOptions | undefined
    ): ts.WithMetadata<ts.CompletionInfo> | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        log(`getCompletionsAtPosition: could not map position ${position} in ${fileName}`);
        return undefined;
      }

      const result = oldLS.getCompletionsAtPosition(fileName, transformedPosition, options);

      if (!result) return result;

      // Map replacement spans back to original coordinates
      const mappedEntries = result.entries.map((entry) => {
        if (entry.replacementSpan) {
          const mappedSpan = mapTextSpanToOriginal(entry.replacementSpan, mapper);
          if (mappedSpan) {
            return { ...entry, replacementSpan: mappedSpan };
          }
        }
        return entry;
      });

      return {
        ...result,
        entries: mappedEntries,
      };
    };

    proxy.getQuickInfoAtPosition = (
      fileName: string,
      position: number
    ): ts.QuickInfo | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        log(`getQuickInfoAtPosition: could not map position ${position} in ${fileName}`);
        return undefined;
      }

      const result = oldLS.getQuickInfoAtPosition(fileName, transformedPosition);

      if (!result) return result;

      // Map the textSpan back to original coordinates
      const mappedSpan = mapTextSpanToOriginal(result.textSpan, mapper);
      if (!mappedSpan) return undefined;

      return {
        ...result,
        textSpan: mappedSpan,
      };
    };

    proxy.getDefinitionAtPosition = (
      fileName: string,
      position: number
    ): readonly ts.DefinitionInfo[] | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        log(`getDefinitionAtPosition: could not map position ${position} in ${fileName}`);
        return undefined;
      }

      const definitions = oldLS.getDefinitionAtPosition(fileName, transformedPosition);

      if (!definitions) return definitions;

      // Map each definition's textSpan back to original coordinates
      // Note: definitions may point to different files, so we need per-file mappers
      return definitions.map((def) => {
        const targetMapper = getMapper(def.fileName);
        const mappedSpan = mapTextSpanToOriginal(def.textSpan, targetMapper);

        if (!mappedSpan) {
          // Can't map — return original (best effort)
          return def;
        }

        let mappedContextSpan = def.contextSpan;
        if (def.contextSpan) {
          mappedContextSpan =
            mapTextSpanToOriginal(def.contextSpan, targetMapper) ?? def.contextSpan;
        }

        return {
          ...def,
          textSpan: mappedSpan,
          contextSpan: mappedContextSpan,
        };
      });
    };

    proxy.getDefinitionAndBoundSpan = (
      fileName: string,
      position: number
    ): ts.DefinitionInfoAndBoundSpan | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        log(`getDefinitionAndBoundSpan: could not map position ${position} in ${fileName}`);
        return undefined;
      }

      const result = oldLS.getDefinitionAndBoundSpan(fileName, transformedPosition);

      if (!result) return result;

      // Map the textSpan (the "bound span" that gets highlighted)
      const mappedTextSpan = mapTextSpanToOriginal(result.textSpan, mapper);
      if (!mappedTextSpan) return undefined;

      // Map each definition's spans
      const mappedDefinitions = result.definitions?.map((def) => {
        const targetMapper = getMapper(def.fileName);
        const mappedDefSpan = mapTextSpanToOriginal(def.textSpan, targetMapper);

        if (!mappedDefSpan) return def;

        let mappedContextSpan = def.contextSpan;
        if (def.contextSpan) {
          mappedContextSpan =
            mapTextSpanToOriginal(def.contextSpan, targetMapper) ?? def.contextSpan;
        }

        return {
          ...def,
          textSpan: mappedDefSpan,
          contextSpan: mappedContextSpan,
        };
      });

      return {
        textSpan: mappedTextSpan,
        definitions: mappedDefinitions,
      };
    };

    proxy.getTypeDefinitionAtPosition = (
      fileName: string,
      position: number
    ): readonly ts.DefinitionInfo[] | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        return undefined;
      }

      const definitions = oldLS.getTypeDefinitionAtPosition(fileName, transformedPosition);

      if (!definitions) return definitions;

      return definitions.map((def) => {
        const targetMapper = getMapper(def.fileName);
        const mappedSpan = mapTextSpanToOriginal(def.textSpan, targetMapper);

        if (!mappedSpan) return def;

        let mappedContextSpan = def.contextSpan;
        if (def.contextSpan) {
          mappedContextSpan =
            mapTextSpanToOriginal(def.contextSpan, targetMapper) ?? def.contextSpan;
        }

        return {
          ...def,
          textSpan: mappedSpan,
          contextSpan: mappedContextSpan,
        };
      });
    };

    proxy.getReferencesAtPosition = (
      fileName: string,
      position: number
    ): ts.ReferenceEntry[] | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        return undefined;
      }

      const references = oldLS.getReferencesAtPosition(fileName, transformedPosition);

      if (!references) return references;

      const mapped: ts.ReferenceEntry[] = [];
      for (const ref of references) {
        const targetMapper = getMapper(ref.fileName);
        const mappedSpan = mapTextSpanToOriginal(ref.textSpan, targetMapper);

        if (!mappedSpan) continue;

        const result: ts.ReferenceEntry = {
          ...ref,
          textSpan: mappedSpan,
        };

        if (ref.contextSpan) {
          result.contextSpan =
            mapTextSpanToOriginal(ref.contextSpan, targetMapper) ?? ref.contextSpan;
        }

        mapped.push(result);
      }

      return mapped;
    };

    proxy.findReferences = (
      fileName: string,
      position: number
    ): ts.ReferencedSymbol[] | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        return undefined;
      }

      const symbols = oldLS.findReferences(fileName, transformedPosition);

      if (!symbols) return symbols;

      return symbols.map((symbol) => {
        // Map the definition span
        const defMapper = getMapper(symbol.definition.fileName);
        const mappedDefSpan = mapTextSpanToOriginal(symbol.definition.textSpan, defMapper);

        const mappedDef: ts.ReferencedSymbolDefinitionInfo = {
          ...symbol.definition,
          textSpan: mappedDefSpan ?? symbol.definition.textSpan,
        };

        if (symbol.definition.contextSpan) {
          mappedDef.contextSpan =
            mapTextSpanToOriginal(symbol.definition.contextSpan, defMapper) ??
            symbol.definition.contextSpan;
        }

        // Map all references
        const mappedReferences: ts.ReferencedSymbolEntry[] = [];
        for (const ref of symbol.references) {
          const refMapper = getMapper(ref.fileName);
          const mappedRefSpan = mapTextSpanToOriginal(ref.textSpan, refMapper);

          if (!mappedRefSpan) continue;

          const mappedRef: ts.ReferencedSymbolEntry = {
            ...ref,
            textSpan: mappedRefSpan,
          };

          if (ref.contextSpan) {
            mappedRef.contextSpan =
              mapTextSpanToOriginal(ref.contextSpan, refMapper) ?? ref.contextSpan;
          }

          mappedReferences.push(mappedRef);
        }

        return {
          definition: mappedDef,
          references: mappedReferences,
        };
      });
    };

    proxy.getSignatureHelpItems = (
      fileName: string,
      position: number,
      options: ts.SignatureHelpItemsOptions | undefined
    ): ts.SignatureHelpItems | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        return undefined;
      }

      const result = oldLS.getSignatureHelpItems(fileName, transformedPosition, options);

      if (!result) return result;

      // Map the applicableSpan back to original coordinates
      const mappedApplicableSpan = mapTextSpanToOriginal(result.applicableSpan, mapper);

      return {
        ...result,
        applicableSpan: mappedApplicableSpan ?? result.applicableSpan,
      };
    };

    proxy.getRenameInfo = (
      fileName: string,
      position: number,
      options?: ts.RenameInfoOptions
    ): ts.RenameInfo => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        return {
          canRename: false,
          localizedErrorMessage: "Cannot rename in macro-generated code",
        };
      }

      const result = oldLS.getRenameInfo(fileName, transformedPosition, options);

      if (!result.canRename) return result;

      // Map the triggerSpan back to original coordinates
      const mappedTriggerSpan = mapTextSpanToOriginal(result.triggerSpan, mapper);

      if (!mappedTriggerSpan) {
        return {
          canRename: false,
          localizedErrorMessage: "Cannot rename macro-generated identifier",
        };
      }

      return {
        ...result,
        triggerSpan: mappedTriggerSpan,
      };
    };

    proxy.findRenameLocations = (
      fileName: string,
      position: number,
      findInStrings: boolean,
      findInComments: boolean,
      preferences?: boolean | ts.UserPreferences
    ): readonly ts.RenameLocation[] | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        return undefined;
      }

      // Handle both overload forms of the API
      const locations =
        typeof preferences === "object"
          ? oldLS.findRenameLocations(
              fileName,
              transformedPosition,
              findInStrings,
              findInComments,
              preferences
            )
          : oldLS.findRenameLocations(
              fileName,
              transformedPosition,
              findInStrings,
              findInComments,
              preferences as boolean | undefined
            );

      if (!locations) return locations;

      const mapped: ts.RenameLocation[] = [];
      for (const loc of locations) {
        const targetMapper = getMapper(loc.fileName);
        const mappedSpan = mapTextSpanToOriginal(loc.textSpan, targetMapper);

        if (!mappedSpan) continue;

        const result: ts.RenameLocation = {
          ...loc,
          textSpan: mappedSpan,
        };

        if (loc.contextSpan) {
          result.contextSpan =
            mapTextSpanToOriginal(loc.contextSpan, targetMapper) ?? loc.contextSpan;
        }

        mapped.push(result);
      }

      return mapped;
    };

    proxy.getDocumentHighlights = (
      fileName: string,
      position: number,
      filesToSearch: string[]
    ): ts.DocumentHighlights[] | undefined => {
      const mapper = getMapper(fileName);
      const transformedPosition = mapper.toTransformed(position);

      if (transformedPosition === null) {
        return undefined;
      }

      const highlights = oldLS.getDocumentHighlights(fileName, transformedPosition, filesToSearch);

      if (!highlights) return highlights;

      return highlights.map((docHighlight) => {
        const targetMapper = getMapper(docHighlight.fileName);

        const mappedSpans: ts.HighlightSpan[] = [];
        for (const span of docHighlight.highlightSpans) {
          const mappedTextSpan = mapTextSpanToOriginal(span.textSpan, targetMapper);
          if (!mappedTextSpan) continue;

          const result: ts.HighlightSpan = {
            ...span,
            textSpan: mappedTextSpan,
          };

          if (span.contextSpan) {
            result.contextSpan =
              mapTextSpanToOriginal(span.contextSpan, targetMapper) ?? span.contextSpan;
          }

          mappedSpans.push(result);
        }

        return {
          fileName: docHighlight.fileName,
          highlightSpans: mappedSpans,
        };
      });
    };

    log("Language service proxy created with transform-first architecture");

    return proxy;
  }

  return { create };
}

export default init;
