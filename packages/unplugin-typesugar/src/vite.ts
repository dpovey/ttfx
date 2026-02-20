/**
 * typesugar Vite plugin
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import typesugar from "unplugin-typesugar/vite";
 *
 * export default {
 *   plugins: [typesugar()],
 * };
 * ```
 */

import { unplugin, type TtfxPluginOptions } from "./unplugin.js";

export default unplugin.vite;
export type { TtfxPluginOptions };
