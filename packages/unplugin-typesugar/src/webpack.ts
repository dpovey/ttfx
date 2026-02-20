/**
 * typesugar Webpack plugin
 *
 * @example
 * ```ts
 * // webpack.config.js
 * const typesugar = require("unplugin-typesugar/webpack");
 *
 * module.exports = {
 *   plugins: [typesugar()],
 * };
 * ```
 */

import { unplugin, type TtfxPluginOptions } from "./unplugin.js";

export default unplugin.webpack;
export type { TtfxPluginOptions };
