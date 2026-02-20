import { execSync } from 'child_process';
import fs from 'fs';

const files = execSync('git ls-files').toString().trim().split('\n');

const ignoreExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.eot', '.woff', '.woff2', '.ttf', '.pdf'];

let modifiedCount = 0;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  if (!fs.statSync(file).isFile()) continue;
  if (ignoreExts.some(ext => file.endsWith(ext))) continue;
  if (file === 'pnpm-lock.yaml') continue;
  if (file === 'rebrand.mjs') continue;

  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace uppercase TTFX
  content = content.replace(/TTFX/g, 'TYPESUGAR');
  // Replace lowercase ttfx
  content = content.replace(/ttfx/g, 'typesugar');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
  }
}

console.log(`Updated ${modifiedCount} files.`);