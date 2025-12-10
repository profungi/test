#!/usr/bin/env node

/**
 * Turso → Local 单向同步脚本
 *
 * 功能：
 * - 只同步 events 表（活动数据）
 * - 不触碰 feedback 表（posts, event_performance, weight_adjustments）
 * - 支持增量同步和全量同步
 * - 保留本地独有的数据
 */

require('dotenv').config();

const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class TursoToLocalSync {
  constructor() {
    // Turso 客户端
    this.tursoClient = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // 本地 SQLite
    const dbPath = path.join(__dirname, 'data', 'events.db');
    this.localDb = new sqlite3.Database(dbPath);
  }

  async run(options = {}) {
    const {
      mode = 'incremental',  // incremental | full
      since = null,          // 只同步此日期后的数据
      dryRun = false         // 预览模式，不实际写入
    } = options;

    console.log('\n═══════════════════════════════════════');
    console.log('🔄 Turso → Local 数据同步');
    console.log('═══════════════════════════════════════\n');

    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      console.error('❌ 错误: 缺少 Turso 配置');
      console.error('   请在 .env 文件中设置:');
      console.error('   - TURSO_DATABASE_URL');
      console.error('   - TURSO_AUTH_TOKEN');
      process.exit(1);
    }

    console.log('📋 同步配置:');
    console.log(`   模式: ${mode === 'full' ? '全量同步' : '增量同步'}`);
    console.log(`   预览模式: ${dryRun ? '是（不会实际写入）' : '否'}`);
    if (since) {
      console.log(`   时间过滤: ${since} 之后的数据`);
    }
    console.log('');

    try {
      // 1. 获取本地最新的 scraped_at 时间
      let lastSyncTime = null;
      if (mode === 'incremental' && !since) {
        lastSyncTime = await this.getLastSyncTime();
        console.log(`📅 上次同步时间: ${lastSyncTime || '无（首次同步）'}\n`);
      }

      // 2. 从 Turso 获取数据
      console.log('📡 正在从 Turso 获取数据...');
      const tursoEvents = await this.fetchFromTurso(since || lastSyncTime);
      console.log(`   ✅ 获取到 ${tursoEvents.length} 条记录\n`);

      if (tursoEvents.length === 0) {
        console.log('✅ 没有新数据需要同步！');
        return;
      }

      // 3. 预览数据
      this.previewData(tursoEvents);

      // 4. 同步到本地
      if (!dryRun) {
        console.log('\n💾 正在同步到本地数据库...');
        const stats = await this.syncToLocal(tursoEvents, mode);

        console.log('\n✅ 同步完成！');
        console.log('\n📊 同步统计:');
        console.log(`   新增: ${stats.inserted} 条`);
        console.log(`   更新: ${stats.updated} 条`);
        console.log(`   跳过: ${stats.skipped} 条`);
        console.log(`   失败: ${stats.failed} 条`);
      } else {
        console.log('\n🔍 预览模式 - 未实际写入数据');
      }

      console.log('\n═══════════════════════════════════════\n');

    } catch (error) {
      console.error('\n❌ 同步失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await this.close();
    }
  }

  async getLastSyncTime() {
    return new Promise((resolve, reject) => {
      this.localDb.get(
        'SELECT MAX(scraped_at) as last_time FROM events',
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.last_time || null);
        }
      );
    });
  }

  async fetchFromTurso(sinceTime) {
    let query = `
      SELECT
        id, title, normalized_title, start_time, end_time, location,
        price, description, description_detail, original_url, short_url,
        source, event_type, priority, scraped_at, week_identifier,
        is_processed, title_zh
      FROM events
    `;

    const args = [];

    if (sinceTime) {
      query += ' WHERE scraped_at > ?';
      args.push(sinceTime);
    }

    query += ' ORDER BY scraped_at ASC';

    const result = await this.tursoClient.execute({
      sql: query,
      args: args
    });

    return result.rows;
  }

  previewData(events) {
    console.log('📋 数据预览:');

    // 显示前 5 条和最后 1 条
    const preview = events.slice(0, 5);
    preview.forEach((event, i) => {
      console.log(`   ${i + 1}. ${event.title}`);
      console.log(`      地点: ${event.location}`);
      console.log(`      时间: ${event.start_time}`);
      console.log(`      来源: ${event.source}`);
      console.log(`      抓取: ${event.scraped_at}`);
      if (event.title_zh) {
        console.log(`      中文: ${event.title_zh}`);
      }
      console.log('');
    });

    if (events.length > 5) {
      console.log(`   ... 还有 ${events.length - 5} 条记录`);
      const last = events[events.length - 1];
      console.log(`   ${events.length}. ${last.title} (${last.scraped_at})\n`);
    }
  }

  async syncToLocal(events, mode) {
    const stats = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    };

    // 如果是全量同步，先清空 events 表
    if (mode === 'full') {
      console.log('   ⚠️  全量同步：清空本地 events 表...');
      await this.clearLocalEvents();
      console.log('   ✅ 已清空');
    }

    for (const event of events) {
      try {
        const result = await this.upsertEvent(event);
        if (result === 'inserted') stats.inserted++;
        else if (result === 'updated') stats.updated++;
        else stats.skipped++;
      } catch (error) {
        console.error(`   ❌ 同步失败: ${event.title} - ${error.message}`);
        stats.failed++;
      }
    }

    return stats;
  }

  async clearLocalEvents() {
    return new Promise((resolve, reject) => {
      this.localDb.run('DELETE FROM events', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async upsertEvent(event) {
    return new Promise((resolve, reject) => {
      // 先检查是否存在（基于 original_url）
      this.localDb.get(
        'SELECT id FROM events WHERE original_url = ?',
        [event.original_url],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            // 更新现有记录
            const updateQuery = `
              UPDATE events SET
                title = ?, normalized_title = ?, start_time = ?, end_time = ?,
                location = ?, price = ?, description = ?, description_detail = ?,
                short_url = ?, source = ?, event_type = ?, priority = ?,
                scraped_at = ?, week_identifier = ?, is_processed = ?, title_zh = ?
              WHERE original_url = ?
            `;

            this.localDb.run(updateQuery, [
              event.title,
              event.normalized_title,
              event.start_time,
              event.end_time,
              event.location,
              event.price,
              event.description,
              event.description_detail,
              event.short_url,
              event.source,
              event.event_type,
              event.priority,
              event.scraped_at,
              event.week_identifier,
              event.is_processed,
              event.title_zh,
              event.original_url
            ], (err) => {
              if (err) reject(err);
              else resolve('updated');
            });
          } else {
            // 插入新记录
            const insertQuery = `
              INSERT INTO events (
                title, normalized_title, start_time, end_time, location,
                price, description, description_detail, original_url, short_url,
                source, event_type, priority, scraped_at, week_identifier,
                is_processed, title_zh
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.localDb.run(insertQuery, [
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
              else resolve('inserted');
            });
          }
        }
      );
    });
  }

  async close() {
    return new Promise((resolve) => {
      this.localDb.close((err) => {
        if (err) console.error('关闭本地数据库时出错:', err);
        resolve();
      });
    });
  }

  static showHelp() {
    console.log(`
🔄 Turso → Local 数据同步工具

用法:
  node sync-from-turso.js [选项]

选项:
  --full              全量同步（清空本地 events 表并重新导入）
  --incremental       增量同步（只同步新数据，默认）
  --since DATE        只同步指定日期后的数据（如: 2025-12-01）
  --dry-run           预览模式（不实际写入数据）
  -h, --help          显示帮助信息

环境变量:
  TURSO_DATABASE_URL  Turso 数据库 URL（必需）
  TURSO_AUTH_TOKEN    Turso 认证令牌（必需）

示例:
  # 增量同步（默认）
  node sync-from-turso.js

  # 全量同步
  node sync-from-turso.js --full

  # 预览同步但不实际写入
  node sync-from-turso.js --dry-run

  # 只同步 12月1日后的数据
  node sync-from-turso.js --since 2025-12-01

重要说明:
  ✅ 只同步 events 表（活动数据）
  ✅ 不会触碰 feedback 表（posts, event_performance, weight_adjustments）
  ✅ 使用 original_url 作为唯一标识，避免重复
  ✅ 保留本地独有的数据（如 feedback 数据）

同步策略:
  - 增量同步: 只同步上次同步后的新数据（基于 scraped_at）
  - 全量同步: 清空 events 表，重新导入所有数据
  - Upsert 逻辑: 存在则更新，不存在则插入
`);
  }
}

// 解析命令行参数
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  TursoToLocalSync.showHelp();
  process.exit(0);
}

const options = {
  mode: args.includes('--full') ? 'full' : 'incremental',
  since: args.find(arg => arg.startsWith('--since'))?.split('=')[1] || null,
  dryRun: args.includes('--dry-run')
};

// 如果 --since 后面有空格，获取下一个参数
if (args.includes('--since') && !options.since) {
  const sinceIndex = args.indexOf('--since');
  options.since = args[sinceIndex + 1];
}

const syncer = new TursoToLocalSync();
syncer.run(options).catch(err => {
  console.error('❌ 同步失败:', err);
  process.exit(1);
});
