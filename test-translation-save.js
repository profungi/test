#!/usr/bin/env node

/**
 * 测试翻译是否正确保存到数据库
 */

const EventDatabase = require('./src/utils/database');
const Translator = require('./src/utils/translator');

async function test() {
  console.log('🧪 开始测试翻译保存功能...\n');

  const db = new EventDatabase();
  await db.connect();

  const translator = new Translator('auto');

  // 创建测试事件
  const testEvents = [
    {
      title: 'Christmas Market at Union Square',
      startTime: '2024-12-20T10:00:00',
      location: 'Union Square',
      originalUrl: `https://test-${Date.now()}-1.com`,
      source: 'test',
      weekIdentifier: 'test-' + new Date().toISOString().split('T')[0]
    }
  ];

  console.log('1️⃣ 原始事件:');
  console.log('   Title:', testEvents[0].title);
  console.log('   Title_zh:', testEvents[0].title_zh || '(未设置)');

  // 翻译
  console.log('\n2️⃣ 开始翻译...');
  const translatedEvents = await translator.translateEvents(testEvents, 1, 100);

  console.log('   Title:', translatedEvents[0].title);
  console.log('   Title_zh:', translatedEvents[0].title_zh || '(未设置)');

  // 保存到数据库
  console.log('\n3️⃣ 保存到数据库...');
  const result = await db.saveEvent(translatedEvents[0]);

  if (result.saved) {
    console.log('   ✅ 保存成功, ID:', result.id);

    // 从数据库读取验证
    console.log('\n4️⃣ 从数据库读取验证...');
    const savedEvent = await new Promise((resolve, reject) => {
      db.db.get('SELECT title, title_zh FROM events WHERE id = ?', [result.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('   数据库中的 Title:', savedEvent.title);
    console.log('   数据库中的 Title_zh:', savedEvent.title_zh || '(NULL)');

    if (savedEvent.title_zh) {
      console.log('\n✅ 测试通过！翻译已正确保存到数据库');
    } else {
      console.log('\n❌ 测试失败！Title_zh 在数据库中为 NULL');
    }
  } else {
    console.log('   ❌ 保存失败:', result.reason);
  }

  await db.close();
}

test().catch(err => {
  console.error('❌ 测试出错:', err);
  process.exit(1);
});
