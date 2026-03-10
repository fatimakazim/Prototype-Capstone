#!/usr/bin/env node
/**
 * Creates tiny valid placeholder files without any npm dependencies.
 * Run once: node create-placeholders.js
 */
const fs   = require('fs');
const path = require('path');

const dirs = [
  'assets/images',
  'assets/audio',
  'assets/models'
];
dirs.forEach(d => {
  const full = path.join(__dirname, d);
  if (!fs.existsSync(full)) { fs.mkdirSync(full, { recursive: true }); console.log(`📁 Created: ${d}`); }
});

// Minimal 1×1 grey JPEG (valid file browsers won't crash on)
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEB' +
  'AxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAIhAAAQQCAgMBAAAAAAAAAAAAAQIDBAURBhIhMf/E' +
  'ABQBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCq2vWF' +
  'ra8q2haKJpLHqNajuIPkGwNEEH8Ec+Q4xjGP/9k=', 'base64');

const images = [
  'placeholder-panel-bg.png',
  'placeholder-archive-01.jpg',
  'placeholder-archive-02.jpg',
  'placeholder-sky.jpg'
];
images.forEach(name => {
  const p = path.join(__dirname, 'assets/images', name);
  if (!fs.existsSync(p)) { fs.writeFileSync(p, TINY_JPEG); console.log(`🖼  Created: ${p}`); }
});

// Silent MP3 (44 bytes — valid ID3 frame)
const SILENT_MP3 = Buffer.from('SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6v///////////wAAAA==', 'base64');
const audios = ['testimony-ram-kund.mp3', 'testimony-haveli.mp3', 'testimony-mosque.mp3'];
audios.forEach(name => {
  const p = path.join(__dirname, 'assets/audio', name);
  if (!fs.existsSync(p)) { fs.writeFileSync(p, SILENT_MP3); console.log(`🔊 Created: ${p}`); }
});

console.log('\n✅ Placeholder assets created. Replace with real content when ready.\n');
