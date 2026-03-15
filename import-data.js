const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function importData() {
  console.log('Importing data to PostgreSQL...');
  
  const dataPath = path.join(__dirname, 'data', 'export.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error('No export.json found. Please run export-data.js locally first.');
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const { items, purchases } = data;
  
  console.log(`Found ${items.length} items and ${purchases.length} purchases to import`);

  // Clear existing data
  await pool.query('DELETE FROM items');
  await pool.query('DELETE FROM purchases');
  await pool.query('ALTER SEQUENCE items_id_seq RESTART WITH 1');
  await pool.query('ALTER SEQUENCE purchases_id_seq RESTART WITH 1');

  // Insert items
  for (const item of items) {
    await pool.query(
      `INSERT INTO items (image, name, category, brand, season, status, price, url, buy_date, source, add_date, color, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        item.image,
        item.name,
        item.category,
        item.brand,
        item.season,
        item.status,
        item.price,
        item.url,
        item.buy_date,
        item.source,
        item.add_date,
        item.color,
        item.location
      ]
    );
  }
  console.log(`Imported ${items.length} items`);

  // Insert purchases
  for (const purchase of purchases) {
    await pool.query(
      `INSERT INTO purchases (image, name, brand, category, buy_date, source, price, url, status, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        purchase.image,
        purchase.name,
        purchase.brand,
        purchase.category,
        purchase.buy_date,
        purchase.source,
        purchase.price,
        purchase.url,
        purchase.status,
        purchase.remarks
      ]
    );
  }
  console.log(`Imported ${purchases.length} purchases`);

  console.log('Import completed successfully!');
  await pool.end();
  process.exit(0);
}

importData().catch(err => {
  console.error('Import failed:', err);
  pool.end();
  process.exit(1);
});
