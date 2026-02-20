/**
 * typemacro TypeScript Language Service Plugin
 *
 * This module re-exports the language service plugin from @typesugar/transformer.
 * It exists for backwards compatibility with the legacy "typemacro/language-service" path.
 *
 * Configure in tsconfig.json:
 * {
 *   "compilerOptions": {
 *     "plugins": [{ "name": "typemacro/language-service" }]
 *   }
 * }
 *
 * For new projects, prefer using @typesugar/transformer/language-service directly.
 */

// Re-export the language service plugin from @typesugar/transformer
// Note: This requires @typesugar/transformer to be built first
export { default } from "@typesugar/transformer/language-service";
