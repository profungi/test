#!/usr/bin/env node

/**
 * 调试：模拟完整的 scrape 流程
 */

const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-scrape-debug.db');
const testDataDir = path.dirname(TEST_DB_PATH);
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

delete process.env.USE_TURSO;
process.env.DATABASE_PATH = TEST_DB_PATH;

require('dotenv').config();

const EventDatabase = require('./src/utils/database');
const Translator = require('./src/utils/translator');
const Summarizer = require('./src/utils/summarizer');

async function testScrapeWorkflow() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  调试：模拟 npm run scrape 流程');
  console.log('═══════════════════════════════════════════════════════════\n');

  const database = new EventDatabase();
  const translator = new Translator('auto');
  const summarizer = new Summarizer();

  await database.connect();

  try {
    // 模拟抓取到的事件
    const scrapedEvents = [
      {
        title: 'Music Concert in SF',
        startTime: '2026-01-10T19:00:00.000Z',
        location: 'The Fillmore, San Francisco',
        originalUrl: 'https://example.com/concert',
        description: 'Amazing music concert with live bands',
        source: 'test',
        eventType: 'music'
      },
      {
        title: 'Art Gallery Opening',
        startTime: '2026-01-11T18:00:00.000Z',
        location: 'SFMOMA, San Francisco',
        originalUrl: 'https://example.com/art',
        description: 'Contemporary art exhibition opening night',
        source: 'test',
        eventType: 'art'
      }
    ];

    console.log(`1️⃣ 模拟抓取: ${scrapedEvents.length} 个活动\n`);

    // 步骤 1: filterByDatabase (保存并获取 ID)
    console.log('2️⃣ 数据库去重（保存活动）...\n');
    const uniqueEvents = [];
    const weekRange = {
      identifier: '2026-01-05_to_2026-01-11',
      start: new Date('2026-01-05'),
      end: new Date('2026-01-11')
    };

    for (const event of scrapedEvents) {
      event.weekIdentifier = weekRange.identifier;
      try {
        const result = await database.saveEvent(event);
        console.log(`  保存: ${event.title}`);
        console.log(`    result.saved: ${result.saved}`);
        console.log(`    result.id: ${result.id}`);

        if (result.saved) {
          event.id = result.id;
          console.log(`    event.id 已设置: ${event.id}`);
          uniqueEvents.push(event);
        }
      } catch (error) {
        console.error(`  保存失败: ${event.title} - ${error.message}`);
      }
    }

    console.log(`\n  ✅ 数据库去重完成: ${scrapedEvents.length} → ${uniqueEvents.length}\n`);

    if (uniqueEvents.length === 0) {
      console.log('❌ 没有新活动，测试结束');
      return;
    }

    // 步骤 2: 翻译
    console.log('3️⃣ 翻译活动标题...\n');
    console.log(`  传入 translator.translateEvents 的事件:`);
    uniqueEvents.forEach((e, i) => {
      console.log(`    [${i}] id: ${e.id}, title: ${e.title}`);
    });
    console.log('');

    const translatedEvents = await translator.translateEvents(
      uniqueEvents,
      10,
      1000,
      database  // 传入数据库实例
    );

    console.log(`\n  翻译后的事件:`);
    translatedEvents.forEach((e, i) => {
      console.log(`    [${i}] id: ${e.id}, title_zh: ${e.title_zh}`);
    });
    console.log('');

    // 步骤 3: 摘要
    console.log('4️⃣ 生成摘要...\n');
    if (summarizer.getAvailableProviders().length > 0) {
      const summarizedEvents = await summarizer.summarizeEvents(
        translatedEvents,
        5,
        2000,
        database  // 传入数据库实例
      );
      console.log(`\n  摘要生成完成\n`);
    } else {
      console.log('  ⚠️  跳过（无摘要服务）\n');
    }

    // 步骤 4: 验证数据库
    console.log('5️⃣ 验证数据库...\n');
    const events = await new Promise((resolve, reject) => {
      database.db.all('SELECT * FROM events', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  数据库验证结果`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    events.forEach((event, i) => {
      console.log(`活动 ${i + 1}: ${event.title}`);
      console.log(`  ID: ${event.id}`);
      console.log(`  中文标题: ${event.title_zh || '❌ 缺失'}`);
      console.log(`  中文摘要: ${event.summary_zh || '⚠️  缺失'}`);
      console.log(`  英文摘要: ${event.summary_en || '⚠️  缺失'}`);
      console.log('');
    });

    const withTitleZh = events.filter(e => e.title_zh).length;
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  总结`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`总活动数: ${events.length}`);
    console.log(`有中文标题: ${withTitleZh}/${events.length}`);

    if (withTitleZh === events.length) {
      console.log('\n✅ 成功！所有翻译都已写入数据库！\n');
    } else {
      console.log('\n❌ 失败！有些翻译未写入数据库\n');
    }

  } catch (error) {
    console.error('\n❌ 错误:', error);
    console.error(error.stack);
  } finally {
    await database.close();
  }
}

testScrapeWorkflow().catch(console.error);
