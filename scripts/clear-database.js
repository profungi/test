#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'events.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✅ 数据库已删除');
  console.log('💡 下次运行 npm run scrape 会自动创建新的数据库');
} else {
  console.log('ℹ️  数据库文件不存在');
}
