#!/usr/bin/env node

/**
 * 迁移本地数据库的ID以匹配Turso
 *
 * 策略：
 * 1. 备份本地数据库
 * 2. 清空 events 表
 * 3. 从 Turso 重新同步所有数据（带正确的ID）
 * 4. event_performance 表会自动关联到正确的 ID
 */

require('dotenv').config();

const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class IdMigration {
  constructor() {
    // Turso 客户端
    this.tursoClient = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // 本地 SQLite
    this.dbPath = path.join(__dirname, 'data', 'events.db');
    this.backupPath = path.join(__dirname, 'data', `events.db.backup.${Date.now()}`);
    this.localDb = null;
  }

  async run() {
    console.log('\n═══════════════════════════════════════');
    console.log('🔄 迁移本地数据库ID以匹配Turso');
    console.log('═══════════════════════════════════════\n');

    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      console.error('❌ 错误: 缺少 Turso 配置');
      process.exit(1);
    }

    try {
      // 1. 备份数据库
      console.log('💾 步骤 1/5: 备份本地数据库...');
      fs.copyFileSync(this.dbPath, this.backupPath);
      console.log(`   ✅ 备份已创建: ${this.backupPath}\n`);

      // 2. 打开数据库
      this.localDb = new sqlite3.Database(this.dbPath);

      // 3. 检查现有数据
      console.log('📊 步骤 2/5: 检查现有数据...');
      const stats = await this.checkCurrentState();
      console.log(`   本地 events: ${stats.localEvents} 条`);
      console.log(`   event_performance: ${stats.performance} 条`);
      console.log(`   user_feedback: ${stats.feedback} 条\n`);

      // 4. 获取 Turso 数据
      console.log('📡 步骤 3/5: 从 Turso 获取所有数据...');
      const tursoEvents = await this.fetchAllEventsFromTurso();
      console.log(`   ✅ Turso events: ${tursoEvents.length} 条\n`);

      // 5. 清空并重建 events 表
      console.log('🗑️  步骤 4/5: 清空 events 表...');
      await this.clearEventsTable();
      console.log('   ✅ events 表已清空\n');

      // 6. 重新插入数据（使用 Turso 的 ID）
      console.log('💾 步骤 5/5: 重新插入数据（使用 Turso ID）...');
      let inserted = 0;
      let failed = 0;

      for (const event of tursoEvents) {
        try {
          await this.insertEventWithId(event);
          inserted++;
          if (inserted % 50 === 0) {
            console.log(`   进度: ${inserted}/${tursoEvents.length}`);
          }
        } catch (error) {
          failed++;
          console.error(`   ❌ 插入失败 (ID ${event.id}): ${error.message}`);
        }
      }

      console.log(`\n   ✅ 插入完成: ${inserted} 成功, ${failed} 失败\n`);

      // 7. 验证
      console.log('✅ 迁移完成！\n');
      console.log('📊 迁移后状态:');
      const newStats = await this.checkCurrentState();
      console.log(`   events: ${newStats.localEvents} 条`);
      console.log(`   event_performance: ${newStats.performance} 条 (保持不变)`);
      console.log(`   user_feedback: ${newStats.feedback} 条 (保持不变)\n`);

      console.log('⚠️  重要提示:');
      console.log('   1. event_performance 中的 event_id 现在可能不匹配');
      console.log('   2. 你需要手动检查并清理无效的 performance 记录');
      console.log('   3. 或者运行以下SQL清理孤立记录:');
      console.log('      DELETE FROM event_performance WHERE event_id NOT IN (SELECT id FROM events);\n');

      console.log('💾 备份文件位置:');
      console.log(`   ${this.backupPath}\n`);

      console.log('═══════════════════════════════════════\n');

    } catch (error) {
      console.error('\n❌ 迁移失败:', error.message);
      console.error(error.stack);
      console.log(`\n💾 如果需要恢复，备份文件在: ${this.backupPath}`);
      process.exit(1);
    } finally {
      if (this.localDb) {
        this.localDb.close();
      }
    }
  }

  async checkCurrentState() {
    return new Promise((resolve, reject) => {
      this.localDb.get(`
        SELECT
          (SELECT COUNT(*) FROM events) as local_events,
          (SELECT COUNT(*) FROM event_performance) as performance,
          (SELECT COUNT(*) FROM user_feedback) as feedback
      `, (err, row) => {
        if (err) reject(err);
        else resolve({
          localEvents: row.local_events,
          performance: row.performance,
          feedback: row.feedback
        });
      });
    });
  }

  async fetchAllEventsFromTurso() {
    const result = await this.tursoClient.execute(`
      SELECT
        id, title, normalized_title, start_time, end_time, location,
        price, description, description_detail, original_url, short_url,
        source, event_type, priority, scraped_at, week_identifier,
        is_processed, title_zh
      FROM events
      ORDER BY id ASC
    `);
    return result.rows;
  }

  async clearEventsTable() {
    return new Promise((resolve, reject) => {
      this.localDb.run('DELETE FROM events', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async insertEventWithId(event) {
    return new Promise((resolve, reject) => {
      const insertQuery = `
        INSERT INTO events (
          id, title, normalized_title, start_time, end_time, location,
          price, description, description_detail, original_url, short_url,
          source, event_type, priority, scraped_at, week_identifier,
          is_processed, title_zh
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.localDb.run(insertQuery, [
        event.id,
        event.title,
        event.normalized_title,
        event.start_time,
        event.end_time,
        event.location,
        event.price,
        event.description,
        event.description_detail,
        event.original_url,
        event.short_url,
        event.source,
        event.event_type,
        event.priority,
        event.scraped_at,
        event.week_identifier,
        event.is_processed,
        event.title_zh
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// 确认提示
console.log('\n⚠️  警告: 此操作将:');
console.log('   1. 备份当前数据库');
console.log('   2. 清空 events 表');
console.log('   3. 从 Turso 重新同步所有数据');
console.log('   4. event_performance 中部分 event_id 可能会失效\n');

const args = process.argv.slice(2);
if (!args.includes('--confirm')) {
  console.log('💡 如果确认要执行，请运行:');
  console.log('   node migrate-local-ids.js --confirm\n');
  process.exit(0);
}

const migration = new IdMigration();
migration.run().catch(err => {
  console.error('❌ 执行失败:', err);
  process.exit(1);
});
