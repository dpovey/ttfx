/**
 * ttfx Rollup plugin
 *
 * @example
 * ```ts
 * // rollup.config.js
 * import ttfx from "unplugin-ttfx/rollup";
 *
 * export default {
 *   plugins: [ttfx()],
 * };
 * ```
 */

import { unplugin, type TtfxPluginOptions } from "./unplugin.js";

export default unplugin.rollup;
export type { TtfxPluginOptions };
