#!/usr/bin/env node

/**
 * 诊断为什么 scrape 没有保存翻译和摘要
 */

require('dotenv').config();

async function diagnose() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  诊断 scrape 翻译/摘要问题');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. 检查环境变量
  console.log('1️⃣ 环境变量检查:\n');
  console.log(`   USE_TURSO: ${process.env.USE_TURSO || '未设置'}`);
  console.log(`   TURSO_DATABASE_URL: ${process.env.TURSO_DATABASE_URL ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   TURSO_AUTH_TOKEN: ${process.env.TURSO_AUTH_TOKEN ? '✅ 已配置' : '❌ 未配置'}`);
  console.log('');

  // 2. 模拟 scrape 流程
  console.log('2️⃣ 模拟 scrape 流程:\n');

  // 设置 USE_TURSO
  process.env.USE_TURSO = '1';

  const EventDatabase = process.env.USE_TURSO
    ? require('./src/utils/turso-database')
    : require('./src/utils/database');

  console.log(`   数据库类: ${EventDatabase.name}`);

  if (EventDatabase.name !== 'TursoDatabase') {
    console.log('   ❌ 错误：即使设置了 USE_TURSO=1，仍在使用本地数据库！\n');
    process.exit(1);
  }

  const db = new EventDatabase();

  // 检查方法
  console.log(`   updateEventTranslation: ${typeof db.updateEventTranslation === 'function' ? '✅ 存在' : '❌ 缺失'}`);
  console.log(`   updateEventSummaries: ${typeof db.updateEventSummaries === 'function' ? '✅ 存在' : '❌ 缺失'}`);
  console.log('');

  // 3. 连接到 Turso 并测试更新
  console.log('3️⃣ 测试 Turso 数据库更新:\n');

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.log('   ❌ Turso 配置缺失，无法测试\n');
    process.exit(1);
  }

  try {
    await db.connect();
    console.log('   ✅ 成功连接到 Turso\n');

    // 获取最新的一个活动
    console.log('   查询最新活动...');
    const result = await db.client.execute({
      sql: 'SELECT id, title, title_zh FROM events ORDER BY scraped_at DESC LIMIT 1',
      args: []
    });

    if (result.rows.length === 0) {
      console.log('   ⚠️  数据库中没有活动，无法测试更新\n');
      await db.close();
      return;
    }

    const event = result.rows[0];
    const eventId = event[0];
    const title = event[1];
    const currentTitleZh = event[2];

    console.log(`   找到活动 ID: ${eventId}`);
    console.log(`   标题: ${title}`);
    console.log(`   当前 title_zh: ${currentTitleZh || '(null)'}\n`);

    // 测试更新翻译
    console.log('   测试更新翻译...');
    const testTranslation = '测试翻译 - Test Translation';

    try {
      const updateResult = await db.updateEventTranslation(eventId, testTranslation);
      console.log(`   ✅ 更新成功: ${JSON.stringify(updateResult)}\n`);

      // 验证更新
      console.log('   验证更新...');
      const verifyResult = await db.client.execute({
        sql: 'SELECT title_zh FROM events WHERE id = ?',
        args: [eventId]
      });

      const newTitleZh = verifyResult.rows[0][0];
      console.log(`   更新后的 title_zh: ${newTitleZh}\n`);

      if (newTitleZh === testTranslation) {
        console.log('   ✅ 验证成功：翻译已正确写入 Turso！\n');
      } else {
        console.log('   ❌ 验证失败：翻译未正确写入\n');
      }

      // 恢复原值
      if (currentTitleZh) {
        await db.updateEventTranslation(eventId, currentTitleZh);
        console.log('   ✅ 已恢复原值\n');
      }

    } catch (error) {
      console.log(`   ❌ 更新失败: ${error.message}\n`);
      console.error(error.stack);
    }

  } catch (error) {
    console.error(`   ❌ 连接失败: ${error.message}\n`);
    console.error(error.stack);
  } finally {
    await db.close();
  }

  // 4. 检查 scrape-events.js 流程
  console.log('4️⃣ 检查 scrape 流程代码:\n');

  const fs = require('fs');
  const scrapeCode = fs.readFileSync('./src/scrape-events.js', 'utf8');

  // 检查是否传递数据库给翻译器
  if (scrapeCode.includes('this.database // 传入数据库实例以更新翻译')) {
    console.log('   ✅ 翻译器调用正确传递了 database 参数');
  } else {
    console.log('   ❌ 翻译器调用未传递 database 参数');
  }

  if (scrapeCode.includes('this.database // 传入数据库实例以更新摘要')) {
    console.log('   ✅ 摘要生成器调用正确传递了 database 参数');
  } else {
    console.log('   ❌ 摘要生成器调用未传递 database 参数');
  }

  // 检查是否设置了 event.id
  if (scrapeCode.includes('event.id = result.id')) {
    console.log('   ✅ filterByDatabase 正确设置了 event.id\n');
  } else {
    console.log('   ❌ filterByDatabase 未设置 event.id\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 诊断总结:\n');
  console.log('如果上面所有检查都通过 (✅)，但 scrape 仍然没有保存翻译，');
  console.log('那么问题可能是：\n');
  console.log('1. scrape 运行时没有新活动（都被去重了）');
  console.log('2. 翻译步骤被跳过或失败了');
  console.log('3. 活动对象的 id 字段丢失了\n');
  console.log('建议：');
  console.log('1. 运行 USE_TURSO=1 npm run scrape 并保存完整输出');
  console.log('2. 查看输出中是否有 "🌐 开始翻译活动标题..."');
  console.log('3. 查看输出中是否有 "💾 更新数据库中的翻译..."');
  console.log('4. 检查是否有错误信息\n');
}

diagnose().catch(console.error);
