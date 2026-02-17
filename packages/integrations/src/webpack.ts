/**
 * typemacro Webpack plugin
 *
 * @example
 * ```ts
 * // webpack.config.js
 * const typemacro = require("@ttfx/integrations/webpack");
 *
 * module.exports = {
 *   plugins: [typemacro()],
 * };
 * ```
 */

import { unplugin, type TypeMacroPluginOptions } from "./unplugin.js";

export default unplugin.webpack;
export type { TypeMacroPluginOptions };
