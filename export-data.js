require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NEON_DATABASE_URL ? { rejectUnauthorized: false } : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false)
});

async function exportData() {
  console.log('='.repeat(50));
  console.log('电子衣橱数据导出工具');
  console.log('='.repeat(50));
  
  if (!databaseUrl) {
    console.error('错误：未设置数据库连接');
    console.log('请在 .env 文件中设置 NEON_DATABASE_URL 或 DATABASE_URL');
    process.exit(1);
  }
  
  try {
    await pool.connect();
    console.log('✓ 已连接到数据库');
    
    const result = await pool.query('SELECT * FROM items ORDER BY id');
    const items = result.rows;
    
    console.log(`\n找到 ${items.length} 条记录\n`);
    
    if (items.length === 0) {
      console.log('数据库为空，无需导出');
      await pool.end();
      return;
    }
    
    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    const jsonPath = path.join(exportDir, `wardrobe-export-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf-8');
    console.log(`✓ JSON 格式已导出: ${jsonPath}`);
    
    const headers = Object.keys(items[0]).join(',');
    const rows = items.map(item => 
      Object.values(item).map(val => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    
    const csvPath = path.join(exportDir, `wardrobe-export-${timestamp}.csv`);
    fs.writeFileSync(csvPath, csv, 'utf-8');
    console.log(`✓ CSV 格式已导出: ${csvPath}`);
    
    const manifest = {
      exportDate: new Date().toISOString(),
      itemCount: items.length,
      version: '0.1.0',
      fields: Object.keys(items[0])
    };
    
    const manifestPath = path.join(exportDir, `export-manifest-${timestamp}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`✓ 导出清单已创建: ${manifestPath}`);
    
    console.log('\n' + '='.repeat(50));
    console.log('导出完成！');
    console.log('='.repeat(50));
    console.log(`\n总计导出: ${items.length} 条衣物记录`);
    console.log('文件位置: ./exports/');
    
  } catch (error) {
    console.error('\n导出失败:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('错误：无法连接到数据库，请检查网络连接和数据库地址');
    } else if (error.code === '28P01') {
      console.error('错误：数据库认证失败，请检查用户名和密码');
    } else if (error.code === '3D000') {
      console.error('错误：数据库不存在，请检查数据库名称');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

console.log('开始导出数据...\n');
exportData();
