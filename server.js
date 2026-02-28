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

  // Handle API Fetch Metadata (POST /api/fetch-metadata)
  if (req.method === 'POST' && urlPath === '/api/fetch-metadata') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { targetUrl } = JSON.parse(body);
        if (!targetUrl) {
          res.writeHead(400); res.end('URL required'); return;
        }

        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': 'https://www.taobao.com/'
          },
          redirect: 'follow'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const html = await response.text();
        
        // Check if we hit a login page or redirect page
        if (html.includes('login.taobao.com') || html.includes('login.m.taobao.com') || html.includes('验证码') || html.includes('滑块验证')) {
          // If it's a Taobao short link, sometimes we can extract a bit from the page title or URL even if blocked
          const urlObj = new URL(response.url);
          const titleFromUrl = urlObj.searchParams.get('id') || ''; 
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            title: `淘宝商品 (需手动填写) ${titleFromUrl}`, 
            image: '', 
            price: '',
            success: true,
            warning: '由于淘宝安全限制，自动抓取受到限制，请手动补充信息'
          }));
          return;
        }

        // Simple extraction logic
        const getMeta = (prop) => {
          const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
                        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
          return match ? match[1] : null;
        };

        let title = getMeta('og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
        let image = getMeta('og:image') || getMeta('twitter:image') || '';
        
        // Try to find image in <img> tags if og:image fails
        if (!image) {
          const imgMatch = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp))["']/i);
          if (imgMatch) image = imgMatch[1];
        }

        // Try to find price (very basic heuristic for common patterns)
        let price = '';
        const priceMatch = html.match(/(?:price|售价|价格|¥|￥)\s*[:：]?\s*(\d+(?:\.\d{2})?)/i);
        if (priceMatch) price = priceMatch[1];

        // Clean up title (remove common suffixes)
        title = title.replace(/-淘宝网|-tmall\.com天猫| - 详情/g, '').trim();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          title: title, 
          image: image, 
          price: price,
          success: true 
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

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

