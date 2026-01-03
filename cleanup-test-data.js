#!/usr/bin/env node

/**
 * 清理测试数据脚本
 * 删除最近写入的测试数据（Turso + 本地数据库）
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

async function cleanupLocalDB() {
  const dbPath = './data/events.db';

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      console.log('📁 本地数据库: data/events.db\n');

      // 先查看要删除的数据
      db.all(`
        SELECT source, COUNT(*) as count, MIN(scraped_at) as first, MAX(scraped_at) as last
        FROM events
        WHERE scraped_at > datetime('now', '-3 hours')
        GROUP BY source
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        if (rows.length === 0) {
          console.log('✅ 本地数据库没有最近3小时的数据，无需清理\n');
          db.close();
          resolve();
          return;
        }

        console.log('🔍 将要删除的数据:');
        let total = 0;
        rows.forEach(row => {
          console.log(`   ${row.source}: ${row.count} 条`);
          console.log(`   时间范围: ${row.first} 到 ${row.last}`);
          total += row.count;
        });
        console.log(`   总计: ${total} 条\n`);

        // 执行删除
        db.run(`
          DELETE FROM events
          WHERE scraped_at > datetime('now', '-3 hours')
        `, function(err) {
          if (err) {
            reject(err);
            return;
          }

          console.log(`✅ 本地数据库已删除 ${this.changes} 条记录\n`);
          db.close();
          resolve();
        });
      });
    });
  });
}

async function cleanupTursoDB() {
  // 检查 Turso 配置
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.log('⚠️  Turso 配置未找到（TURSO_DATABASE_URL 或 TURSO_AUTH_TOKEN 未设置）');
    console.log('   跳过 Turso 数据库清理\n');
    return;
  }

  const { createClient } = require('@libsql/client');

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('📁 Turso 数据库\n');

  try {
    // 先查看要删除的数据
    const result = await client.execute({
      sql: `
        SELECT source, COUNT(*) as count, MIN(scraped_at) as first, MAX(scraped_at) as last
        FROM events
        WHERE scraped_at > datetime('now', '-3 hours')
        GROUP BY source
      `,
      args: []
    });

    if (result.rows.length === 0) {
      console.log('✅ Turso 数据库没有最近3小时的数据，无需清理\n');
      return;
    }

    console.log('🔍 将要删除的数据:');
    let total = 0;
    result.rows.forEach(row => {
      console.log(`   ${row.source}: ${row.count} 条`);
      console.log(`   时间范围: ${row.first} 到 ${row.last}`);
      total += Number(row.count);
    });
    console.log(`   总计: ${total} 条\n`);

    // 执行删除
    const deleteResult = await client.execute({
      sql: `DELETE FROM events WHERE scraped_at > datetime('now', '-3 hours')`,
      args: []
    });

    console.log(`✅ Turso 数据库已删除 ${deleteResult.rowsAffected} 条记录\n`);

  } catch (error) {
    console.error('❌ Turso 数据库清理失败:', error.message);
    throw error;
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧹 清理测试数据');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⏰ 删除范围: 最近3小时写入的数据\n');

  try {
    // 清理本地数据库
    await cleanupLocalDB();

    // 清理 Turso 数据库
    await cleanupTursoDB();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 清理完成！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ 清理失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
