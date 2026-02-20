/**
 * typesugar esbuild plugin
 *
 * @example
 * ```ts
 * import esbuild from "esbuild";
 * import typesugar from "unplugin-typesugar/esbuild";
 *
 * esbuild.build({
 *   plugins: [typesugar()],
 * });
 * ```
 */

import { unplugin, type TtfxPluginOptions } from "./unplugin.js";

export default unplugin.esbuild;
export type { TtfxPluginOptions };
