/**
 * typesugar Rollup plugin
 *
 * @example
 * ```ts
 * // rollup.config.js
 * import typesugar from "unplugin-typesugar/rollup";
 *
 * export default {
 *   plugins: [typesugar()],
 * };
 * ```
 */

import { unplugin, type TtfxPluginOptions } from "./unplugin.js";

export default unplugin.rollup;
export type { TtfxPluginOptions };
