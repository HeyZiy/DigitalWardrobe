require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const NEON_CONFIG = {
  connectionString: process.env.NEON_DATABASE_URL
};

async function migrateData() {
  console.log('='.repeat(50));
  console.log('电子衣橱数据迁移工具');
  console.log('='.repeat(50));
  
  if (!NEON_CONFIG.connectionString) {
    console.error('错误：未设置 NEON_DATABASE_URL');
    console.log('请在 .env 文件中设置 NEON_DATABASE_URL');
    console.log('格式：postgresql://username:password@host/database');
    process.exit(1);
  }
  
  const client = new Client({
    ...NEON_CONFIG,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✓ 已连接到 Neon 数据库');
    
    console.log('\n创建数据表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        image TEXT,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        brand VARCHAR(100),
        season VARCHAR(50),
        price DECIMAL(10, 2),
        url TEXT,
        buy_date DATE,
        source VARCHAR(100),
        add_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        color VARCHAR(50),
        location VARCHAR(50) DEFAULT 'inventory'
      );
    `);
    console.log('✓ items 表已创建/已存在');
    
    const result = await client.query('SELECT COUNT(*) FROM items');
    console.log(`当前数据量: ${result.rows[0].count} 条`);
    
    const exportDir = path.join(__dirname, 'exports');
    const files = fs.existsSync(exportDir) ? fs.readdirSync(exportDir) : [];
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('manifest'));
    
    if (jsonFiles.length > 0) {
      const latestFile = jsonFiles.sort().reverse()[0];
      const filePath = path.join(exportDir, latestFile);
      
      console.log(`\n检测到导出文件: ${latestFile}`);
      console.log('开始导入数据...');
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log('导出文件为空或格式错误，跳过导入');
      } else {
        const columns = Object.keys(data[0]).filter(k => k !== 'id');
        const values = data.map(item => 
          columns.map(col => item[col] ?? null)
        );
        
        const placeholders = columns.map((_, i) => 
          values.map((_, j) => `$${j * columns.length + i + 1}`).join(', ')
        ).join('), (');
        
        const params = values.flat();
        
        const insertQuery = `
          INSERT INTO items (${columns.join(', ')})
          VALUES ${columns.map((_, i) => 
            values.map((_, j) => `$${j * columns.length + i + 1}`).join(', ')
          ).join('), (')}
          ON CONFLICT DO NOTHING
        `;
        
        await client.query(insertQuery, params);
        
        const newCount = await client.query('SELECT COUNT(*) FROM items');
        console.log(`✓ 成功导入 ${data.length} 条记录`);
        console.log(`✓ 当前数据总量: ${newCount.rows[0].count} 条`);
      }
    } else {
      console.log('\n未检测到导出文件，跳过数据导入');
      console.log('如需导入数据，请先运行: node export-data.js');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('迁移完成！');
    console.log('='.repeat(50));
    console.log('\n后续步骤：');
    console.log('1. 确保 .env 文件中的 NEON_DATABASE_URL 已正确设置');
    console.log('2. 重新部署后端服务');
    console.log('3. 测试数据访问是否正常');
    
  } catch (error) {
    console.error('\n迁移失败:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('错误：无法连接到 Neon 数据库，请检查主机地址');
    } else if (error.code === '28P01') {
      console.error('错误：认证失败，请检查用户名和密码');
    } else if (error.code === 'PRIMARY') {
      console.error('错误：表已存在，无需迁移');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

console.log('开始迁移数据到 Neon...\n');
migrateData();
