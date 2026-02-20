/**
 * ttfx Webpack plugin
 *
 * @example
 * ```ts
 * // webpack.config.js
 * const ttfx = require("unplugin-ttfx/webpack");
 *
 * module.exports = {
 *   plugins: [ttfx()],
 * };
 * ```
 */

import { unplugin, type TtfxPluginOptions } from "./unplugin.js";

export default unplugin.webpack;
export type { TtfxPluginOptions };
