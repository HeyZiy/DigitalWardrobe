const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function exportData() {
  console.log('Exporting data from SQLite...');
  
  const items = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM items', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const purchases = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM purchases', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const data = { items, purchases };
  
  fs.writeFileSync(path.join(__dirname, 'data', 'export.json'), JSON.stringify(data, null, 2));
  
  console.log(`Exported ${items.length} items and ${purchases.length} purchases to data/export.json`);
  
  db.close();
}

exportData().catch(console.error);
