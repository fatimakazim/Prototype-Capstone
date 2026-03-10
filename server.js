#!/usr/bin/env node
/**
 * server.js — Simple local development server for Saidpur VR
 * ─────────────────────────────────────────────────────────────
 * Serves the project with correct MIME types for GLB, GLTF,
 * and audio files. Required because A-Frame's GLB loader
 * needs CORS headers that file:// protocol cannot provide.
 *
 * USAGE:
 *   node server.js
 *   → Open: http://localhost:3000
 *
 * No npm packages required — uses Node.js built-ins only.
 * ─────────────────────────────────────────────────────────────
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = 3000;
const ROOT    = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Decode URL and strip query string
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Default to index.html for directory requests
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);
  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  // CORS headers (required for A-Frame assets loaded cross-origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 Not Found: ${urlPath}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║      Saidpur VR — Local Development Server        ║
╠═══════════════════════════════════════════════════╣
║  Running at:  http://localhost:${PORT}                ║
║                                                   ║
║  Scenes:                                          ║
║  /                          Landing page          ║
║  /scenes/briefing-scene.html                      ║
║  /scenes/map-table-scene.html                     ║
║  /scenes/saidpur-village-scene.html               ║
║  /scenes/reflection-scene.html                    ║
║                                                   ║
║  Visualizations:                                  ║
║  /visualizations/migration-map.html               ║
║  /visualizations/timeline-visualization.html      ║
║                                                   ║
║  Press Ctrl+C to stop                            ║
╚═══════════════════════════════════════════════════╝
`);
});
