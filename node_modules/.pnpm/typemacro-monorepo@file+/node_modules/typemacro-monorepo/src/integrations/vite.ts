/**
 * typemacro Vite plugin
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import typemacro from "typemacro/vite";
 *
 * export default {
 *   plugins: [typemacro()],
 * };
 * ```
 */

import { unplugin, type TypeMacroPluginOptions } from "./unplugin.js";

export default unplugin.vite;
export type { TypeMacroPluginOptions };
