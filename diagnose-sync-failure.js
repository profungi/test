#!/usr/bin/env node

/**
 * 诊断 Turso 同步失败的原因
 *
 * 这个脚本会逐步测试每个可能失败的环节
 */

console.log('═══════════════════════════════════════════════════════════');
console.log('  🔍 Turso 同步失败诊断工具');
console.log('═══════════════════════════════════════════════════════════\n');

// Step 1: 检查依赖包
console.log('📦 步骤 1: 检查依赖包...\n');

let dotenvLoaded = false;
let libsqlAvailable = false;
let sqlite3Available = false;

try {
  require('dotenv').config();
  console.log('   ✅ dotenv 加载成功');
  dotenvLoaded = true;
} catch (err) {
  console.log('   ❌ dotenv 加载失败:', err.message);
  console.log('   解决方案: npm install dotenv\n');
  process.exit(1);
}

try {
  const { createClient } = require('@libsql/client');
  console.log('   ✅ @libsql/client 可用');
  libsqlAvailable = true;
} catch (err) {
  console.log('   ❌ @libsql/client 不可用:', err.message);
  console.log('   解决方案: npm install @libsql/client\n');
}

try {
  const sqlite3 = require('sqlite3');
  console.log('   ✅ sqlite3 可用');
  sqlite3Available = true;
} catch (err) {
  console.log('   ❌ sqlite3 不可用:', err.message);
  console.log('   解决方案: npm install sqlite3\n');
}

if (!libsqlAvailable || !sqlite3Available) {
  console.log('\n运行 npm install 安装所有依赖\n');
  process.exit(1);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Step 2: 检查环境变量
console.log('🔐 步骤 2: 检查环境变量...\n');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL) {
  console.log('   ❌ TURSO_DATABASE_URL 未配置');
  console.log('   请在 .env 文件中添加: TURSO_DATABASE_URL=...\n');
  process.exit(1);
}

if (!TURSO_TOKEN) {
  console.log('   ❌ TURSO_AUTH_TOKEN 未配置');
  console.log('   请在 .env 文件中添加: TURSO_AUTH_TOKEN=...\n');
  process.exit(1);
}

console.log(`   ✅ TURSO_DATABASE_URL: ${TURSO_URL.substring(0, 30)}...`);
console.log(`   ✅ TURSO_AUTH_TOKEN: ${TURSO_TOKEN.substring(0, 20)}...`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Step 3: 测试 Turso 连接
console.log('🌐 步骤 3: 测试 Turso 连接...\n');

const { createClient } = require('@libsql/client');
const tursoClient = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

(async () => {
  try {
    // 测试简单查询
    const result = await tursoClient.execute('SELECT 1 as test');
    console.log('   ✅ Turso 连接成功');
    console.log(`   测试查询结果: ${JSON.stringify(result.rows[0])}`);
  } catch (err) {
    console.log('   ❌ Turso 连接失败:', err.message);
    console.log('\n   可能的原因:');
    console.log('   1. TURSO_DATABASE_URL 不正确');
    console.log('   2. TURSO_AUTH_TOKEN 已过期或无效');
    console.log('   3. 网络连接问题');
    console.log('   4. Turso 数据库不存在或已删除\n');

    if (err.message.includes('JWT')) {
      console.log('   💡 提示: Token 可能已过期，请重新生成:');
      console.log('      turso db tokens create <database-name>\n');
    }

    if (err.message.includes('not found') || err.message.includes('404')) {
      console.log('   💡 提示: 数据库可能不存在，检查数据库名称:');
      console.log('      turso db list\n');
    }

    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 4: 测试 Turso 表结构
  console.log('📊 步骤 4: 检查 Turso 表结构...\n');

  try {
    // 检查 events 表
    const eventsCheck = await tursoClient.execute(`
      SELECT COUNT(*) as count FROM events LIMIT 1
    `);
    console.log(`   ✅ events 表存在 (记录数: ${eventsCheck.rows[0].count})`);
  } catch (err) {
    console.log('   ❌ events 表不存在或无法访问:', err.message);
    console.log('   可能需要先创建表结构\n');
  }

  try {
    // 检查 user_feedback 表
    const feedbackCheck = await tursoClient.execute(`
      SELECT COUNT(*) as count FROM user_feedback LIMIT 1
    `);
    console.log(`   ✅ user_feedback 表存在 (记录数: ${feedbackCheck.rows[0].count})`);
  } catch (err) {
    console.log('   ⚠️  user_feedback 表不存在或无法访问:', err.message);
  }

  // 测试查询 events 表的列
  try {
    const sampleEvent = await tursoClient.execute(`
      SELECT id, title, scraped_at, title_zh, summary_en, summary_zh
      FROM events
      LIMIT 1
    `);

    if (sampleEvent.rows.length > 0) {
      console.log('\n   📋 Events 表列检查:');
      const row = sampleEvent.rows[0];
      console.log(`      id: ${row.id ? '✅' : '❌'}`);
      console.log(`      title: ${row.title ? '✅' : '❌'}`);
      console.log(`      scraped_at: ${row.scraped_at ? '✅' : '❌'}`);
      console.log(`      title_zh: ${row.title_zh !== undefined ? '✅' : '⚠️  (可选)'}`);
      console.log(`      summary_en: ${row.summary_en !== undefined ? '✅' : '⚠️  (可选)'}`);
      console.log(`      summary_zh: ${row.summary_zh !== undefined ? '✅' : '⚠️  (可选)'}`);
    }
  } catch (err) {
    console.log('   ⚠️  无法读取 events 表结构:', err.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 5: 检查本地数据库
  console.log('💾 步骤 5: 检查本地数据库...\n');

  const path = require('path');
  const fs = require('fs');
  const sqlite3 = require('sqlite3').verbose();

  const dbPath = path.join(__dirname, 'data', 'events.db');

  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    console.log('   ⚠️  data 目录不存在，创建中...');
    fs.mkdirSync(path.join(__dirname, 'data'));
  }

  if (!fs.existsSync(dbPath)) {
    console.log(`   ⚠️  本地数据库不存在: ${dbPath}`);
    console.log('   同步时会自动创建，但请确保 data 目录有写权限\n');
  } else {
    console.log(`   ✅ 本地数据库存在: ${dbPath}`);

    // 测试本地数据库连接
    const localDb = new sqlite3.Database(dbPath);

    await new Promise((resolve, reject) => {
      localDb.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        if (err) {
          console.log('   ❌ 本地 events 表读取失败:', err.message);
          console.log('   可能需要重新初始化本地数据库\n');
        } else {
          console.log(`   ✅ 本地 events 表可访问 (记录数: ${row.count})`);
        }
        localDb.close();
        resolve();
      });
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 6: 测试同步逻辑
  console.log('🔄 步骤 6: 测试同步逻辑...\n');

  try {
    // 获取最新的一条记录测试
    const testQuery = await tursoClient.execute(`
      SELECT
        id, title, normalized_title, start_time, end_time, location,
        price, description, description_detail, original_url, short_url,
        source, event_type, priority, scraped_at, week_identifier,
        is_processed, title_zh, summary_en, summary_zh
      FROM events
      ORDER BY scraped_at DESC
      LIMIT 1
    `);

    if (testQuery.rows.length === 0) {
      console.log('   ⚠️  Turso 数据库中没有任何 events 记录');
      console.log('   无法测试同步逻辑，请先添加一些数据\n');
    } else {
      console.log('   ✅ 成功从 Turso 读取测试数据');
      const testRow = testQuery.rows[0];
      console.log(`   示例记录: [ID ${testRow.id}] ${testRow.title}`);
      console.log(`   抓取时间: ${testRow.scraped_at}`);
      console.log(`   来源: ${testRow.source}`);

      // 检查所有必需字段是否存在
      const requiredFields = [
        'id', 'title', 'start_time', 'location', 'source', 'scraped_at'
      ];

      const missingFields = requiredFields.filter(field => !testRow[field]);

      if (missingFields.length > 0) {
        console.log(`\n   ⚠️  缺少必需字段: ${missingFields.join(', ')}`);
        console.log('   这可能导致同步失败\n');
      } else {
        console.log('   ✅ 所有必需字段都存在');
      }
    }
  } catch (err) {
    console.log('   ❌ 测试查询失败:', err.message);
    console.log(`   错误堆栈:\n${err.stack}\n`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 7: 测试实际同步一条记录
  console.log('🧪 步骤 7: 测试同步单条记录...\n');

  try {
    const testEvent = await tursoClient.execute(`
      SELECT
        id, title, normalized_title, start_time, end_time, location,
        price, description, description_detail, original_url, short_url,
        source, event_type, priority, scraped_at, week_identifier,
        is_processed, title_zh, summary_en, summary_zh
      FROM events
      ORDER BY scraped_at DESC
      LIMIT 1
    `);

    if (testEvent.rows.length > 0 && fs.existsSync(dbPath)) {
      const event = testEvent.rows[0];
      const localDb = new sqlite3.Database(dbPath);

      await new Promise((resolve, reject) => {
        // 检查记录是否已存在
        localDb.get('SELECT id FROM events WHERE id = ?', [event.id], (err, row) => {
          if (err) {
            console.log('   ❌ 查询本地数据库失败:', err.message);
            reject(err);
            return;
          }

          const action = row ? 'UPDATE' : 'INSERT';
          console.log(`   📝 将${action === 'UPDATE' ? '更新' : '插入'}记录: [ID ${event.id}] ${event.title}`);

          if (action === 'UPDATE') {
            const updateQuery = `
              UPDATE events SET
                title = ?, normalized_title = ?, start_time = ?, end_time = ?,
                location = ?, price = ?, description = ?, description_detail = ?,
                original_url = ?, short_url = ?, source = ?, event_type = ?,
                priority = ?, scraped_at = ?, week_identifier = ?, is_processed = ?,
                title_zh = ?, summary_en = ?, summary_zh = ?
              WHERE id = ?
            `;

            localDb.run(updateQuery, [
              event.title, event.normalized_title, event.start_time, event.end_time,
              event.location, event.price, event.description, event.description_detail,
              event.original_url, event.short_url, event.source, event.event_type,
              event.priority, event.scraped_at, event.week_identifier, event.is_processed,
              event.title_zh, event.summary_en, event.summary_zh, event.id
            ], (err) => {
              if (err) {
                console.log('   ❌ 更新失败:', err.message);
                reject(err);
              } else {
                console.log('   ✅ 更新成功！');
                resolve();
              }
              localDb.close();
            });
          } else {
            const insertQuery = `
              INSERT INTO events (
                id, title, normalized_title, start_time, end_time, location,
                price, description, description_detail, original_url, short_url,
                source, event_type, priority, scraped_at, week_identifier,
                is_processed, title_zh, summary_en, summary_zh
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            localDb.run(insertQuery, [
              event.id, event.title, event.normalized_title, event.start_time, event.end_time,
              event.location, event.price, event.description, event.description_detail,
              event.original_url, event.short_url, event.source, event.event_type,
              event.priority, event.scraped_at, event.week_identifier, event.is_processed,
              event.title_zh, event.summary_en, event.summary_zh
            ], (err) => {
              if (err) {
                console.log('   ❌ 插入失败:', err.message);
                console.log('   错误详情:', err);
                reject(err);
              } else {
                console.log('   ✅ 插入成功！');
                resolve();
              }
              localDb.close();
            });
          }
        });
      });
    } else {
      console.log('   ⏭️  跳过（没有测试数据或本地数据库不存在）');
    }
  } catch (err) {
    console.log('   ❌ 同步测试失败:', err.message);
    console.log(`   错误堆栈:\n${err.stack}\n`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Final Summary
  console.log('✅ 诊断完成！\n');
  console.log('如果所有测试都通过，但 sync-from-turso.js 仍然失败，请提供完整的错误信息。\n');
  console.log('运行完整同步:');
  console.log('  npm run sync-from-turso\n');
  console.log('或预览模式:');
  console.log('  npm run sync-preview\n');

})().catch(err => {
  console.error('\n❌ 诊断过程中发生错误:', err.message);
  console.error(err.stack);
  process.exit(1);
});
