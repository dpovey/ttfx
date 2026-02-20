/**
 * unplugin-ttfx — Bundler integrations for ttfx
 *
 * This package provides plugins for various bundlers:
 * - Vite: `unplugin-ttfx/vite`
 * - Webpack: `unplugin-ttfx/webpack`
 * - esbuild: `unplugin-ttfx/esbuild`
 * - Rollup: `unplugin-ttfx/rollup`
 *
 * Each plugin uses the ttfx transformer to process TypeScript files
 * during the build, expanding macros at compile time.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import ttfx from "unplugin-ttfx/vite";
 *
 * export default {
 *   plugins: [ttfx()],
 * };
 * ```
 */

export {
  unplugin,
  unpluginFactory,
  type TtfxPluginOptions,
} from "./unplugin.js";
