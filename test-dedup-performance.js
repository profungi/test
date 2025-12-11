#!/usr/bin/env node

/**
 * 测试去重时 performance 数据的保留策略
 *
 * 测试场景：
 * 1. 创建重复的活动（相同的 original_url）
 * 2. 为这些重复活动创建不同 engagement_score 的 performance 数据
 * 3. 执行去重
 * 4. 验证是否保留了 engagement_score 最高的 performance 记录
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DedupPerformanceTest {
  constructor() {
    this.testDbPath = path.join(__dirname, 'data', 'test-dedup.db');
  }

  async run() {
    console.log('\n═══════════════════════════════════════');
    console.log('🧪 测试去重时 Performance 数据保留策略');
    console.log('═══════════════════════════════════════\n');

    try {
      // 1. 清理并创建测试数据库
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
      }

      console.log('📦 步骤 1/5: 创建测试数据库...');
      this.db = new sqlite3.Database(this.testDbPath);
      await this.createTables();
      console.log('   ✅ 表结构创建完成\n');

      // 2. 插入重复的活动
      console.log('📝 步骤 2/5: 插入重复活动（3条相同URL的活动）...');
      await this.insertDuplicateEvents();
      console.log('   ✅ 插入完成\n');

      // 3. 插入 performance 数据（不同的 engagement_score）
      console.log('📊 步骤 3/5: 插入 performance 数据...');
      await this.insertPerformanceData();
      await this.showPerformanceData('去重前');
      console.log('');

      // 4. 执行去重（保留 ID 1，删除 ID 2, 3）
      console.log('🗑️  步骤 4/5: 执行去重（保留优先级最高的活动 ID 1）...');
      await this.deduplicateEvents();
      console.log('   ✅ 去重完成\n');

      // 5. 验证结果
      console.log('✅ 步骤 5/5: 验证 performance 数据...');
      await this.showPerformanceData('去重后');
      await this.verifyResult();
      console.log('');

      console.log('═══════════════════════════════════════');
      console.log('✅ 测试完成！\n');

      // 清理
      this.db.close();
      fs.unlinkSync(this.testDbPath);
      console.log('🧹 测试数据库已清理\n');

    } catch (error) {
      console.error('\n❌ 测试失败:', error.message);
      console.error(error.stack);
      if (this.db) this.db.close();
      process.exit(1);
    }
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            original_url TEXT,
            priority INTEGER DEFAULT 0,
            scraped_at TEXT
          )
        `);

        this.db.run(`
          CREATE TABLE event_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            shortio_clicks INTEGER DEFAULT 0,
            xiaohongshu_likes INTEGER DEFAULT 0,
            engagement_score REAL DEFAULT 0,
            FOREIGN KEY (event_id) REFERENCES events(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async insertDuplicateEvents() {
    const events = [
      { id: 1, title: 'Event A', url: 'https://example.com/event', priority: 10 },
      { id: 2, title: 'Event A (duplicate)', url: 'https://example.com/event', priority: 5 },
      { id: 3, title: 'Event A (duplicate 2)', url: 'https://example.com/event', priority: 0 },
    ];

    const promises = events.map(event =>
      new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO events (id, title, original_url, priority, scraped_at)
           VALUES (?, ?, ?, ?, ?)`,
          [event.id, event.title, event.url, event.priority, '2024-12-01'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      })
    );

    await Promise.all(promises);
  }

  async insertPerformanceData() {
    // ID 1: engagement_score = 50 (中等)
    // ID 2: engagement_score = 100 (最高) ← 应该保留这个
    // ID 3: engagement_score = 20 (最低)
    const perfData = [
      { event_id: 1, clicks: 100, likes: 50, score: 50 },
      { event_id: 2, clicks: 200, likes: 100, score: 100 },
      { event_id: 3, clicks: 50, likes: 20, score: 20 },
    ];

    const promises = perfData.map(perf =>
      new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO event_performance (event_id, shortio_clicks, xiaohongshu_likes, engagement_score)
           VALUES (?, ?, ?, ?)`,
          [perf.event_id, perf.clicks, perf.likes, perf.score],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      })
    );

    await Promise.all(promises);
  }

  async showPerformanceData(title) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT
          p.event_id,
          p.shortio_clicks,
          p.xiaohongshu_likes,
          p.engagement_score,
          e.title
        FROM event_performance p
        LEFT JOIN events e ON p.event_id = e.id
        ORDER BY p.event_id
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`   ${title}:`);
        console.log('   Event ID | Clicks | Likes | Score | Title');
        console.log('   ---------|--------|-------|-------|-------');
        rows.forEach(row => {
          const title = row.title || 'NULL';
          console.log(`   ${String(row.event_id).padEnd(8)} | ${String(row.shortio_clicks).padEnd(6)} | ${String(row.xiaohongshu_likes).padEnd(5)} | ${String(row.engagement_score).padEnd(5)} | ${title}`);
        });

        resolve(rows);
      });
    });
  }

  async deduplicateEvents() {
    // 模拟新的去重逻辑
    const keepId = 1; // 保留优先级最高的（priority=10）
    const deleteIds = [1, 2, 3]; // 所有重复的 IDs

    return new Promise((resolve, reject) => {
      // 1. 找到最佳的完整 performance 记录
      this.db.get(
        `SELECT * FROM event_performance
         WHERE event_id IN (1, 2, 3)
         ORDER BY engagement_score DESC
         LIMIT 1`,
        (err, bestPerf) => {
          if (err) {
            reject(err);
            return;
          }

          console.log(`   最佳 performance: event_id=${bestPerf.event_id}, score=${bestPerf.engagement_score}`);
          console.log(`   删除所有 performance 记录，然后重新插入最佳的（关联到 keepId=${keepId})`);

          // 2. 删除所有相关的 performance 记录
          this.db.run(
            `DELETE FROM event_performance WHERE event_id IN (1, 2, 3)`,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              // 3. 重新插入最佳记录（关联到 keepId）
              this.db.run(
                `INSERT INTO event_performance (event_id, shortio_clicks, xiaohongshu_likes, engagement_score)
                 VALUES (?, ?, ?, ?)`,
                [keepId, bestPerf.shortio_clicks, bestPerf.xiaohongshu_likes, bestPerf.engagement_score],
                (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  // 4. 删除重复的 events
                  this.db.run(
                    `DELETE FROM events WHERE id IN (2, 3)`,
                    () => resolve()
                  );
                }
              );
            }
          );
        }
      );
    });
  }

  async verifyResult() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT
          (SELECT COUNT(*) FROM events) as events_count,
          (SELECT COUNT(*) FROM event_performance) as perf_count,
          (SELECT engagement_score FROM event_performance WHERE event_id = 1) as kept_score
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const result = rows[0];
        console.log('');
        console.log('   验证结果:');
        console.log(`   剩余活动数: ${result.events_count} (预期: 1)`);
        console.log(`   剩余 performance 记录数: ${result.perf_count} (预期: 1)`);
        console.log(`   保留的 engagement_score: ${result.kept_score} (预期: 100)`);
        console.log('');

        if (result.events_count === 1 &&
            result.perf_count === 1 &&
            result.kept_score === 100) {
          console.log('   ✅ 测试通过！保留了最高 engagement_score 的 performance 数据');
        } else {
          console.log('   ❌ 测试失败！performance 数据保留策略有问题');
        }

        resolve();
      });
    });
  }
}

const test = new DedupPerformanceTest();
test.run().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
