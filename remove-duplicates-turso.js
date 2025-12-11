#!/usr/bin/env node

/**
 * 删除 Turso 数据库中的重复活动
 * 支持自动检测 USE_TURSO 环境变量，决定操作本地或 Turso 数据库
 *
 * 改进的去重逻辑：
 * 1. 使用 original_url 作为主要唯一标识（比 normalized_title 更准确）
 * 2. 删除无效活动（标题是域名的）
 * 3. 保留优先级最高或最新抓取的活动
 */

require('dotenv').config();

const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DuplicateRemover {
  constructor() {
    this.useTurso = process.env.USE_TURSO === '1';
    this.stats = {
      totalBefore: 0,
      duplicatesFound: 0,
      invalidRemoved: 0,
      duplicatesRemoved: 0,
      totalAfter: 0,
    };
    this.client = null;
    this.db = null;
  }

  async initialize() {
    if (this.useTurso) {
      const url = process.env.TURSO_DATABASE_URL;
      const token = process.env.TURSO_AUTH_TOKEN;

      // 检查是否是占位符或缺失
      if (!url || !token ||
          url.includes('你的') || url.includes('your') ||
          token.includes('你的') || token.includes('your')) {
        console.warn('⚠️  警告: TURSO 配置无效或是占位符');
        console.warn('   回退到本地数据库\n');
        this.useTurso = false;
        const dbPath = path.join(__dirname, 'data', 'events.db');
        this.db = new sqlite3.Database(dbPath);
        console.log('💾 使用本地数据库');
        return;
      }

      this.client = createClient({
        url: url,
        authToken: token,
      });
      console.log('📡 使用 Turso 数据库');
    } else {
      const dbPath = path.join(__dirname, 'data', 'events.db');
      this.db = new sqlite3.Database(dbPath);
      console.log('💾 使用本地数据库');
    }
  }

  async run(options = {}) {
    const { dryRun = false, dedupeBy = 'original_url' } = options;

    // 初始化数据库连接
    await this.initialize();

    console.log('\n═══════════════════════════════════════');
    console.log('🔍 查找并删除重复活动');
    console.log('═══════════════════════════════════════\n');

    console.log('📋 去重配置:');
    console.log(`   数据库: ${this.useTurso ? 'Turso（云端）' : 'Local SQLite'}`);
    console.log(`   去重依据: ${dedupeBy}`);
    console.log(`   预览模式: ${dryRun ? '是（不会实际删除）' : '否'}`);
    console.log('');

    try {
      // 1. 统计初始数量
      await this.countTotal('before');

      // 2. 删除无效活动
      if (!dryRun) {
        await this.removeInvalidEvents();
      } else {
        await this.previewInvalidEvents();
      }

      // 3. 查找重复活动
      const duplicates = await this.findDuplicates(dedupeBy);

      if (duplicates.length === 0) {
        console.log('✅ 没有发现重复活动！');
        await this.finish();
        return;
      }

      // 4. 显示重复活动预览
      this.previewDuplicates(duplicates);

      // 5. 删除重复活动
      if (!dryRun) {
        await this.removeDuplicates(duplicates, dedupeBy);
      } else {
        console.log('\n🔍 预览模式 - 未实际删除数据');
      }

      // 6. 统计最终数量
      await this.countTotal('after');

      // 7. 显示统计结果
      this.showStats();

      console.log('\n═══════════════════════════════════════\n');

    } catch (error) {
      console.error('\n❌ 去重失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await this.close();
    }
  }

  async countTotal(when) {
    if (this.useTurso) {
      const result = await this.client.execute('SELECT COUNT(*) as count FROM events');
      const count = Number(result.rows[0].count);
      if (when === 'before') {
        this.stats.totalBefore = count;
        console.log(`📊 初始活动数: ${count}\n`);
      } else {
        this.stats.totalAfter = count;
      }
    } else {
      return new Promise((resolve, reject) => {
        this.db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (when === 'before') {
            this.stats.totalBefore = row.count;
            console.log(`📊 初始活动数: ${row.count}\n`);
          } else {
            this.stats.totalAfter = row.count;
          }
          resolve();
        });
      });
    }
  }

  async previewInvalidEvents() {
    const invalidTitles = [
      'www.sfstation.com',
      'www sfstation com',
      'eventbrite.com',
      'funcheap.com',
    ];

    console.log('🔍 检查无效活动...');

    if (this.useTurso) {
      const placeholders = invalidTitles.map(() => '?').join(',');
      const result = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM events WHERE normalized_title IN (${placeholders})`,
        args: invalidTitles,
      });
      const count = Number(result.rows[0].count);
      console.log(`   发现 ${count} 个无效活动（预览模式，未删除）\n`);
    } else {
      return new Promise((resolve, reject) => {
        const placeholders = invalidTitles.map(() => '?').join(',');
        this.db.get(
          `SELECT COUNT(*) as count FROM events WHERE normalized_title IN (${placeholders})`,
          invalidTitles,
          (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            console.log(`   发现 ${row.count} 个无效活动（预览模式，未删除）\n`);
            resolve();
          }
        );
      });
    }
  }

  async removeInvalidEvents() {
    const invalidTitles = [
      'www.sfstation.com',
      'www sfstation com',
      'eventbrite.com',
      'funcheap.com',
    ];

    console.log('🗑️  删除无效活动...');

    if (this.useTurso) {
      const placeholders = invalidTitles.map(() => '?').join(',');
      const result = await this.client.execute({
        sql: `DELETE FROM events WHERE normalized_title IN (${placeholders})`,
        args: invalidTitles,
      });
      this.stats.invalidRemoved = Number(result.rowsAffected || 0);
      console.log(`   ✅ 删除了 ${this.stats.invalidRemoved} 个无效活动\n`);
    } else {
      return new Promise((resolve, reject) => {
        const placeholders = invalidTitles.map(() => '?').join(',');
        this.db.run(
          `DELETE FROM events WHERE normalized_title IN (${placeholders})`,
          invalidTitles,
          function (err) {
            if (err) {
              reject(err);
              return;
            }
            this.stats.invalidRemoved = this.changes;
            console.log(`   ✅ 删除了 ${this.changes} 个无效活动\n`);
            resolve();
          }.bind(this)
        );
      });
    }
  }

  async findDuplicates(dedupeBy) {
    console.log(`🔍 查找重复活动（按 ${dedupeBy} 分组）...\n`);

    let query;
    if (dedupeBy === 'original_url') {
      // 使用 original_url 去重（更准确）
      query = `
        SELECT
          original_url,
          COUNT(*) as count,
          GROUP_CONCAT(id) as ids,
          GROUP_CONCAT(priority) as priorities,
          GROUP_CONCAT(scraped_at) as scraped_ats,
          MAX(title) as sample_title
        FROM events
        GROUP BY original_url
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `;
    } else {
      // 使用 normalized_title 去重（兼容旧逻辑）
      query = `
        SELECT
          normalized_title,
          COUNT(*) as count,
          GROUP_CONCAT(id) as ids,
          GROUP_CONCAT(priority) as priorities,
          GROUP_CONCAT(scraped_at) as scraped_ats,
          GROUP_CONCAT(original_url) as original_urls
        FROM events
        GROUP BY normalized_title
        HAVING COUNT(*) > 1
        ORDER BY count DESC
      `;
    }

    if (this.useTurso) {
      const result = await this.client.execute(query);
      this.stats.duplicatesFound = result.rows.length;
      console.log(`   发现 ${this.stats.duplicatesFound} 组重复活动\n`);
      return result.rows;
    } else {
      return new Promise((resolve, reject) => {
        this.db.all(query, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          this.stats.duplicatesFound = rows.length;
          console.log(`   发现 ${this.stats.duplicatesFound} 组重复活动\n`);
          resolve(rows);
        });
      });
    }
  }

  previewDuplicates(duplicates) {
    console.log('📋 重复活动预览:');

    const preview = duplicates.slice(0, 10);
    preview.forEach((dup, i) => {
      const ids = String(dup.ids).split(',').map(Number);
      const priorities = String(dup.priorities).split(',').map(Number);

      if (dup.original_url) {
        console.log(`   ${i + 1}. "${dup.sample_title || dup.original_url}"`);
        console.log(`      URL: ${dup.original_url}`);
      } else {
        console.log(`   ${i + 1}. "${dup.normalized_title}"`);
      }

      console.log(`      重复数: ${dup.count}`);
      console.log(`      IDs: ${ids.join(', ')}`);
      console.log(`      优先级: ${priorities.join(', ')}`);
      console.log('');
    });

    if (duplicates.length > 10) {
      console.log(`   ... 还有 ${duplicates.length - 10} 组重复\n`);
    }
  }

  async removeDuplicates(duplicates, dedupeBy) {
    console.log('🗑️  删除重复活动（保留优先级最高或最新抓取的）...\n');

    let totalRemoved = 0;

    for (const dup of duplicates) {
      const ids = String(dup.ids).split(',').map(Number);
      const priorities = String(dup.priorities).split(',').map(Number);
      const scrapedAts = String(dup.scraped_ats).split(',');

      // 找到最佳记录：优先级最高，或时间最新
      let bestIndex = 0;
      let maxPriority = priorities[0];
      let latestTime = scrapedAts[0];

      for (let i = 1; i < ids.length; i++) {
        // 优先考虑优先级
        if (priorities[i] > maxPriority) {
          maxPriority = priorities[i];
          bestIndex = i;
          latestTime = scrapedAts[i];
        } else if (priorities[i] === maxPriority) {
          // 优先级相同，保留最新抓取的
          if (scrapedAts[i] > latestTime) {
            latestTime = scrapedAts[i];
            bestIndex = i;
          }
        }
      }

      const keepId = ids[bestIndex];
      const deleteIds = ids.filter((id) => id !== keepId);

      if (deleteIds.length > 0) {
        // 传递 keepId，以便保留最佳的 performance 数据
        const removed = await this.deleteByIds(deleteIds, keepId);
        totalRemoved += removed;
      }
    }

    this.stats.duplicatesRemoved = totalRemoved;
    console.log(`   ✅ 删除了 ${totalRemoved} 个重复活动\n`);
  }

  async deleteByIds(ids, keepId = null) {
    const placeholders = ids.map(() => '?').join(',');

    if (this.useTurso) {
      // 先处理 event_performance 表中的相关记录
      try {
        if (keepId) {
          // 策略：保留 engagement_score 最高的 performance 记录
          // 1. 找到这批重复活动中 engagement_score 最高的那条完整的 performance 记录
          const bestPerf = await this.client.execute({
            sql: `
              SELECT *
              FROM event_performance
              WHERE event_id IN (${placeholders})
              ORDER BY engagement_score DESC
              LIMIT 1
            `,
            args: ids,
          });

          // 2. 删除所有这批重复活动的 performance 记录
          await this.client.execute({
            sql: `DELETE FROM event_performance WHERE event_id IN (${placeholders})`,
            args: ids,
          });

          // 3. 如果找到了最佳 performance，重新插入并关联到 keepId
          if (bestPerf.rows.length > 0) {
            const best = bestPerf.rows[0];
            await this.client.execute({
              sql: `
                INSERT INTO event_performance (
                  event_id, post_id, event_title, event_type, event_url,
                  location, location_category, price, price_category,
                  start_time, is_weekend, is_free, is_outdoor, is_chinese_relevant,
                  shortio_clicks, xiaohongshu_likes, xiaohongshu_favorites,
                  xiaohongshu_comments, xiaohongshu_shares, engagement_score,
                  normalized_score, feedback_collected_at, feedback_updated_at,
                  data_source, source_review, source_website, manually_added_at_publish
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              args: [
                keepId,  // 使用保留的活动 ID
                best.post_id,
                best.event_title,
                best.event_type,
                best.event_url,
                best.location,
                best.location_category,
                best.price,
                best.price_category,
                best.start_time,
                best.is_weekend,
                best.is_free,
                best.is_outdoor,
                best.is_chinese_relevant,
                best.shortio_clicks,
                best.xiaohongshu_likes,
                best.xiaohongshu_favorites,
                best.xiaohongshu_comments,
                best.xiaohongshu_shares,
                best.engagement_score,
                best.normalized_score,
                best.feedback_collected_at,
                best.feedback_updated_at,
                best.data_source,
                best.source_review,
                best.source_website,
                best.manually_added_at_publish
              ],
            });
          }
        } else {
          // 没有指定 keepId，直接删除所有
          await this.client.execute({
            sql: `DELETE FROM event_performance WHERE event_id IN (${placeholders})`,
            args: ids,
          });
        }
      } catch (error) {
        // 如果 event_performance 表不存在，忽略错误继续执行
        if (!error.message.includes('no such table')) {
          console.warn(`⚠️  处理 event_performance 记录时出错: ${error.message}`);
        }
      }

      // 然后删除 events 表中的记录
      const result = await this.client.execute({
        sql: `DELETE FROM events WHERE id IN (${placeholders})`,
        args: ids,
      });
      return Number(result.rowsAffected || 0);
    } else {
      return new Promise((resolve, reject) => {
        // 本地 SQLite 处理（与 Turso 逻辑相同）
        const handlePerformance = (callback) => {
          if (keepId) {
            // 1. 找到最佳 performance 记录
            this.db.get(
              `SELECT * FROM event_performance
               WHERE event_id IN (${placeholders})
               ORDER BY engagement_score DESC
               LIMIT 1`,
              ids,
              (err, bestPerf) => {
                if (err && !err.message.includes('no such table')) {
                  console.warn(`⚠️  查询 event_performance 时出错: ${err.message}`);
                  callback();
                  return;
                }

                // 2. 删除所有相关的 performance 记录
                this.db.run(
                  `DELETE FROM event_performance WHERE event_id IN (${placeholders})`,
                  ids,
                  (err) => {
                    if (err && !err.message.includes('no such table')) {
                      console.warn(`⚠️  删除 event_performance 时出错: ${err.message}`);
                    }

                    // 3. 重新插入最佳记录（关联到 keepId）
                    if (bestPerf) {
                      this.db.run(
                        `INSERT INTO event_performance (
                          event_id, post_id, event_title, event_type, event_url,
                          location, location_category, price, price_category,
                          start_time, is_weekend, is_free, is_outdoor, is_chinese_relevant,
                          shortio_clicks, xiaohongshu_likes, xiaohongshu_favorites,
                          xiaohongshu_comments, xiaohongshu_shares, engagement_score,
                          normalized_score, feedback_collected_at, feedback_updated_at,
                          data_source, source_review, source_website, manually_added_at_publish
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                          keepId,
                          bestPerf.post_id,
                          bestPerf.event_title,
                          bestPerf.event_type,
                          bestPerf.event_url,
                          bestPerf.location,
                          bestPerf.location_category,
                          bestPerf.price,
                          bestPerf.price_category,
                          bestPerf.start_time,
                          bestPerf.is_weekend,
                          bestPerf.is_free,
                          bestPerf.is_outdoor,
                          bestPerf.is_chinese_relevant,
                          bestPerf.shortio_clicks,
                          bestPerf.xiaohongshu_likes,
                          bestPerf.xiaohongshu_favorites,
                          bestPerf.xiaohongshu_comments,
                          bestPerf.xiaohongshu_shares,
                          bestPerf.engagement_score,
                          bestPerf.normalized_score,
                          bestPerf.feedback_collected_at,
                          bestPerf.feedback_updated_at,
                          bestPerf.data_source,
                          bestPerf.source_review,
                          bestPerf.source_website,
                          bestPerf.manually_added_at_publish
                        ],
                        () => callback()
                      );
                    } else {
                      callback();
                    }
                  }
                );
              }
            );
          } else {
            // 没有指定 keepId，直接删除
            this.db.run(
              `DELETE FROM event_performance WHERE event_id IN (${placeholders})`,
              ids,
              () => callback()
            );
          }
        };

        // 先处理 performance，再删除 events
        handlePerformance(() => {
          this.db.run(
            `DELETE FROM events WHERE id IN (${placeholders})`,
            ids,
            function (err) {
              if (err) {
                reject(err);
                return;
              }
              resolve(this.changes);
            }
          );
        });
      });
    }
  }

  showStats() {
    console.log('✅ 去重完成！\n');
    console.log('📊 统计信息:');
    console.log(`   • 初始活动数: ${this.stats.totalBefore}`);
    console.log(`   • 删除无效活动: ${this.stats.invalidRemoved}`);
    console.log(`   • 删除重复活动: ${this.stats.duplicatesRemoved}`);
    console.log(`   • 最终活动数: ${this.stats.totalAfter}`);
    console.log(`   • 共删除: ${this.stats.totalBefore - this.stats.totalAfter}`);
  }

  async close() {
    if (!this.useTurso && this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) console.error('关闭数据库时出错:', err);
          resolve();
        });
      });
    }
  }

  async finish() {
    await this.countTotal('after');
    this.showStats();
  }

  static showHelp() {
    console.log(`
🗑️  重复活动去重工具（支持 Turso）

用法:
  node remove-duplicates-turso.js [选项]

选项:
  --dry-run           预览模式（不实际删除数据）
  --dedupe-by=FIELD   去重依据字段（original_url 或 normalized_title）
                      默认: original_url
  -h, --help          显示帮助信息

环境变量:
  USE_TURSO=1              使用 Turso 数据库（否则使用本地 SQLite）
  TURSO_DATABASE_URL       Turso 数据库 URL（使用 Turso 时必需）
  TURSO_AUTH_TOKEN         Turso 认证令牌（使用 Turso 时必需）

示例:
  # 去重本地数据库（默认）
  node remove-duplicates-turso.js

  # 去重 Turso 数据库
  USE_TURSO=1 node remove-duplicates-turso.js

  # 预览模式（不实际删除）
  node remove-duplicates-turso.js --dry-run

  # 使用 normalized_title 去重（兼容旧逻辑）
  node remove-duplicates-turso.js --dedupe-by=normalized_title

去重逻辑:
  1. 删除无效活动（标题是域名的活动）
  2. 查找重复活动（基于 original_url 或 normalized_title）
  3. 对每组重复：
     - 优先保留优先级（priority）最高的
     - 如果优先级相同，保留最新抓取的（scraped_at 最新）
     - 删除其他重复项

重要说明:
  ✅ 支持本地 SQLite 和 Turso 数据库
  ✅ 使用 original_url 作为默认去重依据（更准确）
  ✅ 支持预览模式，安全查看将要删除的数据
  ⚠️  删除操作不可逆，建议先运行 --dry-run 预览
  💡 如果使用 Turso，建议同步后在本地也运行去重（保持一致性）
`);
  }
}

// 解析命令行参数
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  DuplicateRemover.showHelp();
  process.exit(0);
}

const options = {
  dryRun: args.includes('--dry-run'),
  dedupeBy: args.find(arg => arg.startsWith('--dedupe-by='))?.split('=')[1] || 'original_url',
};

const remover = new DuplicateRemover();
remover.run(options).catch(err => {
  console.error('❌ 去重失败:', err);
  process.exit(1);
});
