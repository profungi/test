#!/usr/bin/env node

/**
 * 隔离测试脚本 - 使用独立的测试数据库运行完整的scrape流程
 * 不会污染生产数据库（Turso）或开发数据库（local SQLite）
 */

const path = require('path');
const fs = require('fs');

// ⚠️ 重要：在require任何模块之前设置环境变量
// 这样config.js在加载时就能使用正确的DATABASE_PATH

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

// ⚠️ 关键：在require任何模块之前设置环境变量
delete process.env.USE_TURSO;  // 禁用Turso
process.env.DATABASE_PATH = TEST_DB_PATH;  // 设置测试数据库路径

// 删除已经缓存的config模块（如果有）
delete require.cache[require.resolve('./src/config.js')];
delete require.cache[require.resolve('./src/utils/database.js')];

// 现在加载config和其他模块
const config = require('./src/config');

// 强制覆盖config.database.path（双保险）
config.database.path = TEST_DB_PATH;

console.log('⚙️  配置信息:');
console.log(`   数据库类型: SQLite (测试隔离)`);
console.log(`   数据库路径: ${config.database.path}`);
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

    // 验证数据库配置
    console.log(`🔍 验证数据库配置:`);
    console.log(`   orchestrator.database 路径: ${orchestrator.database.dbPath}`);
    console.log('');

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
  }
}

// 显示数据库统计信息
async function showDatabaseStats() {
  const sqlite3 = require('sqlite3').verbose();

  return new Promise((resolve, reject) => {
    // 检查数据库文件是否存在且有内容
    if (!fs.existsSync(TEST_DB_PATH)) {
      console.log('⚠️  测试数据库文件不存在！');
      resolve();
      return;
    }

    const stats = fs.statSync(TEST_DB_PATH);
    console.log(`📦 数据库文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

    if (stats.size === 0) {
      console.log('⚠️  测试数据库为空！没有写入任何数据。');
      resolve();
      return;
    }

    const db = new sqlite3.Database(TEST_DB_PATH, (err) => {
      if (err) {
        console.error('⚠️  无法打开测试数据库:', err.message);
        resolve();
        return;
      }

      console.log('\n📊 测试数据库统计:');

      // 统计总活动数
      db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        if (err) {
          console.error('   ⚠️  无法读取活动统计:', err.message);
          db.close();
          resolve();
          return;
        }

        console.log(`   总活动数: ${row.count}`);

        if (row.count === 0) {
          console.log('   ⚠️  数据库中没有活动记录！');
          db.close();
          resolve();
          return;
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

            // 检查翻译和摘要
            db.get(`SELECT
              COUNT(*) as total,
              SUM(CASE WHEN title_zh IS NOT NULL AND title_zh != '' THEN 1 ELSE 0 END) as with_translation,
              SUM(CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) as with_summary
            FROM events`, (err, row) => {
              if (err) {
                console.error('   ⚠️  无法读取翻译统计');
              } else {
                console.log('\n   翻译和摘要:');
                console.log(`     已翻译: ${row.with_translation}/${row.total}`);
                console.log(`     有摘要: ${row.with_summary}/${row.total}`);
              }

              // 显示前5个活动样例
              db.all('SELECT title, title_zh, source, start_time, location, summary FROM events LIMIT 5', (err, rows) => {
                if (err) {
                  console.error('   ⚠️  无法读取活动样例');
                } else if (rows.length > 0) {
                  console.log('\n   活动样例（前5个）:');
                  rows.forEach((row, idx) => {
                    console.log(`     ${idx + 1}. ${row.title}`);
                    if (row.title_zh) console.log(`        中文: ${row.title_zh}`);
                    console.log(`        来源: ${row.source}`);
                    console.log(`        时间: ${row.start_time}`);
                    console.log(`        地点: ${row.location}`);
                    if (row.summary) console.log(`        摘要: ${row.summary.substring(0, 50)}...`);
                    console.log('');
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
