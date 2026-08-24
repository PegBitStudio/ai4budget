import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const iconsDir = join(root, 'public', 'icons');
const svgPath = join(iconsDir, 'icon.svg');

// Read the SVG
const svg = readFileSync(svgPath, 'utf-8');

// Create maskable version (with more padding for safe zone)
const maskableSvg = svg.replace(
  '<rect width="512" height="512" rx="96" ry="96"',
  '<rect width="512" height="512" rx="0" ry="0"'
);

const maskablePath = join(iconsDir, 'icon-maskable.svg');
writeFileSync(maskablePath, maskableSvg);

// Use sharp to convert
const sizes = [192, 512];
const variants = [
  { suffix: '', src: svgPath },
  { suffix: '-maskable', src: maskablePath },
];

for (const { suffix, src } of variants) {
  for (const size of sizes) {
    const output = join(iconsDir, `icon${suffix}-${size}x${size}.png`);
    try {
      execSync(
        `npx --yes sharp-cli -i "${src}" -o "${output}" resize ${size} ${size}`,
        { stdio: 'pipe' }
      );
      console.log(`Created: icon${suffix}-${size}x${size}.png`);
    } catch (e) {
      console.error(`Failed: icon${suffix}-${size}x${size}.png - ${e.message}`);
    }
  }
}

console.log('Done! Icon generation complete.');
