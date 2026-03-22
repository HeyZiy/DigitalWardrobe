const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const pool = require('./db');
const tesseract = require('tesseract.js');
const sharp = require('sharp');

const port = process.env.PORT || 8080;
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

  // 5. Get Purchases
  if (req.method === 'GET' && urlPath === '/api/purchases') {
    pool.query('SELECT * FROM purchases ORDER BY id DESC', (err, result) => {
      if (err) {
        res.writeHead(500); res.end(err.message); return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    });
    return;
  }

  // 6. Add Purchase
  if (req.method === 'POST' && urlPath === '/api/purchases') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { image, name, brand, category, buy_date, source, price, url, status, remarks } = data;
        
        pool.query(
          `INSERT INTO purchases (image, name, brand, category, buy_date, source, price, url, status, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [image, name, brand, category, buy_date, source, price, url, status, remarks],
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

  // 7. Update Purchase
  if (req.method === 'PUT' && urlPath.startsWith('/api/purchases/')) {
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
          `UPDATE purchases SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
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

  // 8. Delete Purchase
  if (req.method === 'DELETE' && urlPath.startsWith('/api/purchases/')) {
    const id = urlPath.split('/').pop();
    pool.query('DELETE FROM purchases WHERE id = $1', [id], (err, result) => {
      if (err) { res.writeHead(500); res.end(err.message); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, changes: result.rowCount }));
    });
    return;
  }

  // 9. Recognize Image
  if (req.method === 'POST' && urlPath === '/api/recognize-image') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { image } = JSON.parse(body);
        if (!image) {
          res.writeHead(400); res.end('Image required'); return;
        }

        // Extract base64 image data
        const base64Data = image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Preprocess image for better OCR results
        const processedBuffer = await sharp(buffer)
          .resize({ width: 1200 })
          .grayscale()
          .threshold(128)
          .toBuffer();

        // Perform OCR with timeout control
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OCR处理超时')), 30000)
        );
        const ocrPromise = tesseract.recognize(processedBuffer, 'chi_sim+eng', {
          logger: info => console.log(info),
        });
        const { data: { text } } = await Promise.race([ocrPromise, timeoutPromise]);

        console.log('OCR Result:', text);

        // Extract product information from OCR text
        const extractedInfo = extractProductInfo(text);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          ...extractedInfo 
        }));
      } catch (e) {
        console.error('Recognition error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Helper function to extract product information from text
  function extractProductInfo(text) {
    const info = {
      name: '',
      price: '',
      brand: '',
      category: '',
      source: ''
    };

    // Extract price
    const priceMatch = text.match(/[¥￥]\s?(\d+(?:\.\d{2})?)/);
    if (priceMatch) {
      info.price = priceMatch[1];
    }

    // Extract brand (simple heuristic)
    const brands = ['优衣库', 'UNIQLO', 'ZARA', 'H&M', '耐克', 'NIKE', '阿迪达斯', 'ADIDAS', '李宁', '安踏'];
    for (const brand of brands) {
      if (text.includes(brand)) {
        info.brand = brand;
        break;
      }
    }

    // Extract category (simple heuristic)
    const categories = ['T恤', '短袖', '长袖', '外套', '裤子', '牛仔裤', '裙子', '衬衫', '卫衣', '夹克'];
    for (const category of categories) {
      if (text.includes(category)) {
        info.category = category;
        break;
      }
    }

    // Extract source (simple heuristic)
    const sources = ['淘宝', '天猫', '京东', '拼多多', '苏宁', '唯品会'];
    for (const source of sources) {
      if (text.includes(source)) {
        info.source = source;
        break;
      }
    }

    // Extract name (first few lines that don't contain price or other keywords)
    const lines = text.split('\n').filter(line => line.trim());
    const nameLines = [];
    for (const line of lines) {
      if (!line.includes('¥') && !line.includes('￥') && !line.includes('价格') && !line.includes('品牌') && !line.includes('分类')) {
        nameLines.push(line.trim());
        if (nameLines.length >= 2) break;
      }
    }
    info.name = nameLines.join(' ');

    return info;
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
