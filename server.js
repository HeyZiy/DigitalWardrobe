const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 5173;
const root = __dirname;

const mime = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.csv':'text/csv; charset=utf-8',
  '.md':'text/markdown; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.gif':'image/gif',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let urlPath = decodeURI(url.pathname);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.join(root, urlPath);

  // Handle API Save (POST /api/save)
  if (req.method === 'POST' && urlPath === '/api/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { filename, content } = JSON.parse(body);
        if (!filename || content === undefined) {
          res.writeHead(400); res.end('Invalid request'); return;
        }
        
        // Ensure saving is restricted to the root or subdirectories like 'data/'
        const safePath = path.resolve(root, filename);
        if (!safePath.startsWith(root)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }

        // Ensure directory exists
        const dir = path.dirname(safePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(safePath, content, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500); res.end(e.message);
      }
    });
    return;
  }

  if (!filePath.startsWith(root)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404); res.end('Not Found'); return;
    }
    if (stat.isDirectory()) {
      const idx = path.join(filePath, 'index.html');
      fs.readFile(idx, (e, buf) => {
        if (e) { res.writeHead(403); res.end('Forbidden'); return; }
        res.writeHead(200, {'Content-Type': mime['.html']});
        res.end(buf);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (e, buf) => {
      if (e) { res.writeHead(500); res.end('Internal Error'); return; }
      res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream'});
      res.end(buf);
    });
  });
});

server.listen(port, () => {
  console.log(`Static server running at http://localhost:${port}/`);
});

