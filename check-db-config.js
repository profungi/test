#!/usr/bin/env node

/**
 * 检查数据库配置
 */

require('dotenv').config();

console.log('\n═══════════════════════════════════════');
console.log('📊 数据库配置检查');
console.log('═══════════════════════════════════════\n');

console.log('环境变量:');
console.log('  USE_TURSO:', process.env.USE_TURSO || '(未设置)');
console.log('\n数据库配置:');
console.log('  类型:', process.env.USE_TURSO ? 'Turso 云数据库 ☁️' : '本地 SQLite 💾');
console.log('  本地路径: ./data/events.db');

if (process.env.USE_TURSO) {
  console.log('\nTurso 配置:');
  console.log('  URL:', process.env.TURSO_DATABASE_URL || '⚠️  未设置');
  console.log('  Token:', process.env.TURSO_AUTH_TOKEN
    ? '✅ 已设置 (' + process.env.TURSO_AUTH_TOKEN.substring(0, 20) + '...)'
    : '⚠️  未设置');

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.log('\n⚠️  警告: USE_TURSO=1 但缺少 Turso 配置！');
    console.log('   请在 .env 文件中设置:');
    console.log('   - TURSO_DATABASE_URL');
    console.log('   - TURSO_AUTH_TOKEN');
  }
}

console.log('\n翻译配置:');
console.log('  服务提供商:', process.env.TRANSLATOR_PROVIDER || 'auto');

const hasGemini = !!process.env.GEMINI_API_KEY;
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasMistral = !!process.env.MISTRAL_API_KEY;

console.log('  可用服务:');
if (hasGemini) console.log('    ✅ Gemini');
if (hasOpenAI) console.log('    ✅ OpenAI');
if (hasMistral) console.log('    ✅ Mistral');
console.log('    ✅ Google Translate (免费)');

if (!hasGemini && !hasOpenAI && !hasMistral) {
  console.log('\n⚠️  警告: 没有配置高级翻译服务，只能使用免费的 Google Translate');
  console.log('   推荐至少配置一个:');
  console.log('   - GEMINI_API_KEY (推荐)');
  console.log('   - OPENAI_API_KEY');
  console.log('   - MISTRAL_API_KEY');
}

console.log('\n═══════════════════════════════════════');

// 检查数据库文件
const fs = require('fs');
const path = require('path');

if (!process.env.USE_TURSO) {
  const dbPath = path.join(__dirname, 'data', 'events.db');
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('\n📁 本地数据库文件:');
    console.log('  路径:', dbPath);
    console.log('  大小:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('  修改时间:', stats.mtime.toLocaleString());

    // 尝试读取记录数
    try {
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(dbPath);
      db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        if (!err) {
          console.log('  记录数:', row.count, '条活动');

          db.get('SELECT COUNT(*) as count FROM events WHERE title_zh IS NULL OR title_zh = ""', (err2, row2) => {
            if (!err2) {
              console.log('  缺失翻译:', row2.count, '条');
            }
            console.log('═══════════════════════════════════════\n');
            db.close();
          });
        } else {
          console.log('═══════════════════════════════════════\n');
          db.close();
        }
      });
    } catch (e) {
      console.log('═══════════════════════════════════════\n');
    }
  } else {
    console.log('\n⚠️  本地数据库文件不存在:', dbPath);
    console.log('   运行 scraper 将自动创建');
    console.log('═══════════════════════════════════════\n');
  }
}
