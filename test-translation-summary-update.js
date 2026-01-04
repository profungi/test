#!/usr/bin/env node

/**
 * 简化测试：只测试翻译和摘要更新数据库
 */

const path = require('path');
const fs = require('fs');

// 设置测试环境
const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-translation-summary.db');
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

async function test() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  测试：翻译和摘要更新数据库');
  console.log('═══════════════════════════════════════════════════════════\n');

  const db = new EventDatabase();
  const translator = new Translator('auto');
  const summarizer = new Summarizer();

  await db.connect();

  try {
    // 1. 创建3个测试活动
    console.log('步骤 1: 创建测试活动...\n');
    const testEvents = [
      {
        title: 'Music Festival in Golden Gate Park',
        startTime: '2026-01-10T14:00:00.000Z',
        location: 'Golden Gate Park, San Francisco, CA',
        originalUrl: 'https://example.com/event1',
        description: 'A wonderful outdoor music festival featuring local and international artists. Enjoy food, drinks, and great music in beautiful Golden Gate Park.',
        source: 'test',
        weekIdentifier: '2026-01-05_to_2026-01-11',
        eventType: 'music'
      },
      {
        title: 'Art Exhibition Opening Night',
        startTime: '2026-01-11T18:00:00.000Z',
        location: 'SFMOMA, San Francisco, CA',
        originalUrl: 'https://example.com/event2',
        description: 'Join us for the opening night of our contemporary art exhibition. Meet the artists and explore their latest works.',
        source: 'test',
        weekIdentifier: '2026-01-05_to_2026-01-11',
        eventType: 'art'
      },
      {
        title: 'Tech Meetup for AI Developers',
        startTime: '2026-01-09T19:00:00.000Z',
        location: 'Tech Hub, San Jose, CA',
        originalUrl: 'https://example.com/event3',
        description: 'Monthly meetup for AI and machine learning developers. Network with peers and learn about the latest trends in AI technology.',
        source: 'test',
        weekIdentifier: '2026-01-05_to_2026-01-11',
        eventType: 'tech'
      }
    ];

    for (const event of testEvents) {
      const result = await db.saveEvent(event);
      event.id = result.id;
      console.log(`✅ 保存: ${event.title} (ID: ${event.id})`);
    }
    console.log('');

    // 2. 翻译标题
    console.log('步骤 2: 翻译活动标题...\n');
    const translatedEvents = await translator.translateEvents(
      testEvents,
      3,
      1000,
      db  // 传入数据库实例
    );

    console.log('\n✅ 翻译完成\n');

    // 3. 生成摘要
    console.log('步骤 3: 生成活动摘要...\n');
    console.log(`可用的摘要服务: ${summarizer.getAvailableProviders()}`);

    if (summarizer.getAvailableProviders().length > 0) {
      const summarizedEvents = await summarizer.summarizeEvents(
        translatedEvents,
        3,
        2000,
        db  // 传入数据库实例
      );
      console.log('\n✅ 摘要生成完成\n');
    } else {
      console.log('⚠️  没有可用的摘要服务，跳过摘要生成');
      console.log('   如需启用摘要，请配置以下环境变量之一：');
      console.log('   - NEW API_KEY + NEWAPI_MODEL');
      console.log('   - GEMINI_API_KEY');
      console.log('   - MISTRAL_API_KEY\n');
    }

    // 4. 验证数据库
    console.log('步骤 4: 验证数据库更新...\n');

    const events = await new Promise((resolve, reject) => {
      db.db.all('SELECT * FROM events ORDER BY id', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  验证结果`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    let successCount = 0;
    let failCount = 0;

    events.forEach((event, idx) => {
      console.log(`活动 ${idx + 1}: ${event.title}`);

      if (event.title_zh) {
        console.log(`  ✅ 中文标题: ${event.title_zh}`);
        successCount++;
      } else {
        console.log(`  ❌ 中文标题: 缺失`);
        failCount++;
      }

      if (event.summary_zh) {
        console.log(`  ✅ 中文摘要: ${event.summary_zh.substring(0, 50)}...`);
      } else {
        console.log(`  ⚠️  中文摘要: 缺失 (可能没有摘要服务)`);
      }

      if (event.summary_en) {
        console.log(`  ✅ 英文摘要: ${event.summary_en.substring(0, 50)}...`);
      } else {
        console.log(`  ⚠️  英文摘要: 缺失 (可能没有摘要服务)`);
      }

      console.log('');
    });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  测试总结`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`总活动数: ${events.length}`);
    console.log(`✅ 有中文标题: ${successCount}/${events.length}`);
    console.log(`❌ 缺少中文标题: ${failCount}/${events.length}\n`);

    if (successCount === events.length) {
      console.log('🎉 成功！所有翻译都已写入数据库！\n');
    } else {
      console.log('❌ 失败！有些翻译未写入数据库\n');
    }

  } catch (error) {
    console.error('\n❌ 错误:', error);
    console.error(error.stack);
  } finally {
    await db.close();
  }
}

test().catch(console.error);
