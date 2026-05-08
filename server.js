const https = require('https');
const fs = require('fs');
const path = require('path');

const options = {
  key:  fs.readFileSync('localhost+2-key.pem'),
  cert: fs.readFileSync('localhost+2.pem'),
};

https.createServer(options, (req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript',
    '.css': 'text/css',   '.png': 'image/png',
    '.jpg': 'image/jpeg', '.json': 'application/json',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(8443, () => console.log('✅ HTTPS server running at https://localhost:8443'));
