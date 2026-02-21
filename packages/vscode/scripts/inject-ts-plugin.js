#!/usr/bin/env node
/**
 * Injects @typesugar/ts-plugin into the vsix after vsce packages it.
 * vsce with --no-dependencies doesn't include node_modules, so we add it manually.
 */

import { execSync } from "child_process";
import { mkdirSync, cpSync, rmSync, existsSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const vscodeDir = join(__dirname, "..");

// Find the vsix file
const vsixFiles = readdirSync(vscodeDir).filter((f) => f.endsWith(".vsix"));
if (vsixFiles.length === 0) {
  console.error("No .vsix file found");
  process.exit(1);
}
const vsixFile = join(vscodeDir, vsixFiles[0]);
console.log(`Processing ${vsixFile}`);

// Create temp directory
const tempDir = join(vscodeDir, ".vsix-temp");
if (existsSync(tempDir)) {
  rmSync(tempDir, { recursive: true });
}
mkdirSync(tempDir);

try {
  // Extract vsix (it's a zip file)
  execSync(`unzip -q "${vsixFile}" -d "${tempDir}"`);

  // Create node_modules/@typesugar/ts-plugin in the extension folder
  const pluginDest = join(tempDir, "extension", "node_modules", "@typesugar", "ts-plugin");
  mkdirSync(pluginDest, { recursive: true });

  // Copy ts-plugin files from the workspace
  const pluginSrc = join(vscodeDir, "node_modules", "@typesugar", "ts-plugin");
  const files = ["index.js", "index.d.ts", "language-service.cjs", "package.json"];

  for (const file of files) {
    const src = join(pluginSrc, file);
    const dest = join(pluginDest, file);
    if (existsSync(src)) {
      cpSync(src, dest);
      console.log(`  Added ${file}`);
    } else {
      console.warn(`  Warning: ${file} not found`);
    }
  }

  // Remove old vsix and create new one
  rmSync(vsixFile);
  execSync(`cd "${tempDir}" && zip -rq "${vsixFile}" .`);

  console.log(`✓ Injected @typesugar/ts-plugin into ${vsixFiles[0]}`);
} finally {
  // Cleanup
  rmSync(tempDir, { recursive: true });
}
