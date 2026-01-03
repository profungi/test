#!/usr/bin/env node

/**
 * 隔离测试脚本 - 使用独立的测试数据库运行完整的scrape流程
 * 不会污染生产数据库（Turso）或开发数据库（local SQLite）
 */

const path = require('path');
const fs = require('fs');

// 设置测试数据库路径
const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-scrape.db');
const TEST_DB_DIR = path.dirname(TEST_DB_PATH);

// 确保测试数据目录存在
if (!fs.existsSync(TEST_DB_DIR)) {
  fs.mkdirSync(TEST_DB_DIR, { recursive: true });
}

// 删除旧的测试数据库（每次测试都从干净状态开始）
if (fs.existsSync(TEST_DB_PATH)) {
  console.log('🗑️  删除旧的测试数据库...');
  fs.unlinkSync(TEST_DB_PATH);
}

console.log(`📁 测试数据库路径: ${TEST_DB_PATH}\n`);

// 临时修改环境变量，强制使用本地SQLite并指向测试数据库
const originalEnv = {
  USE_TURSO: process.env.USE_TURSO,
  DATABASE_PATH: process.env.DATABASE_PATH
};

// 禁用Turso，使用本地SQLite
delete process.env.USE_TURSO;
process.env.DATABASE_PATH = TEST_DB_PATH;

// 临时修改config以使用测试数据库
const config = require('./src/config');
const originalDbPath = config.database.path;
config.database.path = TEST_DB_PATH;

console.log('⚙️  配置信息:');
console.log(`   数据库类型: SQLite (测试隔离)`);
console.log(`   数据库路径: ${TEST_DB_PATH}`);
console.log(`   输出目录: ${config.output.directory}\n`);

// 加载scraper orchestrator
const EventScrapeOrchestrator = require('./src/scrape-events.js');

// 处理命令行参数
async function main() {
  const args = process.argv.slice(2);

  // 处理周选择
  let targetWeek = 'next'; // 默认下周
  const weekIndex = args.indexOf('--week');
  if (weekIndex !== -1 && args[weekIndex + 1]) {
    const week = args[weekIndex + 1];
    if (['current', 'next'].includes(week)) {
      targetWeek = week;
    } else {
      console.error(`❌ Invalid week option: ${week}`);
      console.error('Valid options: current, next');
      process.exit(1);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 开始隔离测试 - 完整Scrape流程');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const orchestrator = new EventScrapeOrchestrator({ week: targetWeek });
    await orchestrator.run();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 测试完成！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 显示测试数据库统计
    await showDatabaseStats();

    console.log('\n💡 提示:');
    console.log(`   测试数据库: ${TEST_DB_PATH}`);
    console.log(`   查看数据: sqlite3 ${TEST_DB_PATH}`);
    console.log(`   删除测试数据: rm -rf ${TEST_DB_DIR}\n`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // 恢复原始环境变量
    if (originalEnv.USE_TURSO) {
      process.env.USE_TURSO = originalEnv.USE_TURSO;
    } else {
      delete process.env.USE_TURSO;
    }

    if (originalEnv.DATABASE_PATH) {
      process.env.DATABASE_PATH = originalEnv.DATABASE_PATH;
    } else {
      delete process.env.DATABASE_PATH;
    }

    // 恢复config
    config.database.path = originalDbPath;
  }
}

// 显示数据库统计信息
async function showDatabaseStats() {
  const sqlite3 = require('sqlite3').verbose();

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(TEST_DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      console.log('📊 测试数据库统计:');

      // 统计总活动数
      db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        if (err) {
          console.error('   ⚠️  无法读取活动统计');
        } else {
          console.log(`   总活动数: ${row.count}`);
        }

        // 按source统计
        db.all('SELECT source, COUNT(*) as count FROM events GROUP BY source ORDER BY count DESC', (err, rows) => {
          if (err) {
            console.error('   ⚠️  无法读取来源统计');
          } else {
            console.log('\n   按来源分类:');
            rows.forEach(row => {
              console.log(`     ${row.source}: ${row.count} 个活动`);
            });
          }

          // 按event_type统计
          db.all('SELECT event_type, COUNT(*) as count FROM events GROUP BY event_type ORDER BY count DESC', (err, rows) => {
            if (err) {
              console.error('   ⚠️  无法读取类型统计');
            } else {
              console.log('\n   按类型分类:');
              rows.forEach(row => {
                console.log(`     ${row.event_type || 'N/A'}: ${row.count} 个活动`);
              });
            }

            // 显示前5个活动样例
            db.all('SELECT title, source, start_time, location FROM events LIMIT 5', (err, rows) => {
              if (err) {
                console.error('   ⚠️  无法读取活动样例');
              } else if (rows.length > 0) {
                console.log('\n   活动样例（前5个）:');
                rows.forEach((row, idx) => {
                  console.log(`     ${idx + 1}. ${row.title}`);
                  console.log(`        来源: ${row.source}`);
                  console.log(`        时间: ${row.start_time}`);
                  console.log(`        地点: ${row.location}`);
                });
              }

              db.close();
              resolve();
            });
          });
        });
      });
    });
  });
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { TEST_DB_PATH };
