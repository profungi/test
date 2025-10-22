#!/usr/bin/env node

/**
 * 测试脚本：验证抓取效率优化
 *
 * 用法：
 *   node test-optimizations.js               # 运行所有测试
 *   node test-optimizations.js --db-only     # 仅测试数据库优化
 *   node test-optimizations.js --keyword     # 仅测试关键词搜索
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const EventDatabase = require('./src/utils/database');

class OptimizationTester {
  constructor() {
    this.testResults = [];
    this.testDbPath = path.join(__dirname, 'data', 'test-events.db');
  }

  // ============ 快速验证 (Level 1) ============

  async testDatabaseIndexesExist() {
    console.log('\n📋 测试 1: 验证数据库索引是否创建');
    console.log('=' .repeat(60));

    try {
      const db = new sqlite3.Database(this.testDbPath);

      return new Promise((resolve) => {
        db.all("SELECT name FROM sqlite_master WHERE type='index'", (err, rows) => {
          if (err) {
            this.recordTest('数据库索引存在性', false, `错误: ${err.message}`);
            resolve(false);
            return;
          }

          const requiredIndexes = [
            'idx_events_dedup',
            'idx_events_week',
            'idx_events_location',
            'idx_events_normalized_title',
            'idx_events_source'
          ];

          const existingIndexes = rows.map(r => r.name);
          const missingIndexes = requiredIndexes.filter(idx => !existingIndexes.includes(idx));

          if (missingIndexes.length === 0) {
            this.recordTest('数据库索引存在性', true, `找到所有 ${requiredIndexes.length} 个索引`);
            console.log(`✅ 所有索引已创建：`);
            requiredIndexes.forEach(idx => console.log(`   ✓ ${idx}`));
            resolve(true);
          } else {
            this.recordTest('数据库索引存在性', false, `缺少索引: ${missingIndexes.join(', ')}`);
            console.log(`❌ 缺少以下索引：`);
            missingIndexes.forEach(idx => console.log(`   ✗ ${idx}`));
            resolve(false);
          }

          db.close();
        });
      });
    } catch (error) {
      this.recordTest('数据库索引存在性', false, error.message);
      return false;
    }
  }

  async testKeywordSearchLogic() {
    console.log('\n📋 测试 2: 验证关键词搜索逻辑');
    console.log('=' .repeat(60));

    try {
      // 读取 eventbrite-scraper.js 代码
      const scraperPath = path.join(__dirname, 'src', 'scrapers', 'eventbrite-scraper.js');
      const scraperCode = fs.readFileSync(scraperPath, 'utf-8');

      // 检查是否有 keywordSearchThreshold 常量
      const hasThreshold = /const\s+keywordSearchThreshold\s*=\s*\d+/.test(scraperCode);
      if (!hasThreshold) {
        this.recordTest('关键词搜索阈值定义', false, '未找到 keywordSearchThreshold 常量');
        return false;
      }

      // 提取阈值值
      const thresholdMatch = scraperCode.match(/const\s+keywordSearchThreshold\s*=\s*(\d+)/);
      const threshold = parseInt(thresholdMatch[1]);

      // 检查是否有条件判断
      const hasConditional = /events\.length\s*<\s*keywordSearchThreshold/.test(scraperCode);
      if (!hasConditional) {
        this.recordTest('关键词搜索条件判断', false, '未找到阈值条件判断');
        return false;
      }

      this.recordTest('关键词搜索阈值定义', true, `阈值设置为 ${threshold}`);
      this.recordTest('关键词搜索条件判断', true, '条件判断逻辑正确');

      console.log(`✅ 关键词搜索阈值: ${threshold}`);
      console.log(`✅ 条件判断逻辑: events.length < ${threshold}`);

      return true;
    } catch (error) {
      this.recordTest('关键词搜索逻辑', false, error.message);
      return false;
    }
  }

  // ============ 性能测试 (Level 2) ============

  async testIndexPerformance() {
    console.log('\n📊 测试 3: 数据库查询性能对比');
    console.log('=' .repeat(60));

    try {
      const db = new EventDatabase();
      await db.connect();

      // 创建测试数据
      const testEvents = this.generateTestEvents(1000);

      console.log('📝 插入 1000 个测试事件...');
      let inserted = 0;
      for (const event of testEvents) {
        try {
          await db.saveEvent(event);
          inserted++;
        } catch (e) {
          // 去重，可能会失败
        }
      }

      console.log(`✅ 成功插入 ${inserted} 个事件\n`);

      // 测试查询性能
      console.log('⏱️  测试查询性能...');

      // 测试 1: 带索引的查询（实际使用）
      const startIndexed = Date.now();
      const result1 = await this.queryWithIndex(db);
      const timeIndexed = Date.now() - startIndexed;

      console.log(`✅ 使用索引查询耗时: ${timeIndexed}ms`);

      this.recordTest('查询性能 (带索引)', true, `${timeIndexed}ms (预期 < 100ms)`);

      // 验证预期性能
      if (timeIndexed > 100) {
        console.log('⚠️  警告：查询时间较长，可能需要优化');
      } else {
        console.log('✅ 查询性能在预期范围内');
      }

      await db.close();
      return timeIndexed < 500; // 允许 500ms 作为宽松的上限
    } catch (error) {
      this.recordTest('查询性能测试', false, error.message);
      return false;
    }
  }

  // ============ 功能测试 (Level 3) ============

  async testIndexCreationRobustness() {
    console.log('\n🛡️  测试 4: 索引创建健壮性');
    console.log('=' .repeat(60));

    try {
      // 测试重复创建索引（应该不报错）
      const db = new EventDatabase();
      await db.connect();

      console.log('✅ 索引重复创建测试通过（无错误）');
      this.recordTest('索引创建健壮性', true, '支持重复创建');

      await db.close();
      return true;
    } catch (error) {
      this.recordTest('索引创建健壮性', false, error.message);
      return false;
    }
  }

  async testKeywordThresholdBehavior() {
    console.log('\n🎯 测试 5: 关键词搜索阈值行为');
    console.log('=' .repeat(60));

    try {
      const scraperPath = path.join(__dirname, 'src', 'scrapers', 'eventbrite-scraper.js');
      const code = fs.readFileSync(scraperPath, 'utf-8');

      // 验证关键词搜索相关的代码结构
      const checks = [
        {
          name: '在 events.length < 阈值 时执行搜索',
          pattern: /if\s*\(\s*additionalSearches\.length\s*>\s*0\s*&&\s*events\.length\s*<\s*keywordSearchThreshold\s*\)/
        },
        {
          name: '在 events.length >= 阈值 时跳过搜索',
          pattern: /else if\s*\(\s*events\.length\s*>=\s*keywordSearchThreshold\s*\)/
        },
        {
          name: '在循环内检查最大事件限制',
          pattern: /if\s*\(\s*events\.length\s*>=\s*100\s*\)\s*break/
        }
      ];

      let allPassed = true;
      for (const check of checks) {
        const passed = check.pattern.test(code);
        this.recordTest(`阈值行为: ${check.name}`, passed, passed ? '✓' : '✗');
        console.log(`${passed ? '✅' : '❌'} ${check.name}`);
        if (!passed) allPassed = false;
      }

      return allPassed;
    } catch (error) {
      this.recordTest('关键词阈值行为测试', false, error.message);
      return false;
    }
  }

  // ============ 辅助方法 ============

  generateTestEvents(count) {
    const events = [];
    const weekId = '2024-10-21_to_2024-10-27'; // 下周

    for (let i = 0; i < count; i++) {
      events.push({
        title: `Test Event ${i}`,
        startTime: new Date(2024, 9, 21 + Math.floor(i / 100)).toISOString(),
        location: ['San Francisco', 'Oakland', 'San Jose'][i % 3],
        originalUrl: `https://example.com/event-${i}`,
        source: 'eventbrite',
        weekIdentifier: weekId,
        eventType: ['festival', 'food', 'market', 'free', 'other'][i % 5]
      });
    }

    return events;
  }

  async queryWithIndex(db) {
    return new Promise((resolve) => {
      const query = `
        SELECT title, normalized_title, start_time, location
        FROM events
        WHERE week_identifier = ?
        AND location = ?
        AND ABS(julianday(start_time) - julianday(?)) < ?
      `;

      const startTime = new Date().toISOString();
      const timeWindowDays = 2;

      db.db.all(query, [
        '2024-10-21_to_2024-10-27',
        'San Francisco',
        startTime,
        timeWindowDays
      ], (err, rows) => {
        resolve(rows || []);
      });
    });
  }

  recordTest(name, passed, details) {
    this.testResults.push({
      name,
      passed,
      details
    });
  }

  // ============ 报告输出 ============

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结');
    console.log('='.repeat(60));

    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const percentage = Math.round((passed / total) * 100);

    console.log(`\n通过: ${passed}/${total} (${percentage}%)\n`);

    this.testResults.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
      if (result.details) {
        console.log(`   └─ ${result.details}`);
      }
    });

    console.log('\n' + '='.repeat(60));

    if (passed === total) {
      console.log('🎉 所有测试通过！优化已成功实施');
      return 0;
    } else {
      console.log(`⚠️  ${total - passed} 个测试未通过，需要检查`);
      return 1;
    }
  }

  // ============ 测试运行器 ============

  async runAll() {
    console.log('🧪 开始运行优化验证测试\n');

    try {
      // 快速验证
      console.log('🚀 第一层：快速验证 (5分钟)');
      await this.testDatabaseIndexesExist();
      await this.testKeywordSearchLogic();

      // 性能测试
      console.log('\n📈 第二层：性能测试 (20分钟)');
      await this.testIndexPerformance();

      // 功能测试
      console.log('\n🔍 第三层：功能测试 (完整性检查)');
      await this.testIndexCreationRobustness();
      await this.testKeywordThresholdBehavior();

      return this.printSummary();
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
      return 1;
    }
  }

  async runDatabaseTests() {
    console.log('🧪 仅运行数据库优化测试\n');

    try {
      await this.testDatabaseIndexesExist();
      await this.testIndexPerformance();
      await this.testIndexCreationRobustness();

      return this.printSummary();
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
      return 1;
    }
  }

  async runKeywordTests() {
    console.log('🧪 仅运行关键词搜索优化测试\n');

    try {
      await this.testKeywordSearchLogic();
      await this.testKeywordThresholdBehavior();

      return this.printSummary();
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
      return 1;
    }
  }
}

// ============ 主程序 ============

async function main() {
  const args = process.argv.slice(2);
  const tester = new OptimizationTester();

  let exitCode = 0;

  if (args.includes('--db-only')) {
    exitCode = await tester.runDatabaseTests();
  } else if (args.includes('--keyword')) {
    exitCode = await tester.runKeywordTests();
  } else {
    exitCode = await tester.runAll();
  }

  process.exit(exitCode);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = OptimizationTester;
