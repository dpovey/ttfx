import type * as ts from "typescript";
declare function init(modules: { typescript: typeof ts }): { create: (info: ts.server.PluginCreateInfo) => ts.LanguageService };
export = init;
