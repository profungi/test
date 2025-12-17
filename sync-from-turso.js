#!/usr/bin/env node

/**
 * Turso → Local 单向同步脚本
 *
 * 功能：
 * - 同步 events 表（活动数据）
 * - 同步 user_feedback 表（用户反馈数据）
 * - 不触碰本地独有的 feedback 表（posts, event_performance, weight_adjustments）
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
      mode = 'incremental',  // incremental | full | diff
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

    const modeLabels = {
      full: '全量同步',
      incremental: '增量同步',
      diff: '差异同步（含删除）'
    };
    console.log('📋 同步配置:');
    console.log(`   模式: ${modeLabels[mode] || mode}`);
    console.log(`   预览模式: ${dryRun ? '是（不会实际写入）' : '否'}`);
    if (since) {
      console.log(`   时间过滤: ${since} 之后的数据`);
    }
    console.log('');

    try {
      // 1. 获取本地最新的同步时间
      let lastEventSyncTime = null;
      let lastFeedbackSyncTime = null;

      if (mode === 'incremental' && !since) {
        lastEventSyncTime = await this.getLastEventSyncTime();
        lastFeedbackSyncTime = await this.getLastFeedbackSyncTime();
        console.log(`📅 上次同步时间:`);
        console.log(`   Events: ${lastEventSyncTime || '无（首次同步）'}`);
        console.log(`   Feedback: ${lastFeedbackSyncTime || '无（首次同步）'}\n`);
      }

      // 2. 从 Turso 获取数据
      console.log('📡 正在从 Turso 获取数据...');
      const tursoEvents = await this.fetchEventsFromTurso(since || lastEventSyncTime);
      const tursoFeedback = await this.fetchFeedbackFromTurso(since || lastFeedbackSyncTime);
      console.log(`   ✅ Events: ${tursoEvents.length} 条记录`);
      console.log(`   ✅ Feedback: ${tursoFeedback.length} 条记录\n`);

      if (tursoEvents.length === 0 && tursoFeedback.length === 0) {
        console.log('✅ 没有新数据需要同步！');
        return;
      }

      // 3. 预览数据
      if (tursoEvents.length > 0) {
        console.log('📋 Events 数据预览:');
        this.previewEventsData(tursoEvents);
      }

      if (tursoFeedback.length > 0) {
        console.log('\n📋 User Feedback 数据预览:');
        this.previewFeedbackData(tursoFeedback);
      }

      // 4. 同步到本地
      if (!dryRun) {
        const eventStats = { inserted: 0, updated: 0, skipped: 0, failed: 0, deleted: 0 };
        const feedbackStats = { inserted: 0, updated: 0, skipped: 0, failed: 0, deleted: 0 };

        if (tursoEvents.length > 0) {
          console.log('\n💾 正在同步 Events 到本地数据库...');
          Object.assign(eventStats, await this.syncEventsToLocal(tursoEvents, mode));
        }

        // 差异同步模式：删除本地多余的记录
        if (mode === 'diff') {
          console.log('\n🗑️  正在删除本地多余的 Events...');
          const tursoIds = tursoEvents.map(e => e.id);
          eventStats.deleted = await this.deleteLocalEventsNotInTurso(tursoIds);
        }

        if (tursoFeedback.length > 0) {
          console.log('\n💾 正在同步 User Feedback 到本地数据库...');
          Object.assign(feedbackStats, await this.syncFeedbackToLocal(tursoFeedback, mode));
        }

        console.log('\n✅ 同步完成！');

        if (tursoEvents.length > 0 || eventStats.deleted > 0) {
          console.log('\n📊 Events 同步统计:');
          console.log(`   新增: ${eventStats.inserted} 条`);
          console.log(`   更新: ${eventStats.updated} 条`);
          console.log(`   跳过: ${eventStats.skipped} 条`);
          console.log(`   删除: ${eventStats.deleted} 条`);
          console.log(`   失败: ${eventStats.failed} 条`);
        }

        if (tursoFeedback.length > 0) {
          console.log('\n📊 User Feedback 同步统计:');
          console.log(`   新增: ${feedbackStats.inserted} 条`);
          console.log(`   更新: ${feedbackStats.updated} 条`);
          console.log(`   跳过: ${feedbackStats.skipped} 条`);
          console.log(`   失败: ${feedbackStats.failed} 条`);
        }
      } else {
        console.log('\n🔍 预览模式 - 未实际写入数据');

        // 预览模式下也显示将要删除的记录
        if (mode === 'diff') {
          const tursoIds = tursoEvents.map(e => e.id);
          const toDelete = await this.getLocalEventsNotInTurso(tursoIds);
          if (toDelete.length > 0) {
            console.log(`\n🗑️  将删除 ${toDelete.length} 条本地多余的 Events:`);
            toDelete.slice(0, 10).forEach((e, i) => {
              console.log(`   ${i + 1}. [ID ${e.id}] ${e.title}`);
            });
            if (toDelete.length > 10) {
              console.log(`   ... 还有 ${toDelete.length - 10} 条`);
            }
          }
        }
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

  async getLastEventSyncTime() {
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

  async getLastFeedbackSyncTime() {
    return new Promise((resolve, reject) => {
      this.localDb.get(
        'SELECT MAX(created_at) as last_time FROM user_feedback',
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.last_time || null);
        }
      );
    });
  }

  async fetchEventsFromTurso(sinceTime) {
    let query = `
      SELECT
        id, title, normalized_title, start_time, end_time, location,
        price, description, description_detail, original_url, short_url,
        source, event_type, priority, scraped_at, week_identifier,
        is_processed, title_zh, summary_en, summary_zh
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

  async fetchFeedbackFromTurso(sinceTime) {
    let query = `
      SELECT
        id, session_id, feedback_type, comment, filter_state,
        events_shown, user_agent, referrer, locale, created_at, ip_hash
      FROM user_feedback
    `;

    const args = [];

    if (sinceTime) {
      query += ' WHERE created_at > ?';
      args.push(sinceTime);
    }

    query += ' ORDER BY created_at ASC';

    const result = await this.tursoClient.execute({
      sql: query,
      args: args
    });

    return result.rows;
  }

  previewEventsData(events) {
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

  previewFeedbackData(feedback) {
    // 显示前 5 条和最后 1 条
    const preview = feedback.slice(0, 5);
    preview.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.feedback_type}`);
      console.log(`      Session: ${item.session_id}`);
      console.log(`      Locale: ${item.locale}`);
      console.log(`      Events shown: ${item.events_shown || 'N/A'}`);
      console.log(`      时间: ${item.created_at}`);
      if (item.comment) {
        console.log(`      评论: ${item.comment.substring(0, 50)}...`);
      }
      console.log('');
    });

    if (feedback.length > 5) {
      console.log(`   ... 还有 ${feedback.length - 5} 条记录`);
      const last = feedback[feedback.length - 1];
      console.log(`   ${feedback.length}. ${last.feedback_type} (${last.created_at})\n`);
    }
  }

  async syncEventsToLocal(events, mode) {
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

  async syncFeedbackToLocal(feedback, mode) {
    const stats = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    };

    // 如果是全量同步，先清空 user_feedback 表
    if (mode === 'full') {
      console.log('   ⚠️  全量同步：清空本地 user_feedback 表...');
      await this.clearLocalFeedback();
      console.log('   ✅ 已清空');
    }

    for (const item of feedback) {
      try {
        const result = await this.upsertFeedback(item);
        if (result === 'inserted') stats.inserted++;
        else if (result === 'updated') stats.updated++;
        else stats.skipped++;
      } catch (error) {
        console.error(`   ❌ 同步失败: feedback ${item.id} - ${error.message}`);
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

  async clearLocalFeedback() {
    return new Promise((resolve, reject) => {
      this.localDb.run('DELETE FROM user_feedback', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getLocalEventsNotInTurso(tursoIds) {
    return new Promise((resolve, reject) => {
      if (tursoIds.length === 0) {
        // 如果 Turso 没有数据，返回所有本地数据
        this.localDb.all('SELECT id, title FROM events', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
        return;
      }

      const placeholders = tursoIds.map(() => '?').join(',');
      this.localDb.all(
        `SELECT id, title FROM events WHERE id NOT IN (${placeholders})`,
        tursoIds,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async deleteLocalEventsNotInTurso(tursoIds) {
    return new Promise((resolve, reject) => {
      if (tursoIds.length === 0) {
        // 如果 Turso 没有数据，删除所有本地数据
        this.localDb.run('DELETE FROM events', function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
        return;
      }

      const placeholders = tursoIds.map(() => '?').join(',');
      this.localDb.run(
        `DELETE FROM events WHERE id NOT IN (${placeholders})`,
        tursoIds,
        function(err) {
          if (err) reject(err);
          else {
            console.log(`   ✅ 删除了 ${this.changes} 条本地多余的记录`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  async upsertEvent(event) {
    return new Promise((resolve, reject) => {
      // 先检查是否存在（基于 Turso 的 ID）
      this.localDb.get(
        'SELECT id FROM events WHERE id = ?',
        [event.id],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            // 记录已存在，更新它（保持相同的 ID）
            const updateQuery = `
              UPDATE events SET
                title = ?, normalized_title = ?, start_time = ?, end_time = ?,
                location = ?, price = ?, description = ?, description_detail = ?,
                original_url = ?, short_url = ?, source = ?, event_type = ?,
                priority = ?, scraped_at = ?, week_identifier = ?, is_processed = ?,
                title_zh = ?, summary_en = ?, summary_zh = ?
              WHERE id = ?
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
              event.original_url,
              event.short_url,
              event.source,
              event.event_type,
              event.priority,
              event.scraped_at,
              event.week_identifier,
              event.is_processed,
              event.title_zh,
              event.summary_en,
              event.summary_zh,
              event.id
            ], (err) => {
              if (err) reject(err);
              else resolve('updated');
            });
          } else {
            // 记录不存在，插入新记录（使用 Turso 的 ID）
            const insertQuery = `
              INSERT INTO events (
                id, title, normalized_title, start_time, end_time, location,
                price, description, description_detail, original_url, short_url,
                source, event_type, priority, scraped_at, week_identifier,
                is_processed, title_zh, summary_en, summary_zh
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.localDb.run(insertQuery, [
              event.id,  // 使用 Turso 的 ID
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
              event.title_zh,
              event.summary_en,
              event.summary_zh
            ], (err) => {
              if (err) reject(err);
              else resolve('inserted');
            });
          }
        }
      );
    });
  }

  async upsertFeedback(feedback) {
    return new Promise((resolve, reject) => {
      // 先检查是否存在（基于 Turso 的 id）
      this.localDb.get(
        'SELECT id FROM user_feedback WHERE id = ?',
        [feedback.id],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            // 更新现有记录（虽然 user_feedback 通常不需要更新，但保持一致性）
            const updateQuery = `
              UPDATE user_feedback SET
                session_id = ?, feedback_type = ?, comment = ?, filter_state = ?,
                events_shown = ?, user_agent = ?, referrer = ?, locale = ?,
                created_at = ?, ip_hash = ?
              WHERE id = ?
            `;

            this.localDb.run(updateQuery, [
              feedback.session_id,
              feedback.feedback_type,
              feedback.comment,
              feedback.filter_state,
              feedback.events_shown,
              feedback.user_agent,
              feedback.referrer,
              feedback.locale,
              feedback.created_at,
              feedback.ip_hash,
              feedback.id
            ], (err) => {
              if (err) reject(err);
              else resolve('updated');
            });
          } else {
            // 插入新记录（保留 Turso 的 id）
            const insertQuery = `
              INSERT INTO user_feedback (
                id, session_id, feedback_type, comment, filter_state,
                events_shown, user_agent, referrer, locale, created_at, ip_hash
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.localDb.run(insertQuery, [
              feedback.id,
              feedback.session_id,
              feedback.feedback_type,
              feedback.comment,
              feedback.filter_state,
              feedback.events_shown,
              feedback.user_agent,
              feedback.referrer,
              feedback.locale,
              feedback.created_at,
              feedback.ip_hash
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
  --diff              差异同步（同步所有数据，并删除本地多余的记录）
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

  # 差异同步（推荐：同步并删除本地多余记录）
  node sync-from-turso.js --diff

  # 预览差异同步（不实际执行）
  node sync-from-turso.js --diff --dry-run

  # 只同步 12月1日后的数据
  node sync-from-turso.js --since 2025-12-01

重要说明:
  ✅ 同步 events 表（活动数据，包括 summary_en/summary_zh）
  ✅ 同步 user_feedback 表（用户反馈数据）
  ✅ 不会触碰本地独有的表（posts, event_performance, weight_adjustments）
  ✅ Events 使用 id 作为唯一标识
  ✅ User Feedback 使用 id 作为唯一标识

同步策略:
  - 增量同步: 只同步上次同步后的新数据（不会删除本地记录）
  - 全量同步: 清空表，重新导入所有数据
  - 差异同步: 同步所有数据，并删除 Turso 上已删除的记录（推荐用于去重后）
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

let mode = 'incremental';
if (args.includes('--full')) mode = 'full';
else if (args.includes('--diff')) mode = 'diff';

const options = {
  mode,
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
