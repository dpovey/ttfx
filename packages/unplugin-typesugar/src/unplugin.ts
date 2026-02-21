/**
 * typesugar unplugin integration
 *
 * Universal plugin that works with Vite, Rollup, Webpack, esbuild, and Rspack.
 * Uses the TypeScript compiler API to create a Program, then runs the macro
 * transformer on each .ts/.tsx file during the build.
 *
 * The plugin has two stages:
 * 1. `load` hook: Pre-processes custom syntax (F<_> HKT, |>, ::) to valid TypeScript
 * 2. `transform` hook: Runs the full macro transformer (AST-based)
 *
 * This two-stage approach is necessary because custom syntax like F<_> is not valid
 * TypeScript syntax, and esbuild (used by Vite) would fail to parse it before our
 * transform runs.
 *
 * KNOWN LIMITATION: Type-Aware Transformation
 * ===========================================
 * Currently, the TypeScript Program is created at buildStart with the original
 * source files. Preprocessing happens later in the load hook. This means the
 * type checker sees original content, not preprocessed content.
 *
 * TODO: Fix this by preprocessing files BEFORE creating the Program, using a
 * custom CompilerHost that serves preprocessed content. This would give full
 * type-aware transformation support. See docs/PLAN-implicit-operators.md for
 * the implementation plan.
 */

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import { createUnplugin, type UnpluginFactory } from "unplugin";
import remapping from "@ampproject/remapping";
import macroTransformerFactory, { type MacroTransformerConfig } from "@typesugar/transformer";
import { preprocess, type RawSourceMap } from "@typesugar/preprocessor";
import { globalExpansionTracker } from "@typesugar/core";

export interface TypesugarPluginOptions {
  /** Path to tsconfig.json (default: auto-detected) */
  tsconfig?: string;

  /** File patterns to include (default: /\.[jt]sx?$/) */
  include?: RegExp | string[];

  /** File patterns to exclude (default: /node_modules/) */
  exclude?: RegExp | string[];

  /** Enable verbose logging */
  verbose?: boolean;
}

interface ProgramCache {
  program: ts.Program;
  host: ts.CompilerHost;
  config: ts.ParsedCommandLine;
}

function findTsConfig(cwd: string, explicit?: string): string {
  if (explicit) {
    return path.resolve(cwd, explicit);
  }

  const found = ts.findConfigFile(cwd, ts.sys.fileExists, "tsconfig.json");
  if (!found) {
    throw new Error(
      `[typesugar] Could not find tsconfig.json from ${cwd}. ` +
        `Pass the tsconfig option to specify the path explicitly.`
    );
  }
  return found;
}

function createProgram(configPath: string): ProgramCache {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `[typesugar] Error reading ${configPath}: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`
    );
  }

  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

  const host = ts.createCompilerHost(config.options);
  const program = ts.createProgram(config.fileNames, config.options, host);

  return { program, host, config };
}

function shouldTransform(
  id: string,
  include?: RegExp | string[],
  exclude?: RegExp | string[]
): boolean {
  const normalizedId = id.replace(/\\/g, "/");

  // Check exclude first
  if (exclude) {
    if (exclude instanceof RegExp) {
      if (exclude.test(normalizedId)) return false;
    } else {
      if (exclude.some((pattern) => normalizedId.includes(pattern))) return false;
    }
  } else {
    if (/node_modules/.test(normalizedId)) return false;
  }

  // Check include
  if (include) {
    if (include instanceof RegExp) {
      return include.test(normalizedId);
    }
    return include.some((pattern) => normalizedId.includes(pattern));
  }

  return /\.[jt]sx?$/.test(normalizedId);
}

export const unpluginFactory: UnpluginFactory<TypesugarPluginOptions | undefined> = (
  options = {}
) => {
  let cache: ProgramCache | undefined;
  const verbose = options?.verbose ?? false;

  // Cache preprocessed results so we can create source files from preprocessed content
  const preprocessedFiles = new Map<string, ReturnType<typeof preprocess>>();

  return {
    name: "typesugar",
    enforce: "pre",

    buildStart() {
      try {
        const configPath = findTsConfig(process.cwd(), options?.tsconfig);
        cache = createProgram(configPath);
        if (verbose) {
          console.log(`[typesugar] Loaded config from ${configPath}`);
          console.log(`[typesugar] Program has ${cache.config.fileNames.length} files`);
        }
      } catch (error) {
        console.error(String(error));
      }
    },

    loadInclude(id) {
      return shouldTransform(id, options?.include, options?.exclude);
    },

    load(id) {
      // Read the file and preprocess custom syntax (HKT, operators)
      try {
        const source = fs.readFileSync(id, "utf-8");
        const result = preprocess(source, { fileName: id });

        if (result.changed) {
          if (verbose) {
            console.log(`[typesugar] Preprocessed custom syntax in ${id}`);
          }
          // Cache for later use in transform
          preprocessedFiles.set(id, result);

          // Return code with source map for accurate error locations
          return {
            code: result.code,
            map: result.map,
          };
        }
      } catch {
        // File doesn't exist or can't be read - let other plugins handle it
      }

      return null;
    },

    transformInclude(id) {
      return shouldTransform(id, options?.include, options?.exclude);
    },

    transform(code, id) {
      if (!cache) return null;

      // Get and clean up preprocessing cache
      const preprocessResult = preprocessedFiles.get(id);
      preprocessedFiles.delete(id);
      const wasPreprocessed = preprocessResult !== undefined;

      // Try to get the source file from the program
      // This is needed for proper type checking in the macro transformer
      const programSourceFile = cache.program.getSourceFile(id);

      if (!programSourceFile) {
        // File not in the TS program - can't run type-aware transformations
        // Just return the preprocessed code (already valid TS from load hook)
        if (verbose) {
          console.log(`[typesugar] Skipping ${id} (not in program)`);
        }
        return null;
      }

      // If file was preprocessed, we need to create a new source file with the
      // preprocessed content for the transformer to work on
      const sourceFile = wasPreprocessed
        ? ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true)
        : programSourceFile;

      const transformerConfig: MacroTransformerConfig = { verbose };

      // Run the macro transformer
      // Note: When using a fresh source file (preprocessed), some type-aware
      // features may not work. The transformer should handle this gracefully.
      try {
        // Clear expansion tracker before transformation to isolate this file's expansions
        globalExpansionTracker.clear();

        const result = ts.transform(sourceFile, [
          macroTransformerFactory(cache.program, transformerConfig),
        ]);

        if (result.transformed.length === 0) {
          result.dispose();
          return null;
        }

        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        const transformed = printer.printFile(result.transformed[0]);
        result.dispose();

        // LOG TRANSFORMED CODE FOR DEBUGGING
        fs.writeFileSync(id + ".transformed.js", transformed);

        // Only return if the code actually changed
        if (transformed === code) return null;

        // Generate source map from expansion records
        const transformerMap = globalExpansionTracker.generateSourceMap(code, id);

        // Clear tracker after generating the map
        globalExpansionTracker.clear();

        // Compose source maps if the file was preprocessed
        let finalMap: RawSourceMap | null = transformerMap;
        if (wasPreprocessed && preprocessResult?.map && transformerMap) {
          // Compose: originalSource -> preprocessedCode -> transformedCode
          // The remapping function takes the innermost map and a loader for upstream maps
          // Type assertions are needed because @ampproject/remapping has stricter types
          // than our RawSourceMap interface, but they're structurally compatible at runtime
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const composed = remapping(
            transformerMap as any,
            ((file: string) => {
              // Return the preprocessor's map as the upstream source
              if (file === id || file === preprocessResult.map?.sources?.[0]) {
                return preprocessResult.map;
              }
              return null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any
          );
          finalMap = {
            version: 3,
            file: composed.file ?? undefined,
            sourceRoot: composed.sourceRoot ?? "",
            sources: composed.sources.filter((s): s is string => s !== null),
            sourcesContent: composed.sourcesContent,
            names: composed.names,
            mappings: composed.mappings as string,
          };
        }

        // Return transformed code with source map
        return {
          code: transformed,
          map: finalMap,
        };
      } catch (error) {
        // If transformation fails (e.g., type checker issues with preprocessed files),
        // return the preprocessed code as-is - it's already valid TypeScript
        if (verbose) {
          console.error(`[typesugar] Transform error for ${id}:`);
          console.error(error);
          console.log(`[typesugar] Using preprocessed code as fallback`);
        }
        return null;
      }
    },
  };
};

export const unplugin = /*#__PURE__*/ createUnplugin(unpluginFactory);
