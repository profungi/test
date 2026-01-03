#!/usr/bin/env node

/**
 * 快速测试脚本 - 只测试几个sources验证修复
 * 用于快速验证时间过滤、location清理、内容验证是否正常工作
 */

const path = require('path');
const fs = require('fs');

// 设置测试数据库路径
const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-quick.db');
const TEST_DB_DIR = path.dirname(TEST_DB_PATH);

// 确保测试数据目录存在
if (!fs.existsSync(TEST_DB_DIR)) {
  fs.mkdirSync(TEST_DB_DIR, { recursive: true });
}

// 删除旧的测试数据库
if (fs.existsSync(TEST_DB_PATH)) {
  console.log('🗑️  删除旧的测试数据库...');
  fs.unlinkSync(TEST_DB_PATH);
}

// ⚠️ 关键：在require任何模块之前设置环境变量
// 注意：不能 delete USE_TURSO，因为 dotenv.config() 会重新从 .env 读取
// 必须设置为空字符串（falsy值），这样 dotenv 不会覆盖，且 boolean 判断为 false
process.env.USE_TURSO = '';  // 禁用Turso（空字符串 = false）
process.env.DATABASE_PATH = TEST_DB_PATH;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 快速测试 - 验证P0修复');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`📁 测试数据库: ${TEST_DB_PATH}\n`);

const EventDatabase = require('./src/utils/database');
const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');
const ConfigurableScraperManager = require('./src/scrapers/configurable-scraper-manager');

async function main() {
  const database = new EventDatabase();

  console.log(`🔍 验证数据库路径: ${database.dbPath}\n`);

  try {
    await database.connect();

    // 1. 测试Eventbrite (legacy scraper)
    console.log('1️⃣  测试 Eventbrite Scraper...');
    const eventbriteScraper = new EventbriteScraper();
    const eventbriteEvents = await eventbriteScraper.scrape('next');
    console.log(`   ✅ Eventbrite: ${eventbriteEvents.length} 个活动\n`);

    // 保存到数据库
    for (const event of eventbriteEvents.slice(0, 5)) {  // 只保存前5个用于测试
      await database.saveEvent(event);
    }

    // 2. 测试CSS Configurable Scraper (DoTheBay)
    console.log('2️⃣  测试 CSS Configurable Scrapers...');
    const manager = new ConfigurableScraperManager();
    const cssScrapers = manager.getCSSScrapers();
    console.log(`   找到 ${cssScrapers.length} 个CSS scrapers`);

    for (const scraper of cssScrapers) {
      console.log(`   抓取: ${scraper.config.displayName}...`);
      try {
        const events = await scraper.scrape('next');
        console.log(`   ✅ ${scraper.config.displayName}: ${events.length} 个活动`);

        // 保存前3个活动
        for (const event of events.slice(0, 3)) {
          await database.saveEvent(event);
        }
      } catch (err) {
        console.log(`   ⚠️  ${scraper.config.displayName} 失败: ${err.message}`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 测试结果统计\n');

    // 显示数据库统计
    await showStats(database);

    await database.close();

    console.log('\n✅ 快速测试完成！');
    console.log(`\n💡 查看数据: sqlite3 ${TEST_DB_PATH}`);
    console.log(`💡 删除测试数据: rm ${TEST_DB_PATH}\n`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    await database.close();
    process.exit(1);
  }
}

async function showStats(database) {
  return new Promise((resolve) => {
    database.db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
      if (err) {
        console.error('无法读取统计:', err.message);
        resolve();
        return;
      }

      console.log(`总活动数: ${row.count}`);

      // 按source统计
      database.db.all('SELECT source, COUNT(*) as count FROM events GROUP BY source', (err, rows) => {
        if (!err && rows) {
          console.log('\n按来源分类:');
          rows.forEach(r => console.log(`  ${r.source}: ${r.count} 个`));
        }

        // 显示样例活动
        database.db.all(`
          SELECT title, source, start_time, location
          FROM events
          ORDER BY start_time
          LIMIT 5
        `, (err, rows) => {
          if (!err && rows && rows.length > 0) {
            console.log('\n活动样例:');
            rows.forEach((r, i) => {
              console.log(`  ${i + 1}. ${r.title}`);
              console.log(`     来源: ${r.source}`);
              console.log(`     时间: ${r.start_time}`);
              console.log(`     地点: ${r.location || 'N/A'}`);
            });
          }
          resolve();
        });
      });
    });
  });
}

main();
