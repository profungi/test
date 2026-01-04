#!/usr/bin/env node

/**
 * 调试脚本：测试翻译和摘要更新数据库
 */

const path = require('path');
const fs = require('fs');

// 设置测试环境
const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-debug-translation.db');
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
  console.log('═══════════════════════════════════════════');
  console.log('  调试：翻译更新数据库测试');
  console.log('═══════════════════════════════════════════\n');

  const db = new EventDatabase();
  await db.connect();

  try {
    // 1. 创建一个测试活动
    console.log('📝 步骤 1: 创建测试活动...\n');
    const testEvent = {
      title: 'Test Event - Hello World',
      startTime: '2026-01-10T18:00:00.000Z',
      endTime: '2026-01-10T20:00:00.000Z',
      location: 'San Francisco, CA',
      originalUrl: 'https://example.com/test-event',
      description: 'This is a test event for debugging translation updates.',
      source: 'test',
      weekIdentifier: '2026-01-05_to_2026-01-11',
      eventType: 'other',
      priority: 0
    };

    const saveResult = await db.saveEvent(testEvent);
    console.log(`✅ 活动已保存，ID: ${saveResult.id}\n`);

    testEvent.id = saveResult.id;

    // 2. 验证活动已保存（检查数据库）
    console.log('📝 步骤 2: 读取数据库验证...\n');
    const beforeUpdate = await new Promise((resolve, reject) => {
      db.db.get('SELECT * FROM events WHERE id = ?', [testEvent.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('保存的活动数据:');
    console.log(`  - ID: ${beforeUpdate.id}`);
    console.log(`  - Title: ${beforeUpdate.title}`);
    console.log(`  - Title ZH (before): ${beforeUpdate.title_zh || '(null)'}\n`);

    // 3. 翻译标题
    console.log('📝 步骤 3: 翻译标题...\n');
    const translator = new Translator('auto');

    const translatedEvents = await translator.translateEvents(
      [testEvent],
      1,
      1000,
      db  // 传入数据库实例
    );

    console.log(`\n翻译结果（内存）:`);
    console.log(`  - Title: ${translatedEvents[0].title}`);
    console.log(`  - Title ZH: ${translatedEvents[0].title_zh}\n`);

    // 4. 再次验证数据库
    console.log('📝 步骤 4: 验证数据库更新...\n');
    const afterUpdate = await new Promise((resolve, reject) => {
      db.db.get('SELECT * FROM events WHERE id = ?', [testEvent.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('更新后的数据库数据:');
    console.log(`  - ID: ${afterUpdate.id}`);
    console.log(`  - Title: ${afterUpdate.title}`);
    console.log(`  - Title ZH (after): ${afterUpdate.title_zh || '(null)'}\n`);

    if (afterUpdate.title_zh) {
      console.log('✅ 成功！翻译已写入数据库\n');
    } else {
      console.log('❌ 失败！翻译未写入数据库\n');

      // 手动尝试更新
      console.log('🔧 尝试手动更新...\n');
      await db.updateEventTranslation(testEvent.id, '测试活动 - 你好世界');

      const manualUpdate = await new Promise((resolve, reject) => {
        db.db.get('SELECT * FROM events WHERE id = ?', [testEvent.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      console.log('手动更新后:');
      console.log(`  - Title ZH: ${manualUpdate.title_zh || '(null)'}\n`);
    }

  } catch (error) {
    console.error('❌ 错误:', error);
    console.error(error.stack);
  } finally {
    await db.close();
  }
}

test().catch(console.error);
