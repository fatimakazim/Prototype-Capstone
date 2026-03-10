#!/usr/bin/env node
/**
 * generate-placeholders.js
 * ─────────────────────────────────────────────────────────────
 * Generates placeholder PNG images using the Canvas API.
 * Run ONCE to create placeholder assets:
 *
 *   node generate-placeholders.js
 *
 * Then replace each generated file with a real asset.
 * Requires: npm install canvas
 * ─────────────────────────────────────────────────────────────
 */

const path = require('path');
const fs   = require('fs');

// Output directory relative to this script
const outDir = path.join(__dirname, '../assets/images');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Placeholder spec: filename, width, height, bg color, label
const placeholders = [
  { file: 'placeholder-panel-bg.png',    w: 512, h: 512, bg: '#0a0a1a', label: 'PANEL BG'       },
  { file: 'placeholder-archive-01.jpg',  w: 800, h: 600, bg: '#1a1410', label: 'ARCHIVAL PHOTO 01\nReplace with real CC-licensed image\nSource: Wikimedia Commons' },
  { file: 'placeholder-archive-02.jpg',  w: 800, h: 600, bg: '#1a1410', label: 'ARCHIVAL PHOTO 02\nReplace with real CC-licensed image\nSource: Wikimedia Commons' },
  { file: 'placeholder-sky.jpg',         w: 2048,h: 1024, bg: '#d4a870', label: 'PLACEHOLDER SKY\nReplace with equirectangular JPEG' }
];

try {
  const { createCanvas } = require('canvas');

  placeholders.forEach(({ file, w, h, bg, label }) => {
    const canvas = createCanvas(w, h);
    const ctx    = canvas.getContext('2d');

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 1;
    for (let x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Border
    ctx.strokeStyle = 'rgba(192,57,43,0.3)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Label
    ctx.fillStyle  = 'rgba(232,220,200,0.5)';
    ctx.font       = `${Math.max(14, w / 30)}px monospace`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    const lines    = label.split('\n');
    const lineH    = Math.max(20, w / 24);
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lineH);
    });

    const outPath = path.join(outDir, file);
    const buffer  = file.endsWith('.jpg') ? canvas.toBuffer('image/jpeg', { quality: 0.85 }) : canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buffer);
    console.log(`✅ Created: ${file} (${w}×${h})`);
  });

  console.log('\n✅ All placeholders generated in assets/images/');
  console.log('📝 Replace each file with a real asset when ready.\n');

} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.log('⚠️  The "canvas" npm package is not installed.');
    console.log('   Run: npm install canvas');
    console.log('   Then run this script again.\n');
    console.log('   Alternatively, create your own placeholder images manually');
    console.log('   and place them in assets/images/ with the following names:');
    placeholders.forEach(p => console.log(`   - ${p.file}`));
  } else {
    throw e;
  }
}
