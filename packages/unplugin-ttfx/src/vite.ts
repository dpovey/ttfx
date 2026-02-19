/**
 * ttfx Vite plugin
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

import { unplugin, type TtfxPluginOptions } from "./unplugin.js";

export default unplugin.vite;
export type { TtfxPluginOptions };
