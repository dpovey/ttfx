/**
 * typemacro esbuild plugin
 *
 * @example
 * ```ts
 * import esbuild from "esbuild";
 * import typemacro from "typemacro/esbuild";
 *
 * esbuild.build({
 *   plugins: [typemacro()],
 * });
 * ```
 */

import { unplugin, type TypeMacroPluginOptions } from "./unplugin.js";

export default unplugin.esbuild;
export type { TypeMacroPluginOptions };
