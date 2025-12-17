#!/usr/bin/env node

/**
 * 数据库迁移脚本：添加 summary_en 和 summary_zh 列
 * 支持 Turso 云数据库和本地 SQLite
 *
 * 用法：
 *   node scripts/migrate-add-summary-columns.js          # 迁移 Turso
 *   node scripts/migrate-add-summary-columns.js --local  # 迁移本地 SQLite
 */

require('dotenv').config();

const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function migrateTurso() {
  console.log('🔄 Migrating Turso database...\n');

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
    console.error('   Please configure these in your .env file');
    process.exit(1);
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    // 检查列是否已存在
    const tableInfo = await client.execute("PRAGMA table_info(events)");
    const columns = tableInfo.rows.map(row => row.name);

    const hasSummaryEn = columns.includes('summary_en');
    const hasSummaryZh = columns.includes('summary_zh');

    console.log('📋 Current columns:', columns.join(', '));
    console.log(`   summary_en: ${hasSummaryEn ? '✅ exists' : '❌ missing'}`);
    console.log(`   summary_zh: ${hasSummaryZh ? '✅ exists' : '❌ missing'}\n`);

    if (hasSummaryEn && hasSummaryZh) {
      console.log('✨ No migration needed - columns already exist!');
      return;
    }

    // 执行迁移
    if (!hasSummaryEn) {
      console.log('➕ Adding summary_en column...');
      await client.execute("ALTER TABLE events ADD COLUMN summary_en TEXT");
      console.log('   ✅ summary_en added');
    }

    if (!hasSummaryZh) {
      console.log('➕ Adding summary_zh column...');
      await client.execute("ALTER TABLE events ADD COLUMN summary_zh TEXT");
      console.log('   ✅ summary_zh added');
    }

    console.log('\n✨ Turso migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

async function migrateLocal() {
  console.log('🔄 Migrating local SQLite database...\n');

  const dbPath = path.join(__dirname, '..', 'data', 'events.db');

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Cannot open database:', err.message);
        reject(err);
        return;
      }

      console.log(`📂 Database: ${dbPath}\n`);

      // 检查列是否已存在
      db.all("PRAGMA table_info(events)", (err, rows) => {
        if (err) {
          console.error('❌ Error reading table info:', err.message);
          reject(err);
          return;
        }

        const columns = rows.map(row => row.name);
        const hasSummaryEn = columns.includes('summary_en');
        const hasSummaryZh = columns.includes('summary_zh');

        console.log('📋 Current columns:', columns.join(', '));
        console.log(`   summary_en: ${hasSummaryEn ? '✅ exists' : '❌ missing'}`);
        console.log(`   summary_zh: ${hasSummaryZh ? '✅ exists' : '❌ missing'}\n`);

        if (hasSummaryEn && hasSummaryZh) {
          console.log('✨ No migration needed - columns already exist!');
          db.close();
          resolve();
          return;
        }

        const migrations = [];
        if (!hasSummaryEn) migrations.push("ALTER TABLE events ADD COLUMN summary_en TEXT");
        if (!hasSummaryZh) migrations.push("ALTER TABLE events ADD COLUMN summary_zh TEXT");

        let completed = 0;
        migrations.forEach((sql, index) => {
          const columnName = index === 0 && !hasSummaryEn ? 'summary_en' : 'summary_zh';
          console.log(`➕ Adding ${columnName} column...`);

          db.run(sql, (err) => {
            if (err) {
              console.error(`❌ Failed to add column:`, err.message);
              reject(err);
              return;
            }
            console.log(`   ✅ ${columnName} added`);
            completed++;

            if (completed === migrations.length) {
              console.log('\n✨ Local migration complete!');
              db.close();
              resolve();
            }
          });
        });
      });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');

  console.log('='.repeat(50));
  console.log('  Database Migration: Add Summary Columns');
  console.log('='.repeat(50) + '\n');

  if (isLocal) {
    await migrateLocal();
  } else {
    await migrateTurso();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
