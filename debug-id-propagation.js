#!/usr/bin/env node

/**
 * 调试：检查 ID 是否正确传递
 */

const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-id-debug.db');
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

async function test() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  调试：ID 传递检查');
  console.log('═══════════════════════════════════════════════════════════\n');

  const db = new EventDatabase();
  const translator = new Translator('auto');

  await db.connect();

  try {
    // 1. 创建测试活动
    const testEvent = {
      title: 'Test Event',
      startTime: '2026-01-10T18:00:00.000Z',
      endTime: '2026-01-10T20:00:00.000Z',
      location: 'San Francisco, CA',
      originalUrl: 'https://example.com/test',
      description: 'Test description',
      source: 'test',
      weekIdentifier: '2026-01-05_to_2026-01-11',
      eventType: 'other',
      priority: 0
    };

    console.log('步骤 1: 保存事件到数据库...');
    const saveResult = await db.saveEvent(testEvent);
    console.log(`  saveResult:`, saveResult);
    console.log(`  saveResult.id:`, saveResult.id);
    console.log(`  saveResult.saved:`, saveResult.saved);

    // 添加 ID 到事件对象
    testEvent.id = saveResult.id;
    console.log(`  testEvent.id after assignment:`, testEvent.id);
    console.log('');

    // 2. 检查事件对象
    console.log('步骤 2: 检查事件对象...');
    console.log(`  事件对象有 id 属性:`, testEvent.hasOwnProperty('id'));
    console.log(`  testEvent.id 值:`, testEvent.id);
    console.log(`  testEvent.id 类型:`, typeof testEvent.id);
    console.log('');

    // 3. 翻译
    console.log('步骤 3: 翻译事件...');
    const translatedEvents = await translator.translateEvents(
      [testEvent],
      1,
      1000,
      db
    );

    console.log('');
    console.log('步骤 4: 检查翻译后的事件对象...');
    console.log(`  translatedEvents[0].id:`, translatedEvents[0].id);
    console.log(`  translatedEvents[0].title:`, translatedEvents[0].title);
    console.log(`  translatedEvents[0].title_zh:`, translatedEvents[0].title_zh);
    console.log('');

    // 4. 验证数据库
    console.log('步骤 5: 验证数据库...');
    const dbEvent = await new Promise((resolve, reject) => {
      db.db.get('SELECT * FROM events WHERE id = ?', [testEvent.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log(`  数据库中的 title:`, dbEvent.title);
    console.log(`  数据库中的 title_zh:`, dbEvent.title_zh || '(null)');
    console.log('');

    if (dbEvent.title_zh) {
      console.log('✅ 成功！翻译已写入数据库');
    } else {
      console.log('❌ 失败！翻译未写入数据库');
      console.log('\n调试信息：');
      console.log('  - saveResult.id:', saveResult.id);
      console.log('  - testEvent.id:', testEvent.id);
      console.log('  - translatedEvents[0].id:', translatedEvents[0].id);
    }

  } catch (error) {
    console.error('❌ 错误:', error);
    console.error(error.stack);
  } finally {
    await db.close();
  }
}

test().catch(console.error);
