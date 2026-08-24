import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

// If canvas is not available, we'll use a different approach
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const iconsDir = join(root, 'public', 'icons');

function generateIcon(size, maskable = false) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient (approximate with solid + overlay)
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#1e40af');
  gradient.addColorStop(1, '#3b82f6');

  if (maskable) {
    // Full bleed for maskable
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  } else {
    // Rounded rect
    const r = size * 0.1875; // 96/512 ratio
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // Dollar sign
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.47}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', size * 0.5, size * 0.52);

  // AI sparkle dots
  const dotScale = size / 512;
  ctx.beginPath();
  ctx.arc(380 * dotScale, 120 * dotScale, 16 * dotScale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(410 * dotScale, 155 * dotScale, 10 * dotScale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(355 * dotScale, 90 * dotScale, 8 * dotScale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();

  return canvas.toBuffer('image/png');
}

const sizes = [192, 512];

for (const size of sizes) {
  writeFileSync(join(iconsDir, `icon-${size}x${size}.png`), generateIcon(size, false));
  console.log(`Created icon-${size}x${size}.png`);

  writeFileSync(join(iconsDir, `icon-maskable-${size}x${size}.png`), generateIcon(size, true));
  console.log(`Created icon-maskable-${size}x${size}.png`);
}

console.log('All icons generated!');
