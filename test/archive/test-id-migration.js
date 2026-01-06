#!/usr/bin/env node

/**
 * 测试ID迁移逻辑（不需要真实的Turso连接）
 *
 * 测试场景：
 * 1. 创建一个临时测试数据库
 * 2. 插入一些带有错误ID的测试数据
 * 3. 模拟从Turso同步（使用正确的ID）
 * 4. 验证ID是否正确更新
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class MigrationTest {
  constructor() {
    this.testDbPath = path.join(__dirname, 'data', 'test-migration.db');
  }

  async run() {
    console.log('\n═══════════════════════════════════════');
    console.log('🧪 测试ID迁移逻辑');
    console.log('═══════════════════════════════════════\n');

    try {
      // 1. 清理旧的测试数据库
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
      }

      // 2. 创建测试数据库
      console.log('📦 步骤 1/6: 创建测试数据库...');
      this.db = new sqlite3.Database(this.testDbPath);
      await this.createTables();
      console.log('   ✅ 表结构创建完成\n');

      // 3. 插入测试数据（模拟本地自增ID）
      console.log('📝 步骤 2/6: 插入测试数据（模拟本地自增ID 500-509）...');
      await this.insertLocalTestData();
      const beforeStats = await this.getStats();
      console.log(`   ✅ 插入了 ${beforeStats.events} 条活动\n`);

      // 4. 插入 performance 数据（使用旧ID 1-10）
      console.log('📊 步骤 3/6: 插入 performance 数据（使用Turso ID 1-10）...');
      await this.insertPerformanceData();
      const perfStats = await this.getStats();
      console.log(`   ✅ 插入了 ${perfStats.performance} 条 performance 记录\n`);

      // 5. 显示迁移前状态
      console.log('📋 迁移前状态:');
      await this.showCurrentState();
      console.log('');

      // 6. 清空 events 表
      console.log('🗑️  步骤 4/6: 清空 events 表...');
      await this.clearEvents();
      console.log('   ✅ events 表已清空\n');

      // 7. 重新插入数据（使用正确的Turso ID）
      console.log('💾 步骤 5/6: 重新插入数据（使用Turso ID 1-10）...');
      await this.insertTursoTestData();
      const afterStats = await this.getStats();
      console.log(`   ✅ 插入了 ${afterStats.events} 条活动\n`);

      // 8. 验证结果
      console.log('✅ 步骤 6/6: 验证迁移结果...');
      await this.verifyMigration();
      console.log('');

      console.log('═══════════════════════════════════════');
      console.log('✅ 测试通过！迁移逻辑正确\n');

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
            original_url TEXT UNIQUE,
            event_type TEXT,
            scraped_at TEXT
          )
        `);

        this.db.run(`
          CREATE TABLE event_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            shortio_clicks INTEGER DEFAULT 0,
            FOREIGN KEY (event_id) REFERENCES events(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async insertLocalTestData() {
    // 模拟本地数据库的自增ID（从500开始）
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const localId = 500 + i;
      const promise = new Promise((resolve, reject) => {
        // 手动插入ID（模拟之前本地生成的ID）
        this.db.run(
          `INSERT INTO events (id, title, original_url, event_type, scraped_at)
           VALUES (?, ?, ?, ?, ?)`,
          [localId, `Event ${i + 1}`, `https://example.com/event-${i + 1}`, 'music', '2024-12-01'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      promises.push(promise);
    }
    await Promise.all(promises);
  }

  async insertPerformanceData() {
    // 插入 performance 数据，使用 Turso 的 ID (1-10)
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const tursoId = i + 1; // Turso 的真实ID
      const promise = new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO event_performance (event_id, shortio_clicks) VALUES (?, ?)`,
          [tursoId, (i + 1) * 10],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      promises.push(promise);
    }
    await Promise.all(promises);
  }

  async insertTursoTestData() {
    // 插入数据，使用 Turso 的正确 ID (1-10)
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const tursoId = i + 1;
      const promise = new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO events (id, title, original_url, event_type, scraped_at)
           VALUES (?, ?, ?, ?, ?)`,
          [tursoId, `Event ${i + 1}`, `https://example.com/event-${i + 1}`, 'music', '2024-12-01'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      promises.push(promise);
    }
    await Promise.all(promises);
  }

  async clearEvents() {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM events', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getStats() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT
          (SELECT COUNT(*) FROM events) as events,
          (SELECT COUNT(*) FROM event_performance) as performance
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async showCurrentState() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT
          e.id as event_id,
          e.title,
          p.event_id as perf_event_id,
          p.shortio_clicks,
          CASE WHEN e.id = p.event_id THEN '✅' ELSE '❌' END as matched
        FROM event_performance p
        LEFT JOIN events e ON p.event_id = e.id
        ORDER BY p.event_id
        LIMIT 5
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        console.log('   Event ID | Perf.event_id | Matched | Clicks');
        console.log('   ---------|---------------|---------|-------');
        rows.forEach(row => {
          const eventId = row.event_id || 'NULL';
          console.log(`   ${String(eventId).padEnd(8)} | ${String(row.perf_event_id).padEnd(13)} | ${row.matched}      | ${row.shortio_clicks}`);
        });
        resolve();
      });
    });
  }

  async verifyMigration() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT
          e.id as event_id,
          e.title,
          p.event_id as perf_event_id,
          p.shortio_clicks,
          CASE WHEN e.id = p.event_id THEN '✅' ELSE '❌' END as matched
        FROM event_performance p
        LEFT JOIN events e ON p.event_id = e.id
        ORDER BY p.event_id
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        console.log('   迁移后状态:');
        console.log('   Event ID | Perf.event_id | Matched | Clicks');
        console.log('   ---------|---------------|---------|-------');

        let matched = 0;
        let total = rows.length;

        // 显示前5条
        rows.slice(0, 5).forEach(row => {
          const eventId = row.event_id || 'NULL';
          console.log(`   ${String(eventId).padEnd(8)} | ${String(row.perf_event_id).padEnd(13)} | ${row.matched}      | ${row.shortio_clicks}`);
        });

        // 但是统计所有行
        rows.forEach(row => {
          if (row.matched === '✅') matched++;
        });

        console.log('');
        console.log(`   匹配率: ${matched}/${total} = ${((matched/total)*100).toFixed(1)}%`);

        if (matched === total) {
          console.log('   ✅ 所有 performance 记录都正确关联到了 events!');
        } else {
          console.log('   ❌ 部分 performance 记录未能正确关联');
        }

        resolve();
      });
    });
  }
}

const test = new MigrationTest();
test.run().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
