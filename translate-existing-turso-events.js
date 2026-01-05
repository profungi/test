#!/usr/bin/env node

/**
 * 为 Turso 中已有的活动添加翻译和摘要
 */

require('dotenv').config();

const TursoDatabase = require('./src/utils/turso-database');
const Translator = require('./src/utils/translator');
const Summarizer = require('./src/utils/summarizer');

async function translateExistingEvents() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  为 Turso 中已有活动添加翻译和摘要');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.log('❌ Turso 配置未找到！');
    process.exit(1);
  }

  const db = new TursoDatabase();
  const translator = new Translator('auto');
  const summarizer = new Summarizer();

  try {
    await db.connect();
    console.log('✅ 已连接到 Turso 数据库\n');

    // 查询没有翻译的活动
    console.log('📊 查询需要翻译的活动...\n');
    const result = await db.client.execute({
      sql: 'SELECT id, title, description FROM events WHERE title_zh IS NULL ORDER BY scraped_at DESC LIMIT 100',
      args: []
    });

    if (result.rows.length === 0) {
      console.log('✅ 所有活动都已有翻译！\n');
      await db.close();
      return;
    }

    console.log(`找到 ${result.rows.length} 个需要翻译的活动\n`);

    // 转换为事件对象
    const events = result.rows.map(row => ({
      id: row[0],
      title: row[1],
      description: row[2]
    }));

    // 翻译
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  步骤 1/2: 翻译标题');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const translatedEvents = await translator.translateEvents(
      events,
      10,
      1000,
      db  // 传入数据库实例
    );

    // 生成摘要
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  步骤 2/2: 生成摘要');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (summarizer.getAvailableProviders().length > 0) {
      const summarizedEvents = await summarizer.summarizeEvents(
        translatedEvents,
        5,
        2000,
        db  // 传入数据库实例
      );
      console.log('\n✅ 摘要生成完成\n');
    } else {
      console.log('⚠️  跳过摘要生成（无可用服务）\n');
    }

    // 验证
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  验证结果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 查询更新后的活动
    const verifyResult = await db.client.execute({
      sql: 'SELECT id, title, title_zh, summary_zh FROM events WHERE id IN (' + events.map(e => e.id).join(',') + ')',
      args: []
    });

    let translatedCount = 0;
    let summarizedCount = 0;

    verifyResult.rows.forEach(row => {
      if (row[2]) translatedCount++;
      if (row[3]) summarizedCount++;
    });

    console.log(`✅ 有翻译: ${translatedCount}/${events.length}`);
    console.log(`✅ 有摘要: ${summarizedCount}/${events.length}\n`);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await db.close();
  }
}

translateExistingEvents().catch(console.error);
