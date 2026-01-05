#!/usr/bin/env node

/**
 * 检查 Turso 数据库中的翻译和摘要数据
 */

require('dotenv').config();

async function checkTursoData() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  检查 Turso 数据库中的翻译和摘要');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.log('❌ Turso 配置未找到！');
    console.log('请确保 .env 文件中配置了:');
    console.log('  - TURSO_DATABASE_URL');
    console.log('  - TURSO_AUTH_TOKEN\n');
    process.exit(1);
  }

  const TursoDatabase = require('./src/utils/turso-database');
  const db = new TursoDatabase();

  try {
    await db.connect();
    console.log('✅ 已连接到 Turso 数据库\n');

    // 获取最近的活动
    console.log('📊 查询最近的活动（最多10个）...\n');

    const result = await db.client.execute({
      sql: 'SELECT id, title, title_zh, summary_zh, summary_en, source, scraped_at FROM events ORDER BY scraped_at DESC LIMIT 10',
      args: []
    });

    if (result.rows.length === 0) {
      console.log('⚠️  数据库中没有活动数据\n');
      return;
    }

    console.log(`找到 ${result.rows.length} 个最近的活动:\n`);

    let hasTranslation = 0;
    let hasSummary = 0;

    result.rows.forEach((row, index) => {
      const id = row[0];
      const title = row[1];
      const title_zh = row[2];
      const summary_zh = row[3];
      const summary_en = row[4];
      const source = row[5];
      const scraped_at = row[6];

      console.log(`活动 ${index + 1}:`);
      console.log(`  ID: ${id}`);
      console.log(`  来源: ${source}`);
      console.log(`  标题: ${title}`);
      console.log(`  中文标题: ${title_zh || '❌ 缺失'}`);
      console.log(`  中文摘要: ${summary_zh ? '✅ 存在 (' + summary_zh.substring(0, 30) + '...)' : '❌ 缺失'}`);
      console.log(`  英文摘要: ${summary_en ? '✅ 存在 (' + summary_en.substring(0, 30) + '...)' : '❌ 缺失'}`);
      console.log(`  抓取时间: ${scraped_at}`);
      console.log('');

      if (title_zh) hasTranslation++;
      if (summary_zh || summary_en) hasSummary++;
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  统计');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`总活动数: ${result.rows.length}`);
    console.log(`有中文标题: ${hasTranslation}/${result.rows.length} (${Math.round(hasTranslation/result.rows.length*100)}%)`);
    console.log(`有摘要: ${hasSummary}/${result.rows.length} (${Math.round(hasSummary/result.rows.length*100)}%)\n`);

    if (hasTranslation === 0) {
      console.log('❌ 问题：没有活动有中文标题！');
      console.log('\n可能的原因：');
      console.log('  1. 运行 scrape 时没有使用 USE_TURSO=1');
      console.log('  2. 翻译步骤失败或被跳过');
      console.log('  3. 数据库更新失败\n');
      console.log('建议：');
      console.log('  1. 确保使用: USE_TURSO=1 npm run scrape');
      console.log('  2. 查看 scrape 输出中的翻译步骤');
      console.log('  3. 检查是否有错误信息\n');
    }

    if (hasSummary === 0) {
      console.log('⚠️  问题：没有活动有摘要！');
      console.log('\n可能的原因：');
      console.log('  1. 没有配置摘要服务的 API key');
      console.log('  2. 摘要步骤失败或被跳过\n');
      console.log('建议：');
      console.log('  配置以下环境变量之一：');
      console.log('  - GEMINI_API_KEY');
      console.log('  - OPENAI_API_KEY');
      console.log('  - NEWAPI_API_KEY + NEWAPI_MODEL');
      console.log('  - MISTRAL_API_KEY\n');
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await db.close();
  }
}

checkTursoData().catch(console.error);
