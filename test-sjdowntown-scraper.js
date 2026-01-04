#!/usr/bin/env node

/**
 * 测试 San Jose Downtown REST API 抓取器
 */

const path = require('path');
const fs = require('fs');

// 设置测试环境
const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-sjdowntown.db');
const testDataDir = path.dirname(TEST_DB_PATH);
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// 删除旧的测试数据库
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// 设置环境变量
process.env.USE_TURSO = '';
process.env.DATABASE_PATH = TEST_DB_PATH;

const SJDowntownApiScraper = require('./src/scrapers/sjdowntown-api-scraper');
const Database = require('./src/utils/database');

async function testScraper() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  测试 San Jose Downtown REST API 抓取器');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const db = new Database();
  await db.connect();

  try {
    // 创建抓取器配置
    const config = {
      name: 'sjdowntown',
      displayName: 'San Jose Downtown',
      priority: 1,
      enabled: true,
      frequency: 'weekly',
      apiType: 'wordpress_events_calendar',
      baseUrl: 'https://sjdowntown.com',
      apiEndpoint: '/?rest_route=/tribe/events/v1/events',
      apiParams: {
        per_page: 50
      },
      supportsDateFiltering: true,
      dateParams: {
        start: 'start_date',
        end: 'end_date'
      }
    };

    // 创建抓取器实例
    const scraper = new SJDowntownApiScraper(config);

    // 获取当前周的时间范围
    const weekRange = scraper.getCurrentWeekRange();
    console.log(`📅 抓取时间范围: ${weekRange.start.toLocaleDateString()} - ${weekRange.end.toLocaleDateString()}\n`);

    // 执行抓取
    const events = await scraper.scrapeEvents(weekRange);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  抓取结果: ${events.length} 个活动`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (events.length > 0) {
      console.log('📝 前5个活动预览:\n');
      events.slice(0, 5).forEach((event, idx) => {
        console.log(`   活动 ${idx + 1}:`);
        console.log(`   ├─ 标题: ${event.title}`);
        console.log(`   ├─ 开始时间: ${event.startTime}`);
        if (event.endTime) {
          console.log(`   ├─ 结束时间: ${event.endTime}`);
        }
        console.log(`   ├─ 地点: ${event.location}`);
        console.log(`   ├─ 链接: ${event.originalUrl}`);
        if (event.price) {
          console.log(`   ├─ 价格: ${event.price}`);
        }
        if (event.categories) {
          console.log(`   ├─ 分类: ${event.categories}`);
        }
        console.log(`   └─ 描述: ${event.description.substring(0, 100)}...`);
        console.log('');
      });

      // 保存到数据库
      console.log('💾 保存活动到数据库...');
      let savedCount = 0;
      for (const event of events) {
        const saved = await db.saveEvent(event);
        if (saved) savedCount++;
      }
      console.log(`✅ 成功保存 ${savedCount}/${events.length} 个活动到数据库\n`);

      // 数据库统计
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  数据库统计');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const totalEvents = db.db.prepare('SELECT COUNT(*) as count FROM events').get();
      console.log(`   数据库路径: ${TEST_DB_PATH}`);
      console.log(`   总活动数: ${totalEvents.count}`);

      const bySource = db.db.prepare('SELECT source, COUNT(*) as count FROM events GROUP BY source').all();
      console.log('   按来源分布:');
      bySource.forEach(row => {
        console.log(`   - ${row.source}: ${row.count}`);
      });
    } else {
      console.log('⚠️  没有找到任何活动');
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error(error.stack);
  } finally {
    await db.close();
    console.log('\n✅ 测试完成\n');
  }
}

testScraper().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
