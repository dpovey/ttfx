/**
 * @ttfx/integrations - Bundler integrations for typemacro
 *
 * This package provides plugins for various bundlers:
 * - Vite: `@ttfx/integrations/vite`
 * - Webpack: `@ttfx/integrations/webpack`
 * - esbuild: `@ttfx/integrations/esbuild`
 * - Rollup: `@ttfx/integrations/rollup`
 *
 * Each plugin uses the typemacro transformer to process TypeScript files
 * during the build, expanding macros at compile time.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import typemacro from "@ttfx/integrations/vite";
 *
 * export default {
 *   plugins: [typemacro()],
 * };
 * ```
 */

export {
  unplugin,
  unpluginFactory,
  type TypeMacroPluginOptions,
} from "./unplugin.js";
