#!/usr/bin/env node

/**
 * 删除 Turso 中指定周的活动并同步到本地
 */

require('dotenv').config();

const TursoDatabase = require('./src/utils/turso-database');
const { execSync } = require('child_process');

async function deleteWeekEvents() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  删除 Turso 中的活动');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.log('❌ Turso 配置未找到！');
    console.log('请确保 .env 文件中配置了:');
    console.log('  - TURSO_DATABASE_URL');
    console.log('  - TURSO_AUTH_TOKEN\n');
    process.exit(1);
  }

  const weekIdentifier = '2026-01-05_to_2026-01-11';

  console.log(`🗑️  目标周: ${weekIdentifier}`);
  console.log('   (2026年1月5日 - 2026年1月11日)\n');

  const db = new TursoDatabase();

  try {
    await db.connect();
    console.log('✅ 已连接到 Turso 数据库\n');

    // 1. 查询该周的活动数量
    console.log('📊 查询该周的活动...\n');
    const countResult = await db.client.execute({
      sql: 'SELECT COUNT(*) as count FROM events WHERE week_identifier = ?',
      args: [weekIdentifier]
    });

    const eventCount = countResult.rows[0][0];
    console.log(`   找到 ${eventCount} 个活动\n`);

    if (eventCount === 0) {
      console.log('✅ 该周没有活动，无需删除\n');
      await db.close();
      return;
    }

    // 2. 显示活动列表
    console.log('   活动列表:\n');
    const listResult = await db.client.execute({
      sql: 'SELECT id, title, source, scraped_at FROM events WHERE week_identifier = ? ORDER BY scraped_at DESC LIMIT 10',
      args: [weekIdentifier]
    });

    listResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. [${row[2]}] ${row[1]}`);
    });

    if (eventCount > 10) {
      console.log(`   ... 以及其他 ${eventCount - 10} 个活动`);
    }
    console.log('');

    // 3. 确认删除
    console.log('⚠️  警告：即将删除这些活动！\n');
    console.log('   按 Ctrl+C 取消，或等待 5 秒后自动继续...\n');

    // 等待 5 秒
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. 删除活动
    console.log('🗑️  正在删除活动...\n');
    const deleteResult = await db.client.execute({
      sql: 'DELETE FROM events WHERE week_identifier = ?',
      args: [weekIdentifier]
    });

    console.log(`✅ 已删除 ${deleteResult.rowsAffected} 个活动\n`);

    // 5. 验证删除
    const verifyResult = await db.client.execute({
      sql: 'SELECT COUNT(*) as count FROM events WHERE week_identifier = ?',
      args: [weekIdentifier]
    });

    const remainingCount = verifyResult.rows[0][0];
    if (remainingCount === 0) {
      console.log('✅ 删除成功，该周活动已清空\n');
    } else {
      console.log(`⚠️  还有 ${remainingCount} 个活动未删除\n`);
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.close();
  }

  // 6. 同步到本地
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  同步到本地数据库');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('🔄 正在同步...\n');
    execSync('node sync-from-turso.js', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('\n✅ 同步完成！\n');
  } catch (error) {
    console.error('⚠️  同步失败:', error.message);
    console.error('   你可以稍后手动运行: npm run sync-from-turso\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  完成！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('现在可以重新抓取该周的活动：\n');
  console.log('   USE_TURSO=1 npm run scrape\n');
  console.log('这次会正确保存翻译和摘要！\n');
}

deleteWeekEvents().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
