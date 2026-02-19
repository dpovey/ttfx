/**
 * ttfx esbuild plugin
 *
 * @example
 * ```ts
 * import esbuild from "esbuild";
 * import ttfx from "unplugin-ttfx/esbuild";
 *
 * esbuild.build({
 *   plugins: [ttfx()],
 * });
 * ```
 */

import { unplugin, type TtfxPluginOptions } from "./unplugin.js";

export default unplugin.esbuild;
export type { TtfxPluginOptions };
