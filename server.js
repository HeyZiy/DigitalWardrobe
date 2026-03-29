require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const pool = require('./db');
const { GoogleGenAI } = require('@google/genai');
const port = process.env.PORT || 8080;
const root = __dirname;
const WARDROBE_PASSWORD = process.env.WARDROBE_PASSWORD;

/**
 * Basic session verify (Single Password)
 */
function isAuthorized(req) {
  if (!WARDROBE_PASSWORD) return true; // Auth disabled if no password set
  const cookies = req.headers.cookie || '';
  const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth_token='));
  const token = authCookie ? authCookie.split('=')[1].trim() : req.headers['x-auth-token'];
  return token === WARDROBE_PASSWORD;
}

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

  // 0. Auth Endpoint (POST /api/auth/login)
  if (req.method === 'POST' && urlPath === '/api/auth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { password } = JSON.parse(body);
        if (password === WARDROBE_PASSWORD) {
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Set-Cookie': `auth_token=${password}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000` // 30 days
          });
          res.end(JSON.stringify({ success: true, token: password }));
        } else {
          res.writeHead(401);
          res.end(JSON.stringify({ success: false, error: '密码错误' }));
        }
      } catch (e) {
        res.writeHead(400); res.end('Invalid request');
      }
    });
    return;
  }

  // 1. Auth Check for all other requests
  if (!isAuthorized(req)) {
    // Only allow essential assets for the login page
    const publicAssets = ['/styles.css', '/src/styles.css', '/favicon.ico'];
    if (req.method === 'GET' && (urlPath === '/index.html' || publicAssets.includes(urlPath))) {
      // Allow index.html but the frontend will show the login overlay
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }
  }

  // Handle API Fetch Metadata (POST /api/fetch-metadata)
  if (req.method === 'POST' && urlPath === '/api/fetch-metadata') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let browser;
      try {
        const { targetUrl } = JSON.parse(body);
        if (!targetUrl) {
          res.writeHead(400); res.end('URL required'); return;
        }

        console.log(`[V2.1] Scraping: ${targetUrl}`);
        console.log('Launching browser...');
        
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-gpu',
            '--disable-web-security'
          ]
        });
        console.log('Browser launched. Creating page...');
        const page = await browser.newPage();
        
        await page.setExtraHTTPHeaders({
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
        });

        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 390, height: 844 });
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });

        console.log(`Navigating to ${targetUrl}...`);
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch (navErr) {
          console.log(`Navigation hit a timeout/error (${navErr.message}), but continuing to extract partial data if possible...`);
        }
        
        const isTaobao = targetUrl.includes('taobao.com') || targetUrl.includes('tmall.com') || targetUrl.includes('tb.cn');
        if (isTaobao) {
          console.log('Detected Taobao/Tmall/tb.cn, waiting for dynamic content...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        const data = await page.evaluate(() => {
          const getMeta = (prop) => {
            const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
            return el ? el.getAttribute('content') : null;
          };

          let title = getMeta('og:title') || document.title || '';
          let image = getMeta('og:image') || getMeta('twitter:image') || '';
          let price = '';

          const isPlaceholder = title.includes('天猫淘宝海外') || title.includes('Login') || title.includes('验证码');

          if (location.host.includes('taobao.com') || location.host.includes('tmall.com')) {
            const priceEl = document.querySelector('.price, .item-price, .promo-price, .ui-cost, [class*="price-text"], .main-price');
            if (priceEl) price = priceEl.innerText.replace(/[^\d.]/g, '');
            
            if (!image || image.includes('placeholder')) {
              const mainImg = document.querySelector('.main-img img, .item-detail-img img, #J_ImgBooth');
              if (mainImg) image = mainImg.src;
            }
          } else if (location.host.includes('jd.com')) {
            const priceEl = document.querySelector('.jd-price, .price-display, .p-price, .mod_price');
            if (priceEl) price = priceEl.innerText.replace(/[^\d.]/g, '');
          }

          if (!price) {
            const priceTags = Array.from(document.querySelectorAll('span, div, b, strong')).filter(el => el.innerText.includes('¥') || el.innerText.includes('￥'));
            for (const tag of priceTags) {
              const match = tag.innerText.match(/[¥￥]\s?(\d+(?:\.\d{2})?)/);
              if (match) { price = match[1]; break; }
            }
          }

          title = title.replace(/-淘宝网|-tmall\.com天猫| - 详情|-京东|淘宝海外/g, '').trim();

          return { title, image, price, isPlaceholder };
        });

        console.log('Extraction results:', data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          ...data,
          success: true,
          warning: data.isPlaceholder ? '注意：可能触发了机器人验证或重定向，信息可能不完整' : undefined
        }));
      } catch (e) {
        console.error('Scrape error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      } finally {
        if (browser) await browser.close();
      }
    });
    return;
  }

  // === PostgreSQL API Endpoints ===

  // 1. Get Items
  if (req.method === 'GET' && urlPath === '/api/items') {
    pool.query('SELECT * FROM items ORDER BY id DESC', (err, result) => {
      if (err) {
        res.writeHead(500); res.end(err.message); return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    });
    return;
  }

  // 2. Add New Item
  if (req.method === 'POST' && urlPath === '/api/items') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { image, name, category, brand, season, status, price, url, buy_date, source, add_date, color, location } = data;
        
        pool.query(
          `INSERT INTO items (image, name, category, brand, season, status, price, url, buy_date, source, add_date, color, location)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
          [image, name, category, brand, season, status, price, url, buy_date, source, add_date, color, location || 'inventory'],
          (err, result) => {
            if (err) { res.writeHead(500); res.end(err.message); return; }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, id: result.rows[0].id }));
          }
        );
      } catch (e) {
        res.writeHead(400); res.end('Invalid request');
      }
    });
    return;
  }

  // 3. Update Item
  if (req.method === 'PUT' && urlPath.startsWith('/api/items/')) {
    const id = urlPath.split('/').pop();
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        for (const [key, value] of Object.entries(data)) {
          if (key !== 'id') {
            updates.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
          }
        }
        
        if (updates.length === 0) {
          res.writeHead(400); res.end('No valid fields to update'); return;
        }
        
        values.push(id);
        
        pool.query(
          `UPDATE items SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
          values,
          (err, result) => {
            if (err) { res.writeHead(500); res.end(err.message); return; }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, changes: result.rowCount }));
          }
        );
      } catch (e) {
        res.writeHead(400); res.end('Invalid request');
      }
    });
    return;
  }

  // 4. Delete Item
  if (req.method === 'DELETE' && urlPath.startsWith('/api/items/')) {
    const id = urlPath.split('/').pop();
    pool.query('DELETE FROM items WHERE id = $1', [id], (err, result) => {
      if (err) { res.writeHead(500); res.end(err.message); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, changes: result.rowCount }));
    });
    return;
  }

  // Note: /api/purchases endpoints have been intentionally removed.
  // The application now uses a "Single Source of Truth" architecture based entirely on the "items" table.
  // Finance records are derived views of items. Do not re-introduce the purchases API.

  // 5. Recognize Image
  if (req.method === 'POST' && urlPath === '/api/recognize-image') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { image } = JSON.parse(body);
        if (!image) {
          res.writeHead(400); res.end('Image required'); return;
        }

        if (!process.env.GEMINI_API_KEY) {
          res.writeHead(400); res.end('API Key is missing in environment variables'); return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Extract base64 image data and mime type
        const match = image.match(/^data:image\/(png|jpg|jpeg|webp);base64,/);
        const mimeType = match ? 'image/' + match[1] : 'image/jpeg';
        const base64Data = image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, '');

        console.log('Sending image to Gemini Vision API...');

        const prompt = `这是一张电商商品（如淘宝、京东等）或者实物商品的截图。请准确分析图片中的商品信息。
必须返回严格的 JSON 格式，不要包含Markdown语法，不要包含任何前缀后缀代码块标记。
JSON 的格式如下：
{
  "name": "商品名称（去掉一些冗余修饰词，保持核心品名）",
  "price": "价格（纯数字字符串格式，不要带货币符号，例如 '99.00'）",
  "brand": "品牌（如果在页面中找到或者你能认出它的主要品牌）",
  "category": "分类（如：短袖、卫衣、外套、裤子、裙子、鞋子、配饰等）",
  "source": "购买途径（页面平台，如淘宝、天猫、京东、拼多多、得物等）",
  "season": "季节（推测该商品最适合哪个季节：春季、夏季、秋季、冬季、四季通用）"
}
如果某个字段无法分析出，可以留空字符串。`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                prompt,
                { inlineData: { data: base64Data, mimeType } }
            ],
            config: {
                responseMimeType: 'application/json'
            }
        });

        const textResponse = response.text;
        console.log('Gemini API Response Text:', textResponse);

        // Try to parse the clean json
        let cleanJsonText = textResponse.trim();
        // Remove markdown code blocks if the model unexpectedly returned them
        cleanJsonText = cleanJsonText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        
        const extractedInfo = JSON.parse(cleanJsonText);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          ...extractedInfo 
        }));
      } catch (e) {
        console.error('Recognition error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '未能成功识别或解析图片，请检查网络或配置 API Key。详细错误见后台日志。' }));
      }
    });
    return;
  }

  // Static file serving
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

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}/`);
});
