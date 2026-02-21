#!/usr/bin/env node
/**
 * Sets up the TypeScript language service plugin for development.
 * 
 * TypeScript's plugin resolution doesn't work well with pnpm's symlink structure.
 * This script creates a symlink where TypeScript actually looks for plugins.
 * 
 * Run automatically via postinstall, or manually: node scripts/setup-ts-plugin.js
 */

import { existsSync, mkdirSync, symlinkSync, unlinkSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Find where TypeScript is installed in the pnpm store
const tsconfigPath = join(root, 'node_modules/typescript/package.json');
if (!existsSync(tsconfigPath)) {
  console.log('TypeScript not installed, skipping ts-plugin setup');
  process.exit(0);
}

// Read TypeScript's package.json to find its actual location
const tsPackage = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
const tsRealPath = join(root, 'node_modules/typescript');

// The plugin needs to be at: <typescript-location>/../@typesugar/ts-plugin
const pluginDir = join(tsRealPath, '..', '@typesugar');
const pluginPath = join(pluginDir, 'ts-plugin');
const targetPath = join(root, 'packages/ts-plugin');

// Check if target exists
if (!existsSync(targetPath)) {
  console.log('@typesugar/ts-plugin package not found, skipping setup');
  process.exit(0);
}

// Create the symlink
try {
  if (!existsSync(pluginDir)) {
    mkdirSync(pluginDir, { recursive: true });
  }
  
  if (existsSync(pluginPath)) {
    unlinkSync(pluginPath);
  }
  
  symlinkSync(targetPath, pluginPath);
  console.log('✓ TypeScript language service plugin linked');
} catch (err) {
  console.warn('Could not set up ts-plugin symlink:', err.message);
}
