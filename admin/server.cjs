const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5174;
const DIR = __dirname;
const ASSETS_DIR = path.join(DIR, 'assets');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // 1. If it's an asset request (direct /assets/ or nested /pod-backups/.../assets/)
  if (urlPath.includes('/assets/')) {
    const filename = path.basename(urlPath);
    const assetFile = path.join(ASSETS_DIR, filename);

    if (fs.existsSync(assetFile)) {
      const ext = path.extname(assetFile).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(assetFile).pipe(res);
      return;
    }
  }

  // 2. Direct file lookup in root DIR
  const directPath = path.join(DIR, urlPath);
  if (urlPath !== '/' && fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    const ext = path.extname(directPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(directPath).pipe(res);
    return;
  }

  // 3. Fallback: SPA index.html
  const indexPath = path.join(DIR, 'index.html');
  fs.readFile(indexPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Admin Portal running on http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
});
