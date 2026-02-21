#!/usr/bin/env node
/**
 * Bundles @typesugar/ts-plugin into node_modules for vsce packaging.
 * vsce can't handle pnpm symlinks, so we copy actual files.
 */

import { cpSync, mkdirSync, rmSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const vscodeDir = join(__dirname, "..");
const tsPluginSrc = join(vscodeDir, "..", "ts-plugin");
const tsPluginDest = join(vscodeDir, "node_modules", "@typesugar", "ts-plugin");

// Clean and recreate
if (existsSync(tsPluginDest)) {
  rmSync(tsPluginDest, { recursive: true });
}
mkdirSync(tsPluginDest, { recursive: true });

// Copy files (not symlinks)
const files = ["index.js", "index.d.ts", "language-service.cjs", "package.json"];
for (const file of files) {
  const src = join(tsPluginSrc, file);
  const dest = join(tsPluginDest, file);
  if (existsSync(src)) {
    cpSync(src, dest);
    console.log(`Copied ${file}`);
  } else {
    console.warn(`Warning: ${file} not found in ts-plugin`);
  }
}

console.log("✓ Bundled @typesugar/ts-plugin for packaging");
