#!/usr/bin/env node

/**
 * 初始化反馈系统数据库
 * 运行此脚本会创建反馈闭环系统需要的所有表结构
 */

const PerformanceDatabase = require('./src/feedback/performance-database');

async function initializeFeedbackDatabase() {
  console.log('🚀 开始初始化反馈系统数据库...\n');

  const db = new PerformanceDatabase();

  try {
    // 1. 连接数据库
    await db.connect();

    // 2. 初始化表结构
    await db.initializeFeedbackTables();

    // 3. 验证表是否创建成功
    console.log('\n📋 验证表结构...');
    const tables = await db.all(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('posts', 'event_performance', 'weight_adjustments')
      ORDER BY name
    `);

    console.log('✅ 已创建的表:');
    tables.forEach(t => console.log(`   - ${t.name}`));

    // 4. 检查视图
    const views = await db.all(`
      SELECT name FROM sqlite_master
      WHERE type='view'
      ORDER BY name
    `);

    if (views.length > 0) {
      console.log('\n✅ 已创建的视图:');
      views.forEach(v => console.log(`   - ${v.name}`));
    }

    // 5. 检查Schema版本
    const version = await db.get('SELECT * FROM schema_version ORDER BY version DESC LIMIT 1');
    console.log(`\n📌 Schema版本: ${version.version}`);
    console.log(`   应用时间: ${version.applied_at}`);
    console.log(`   说明: ${version.description}`);

    console.log('\n✨ 反馈系统数据库初始化完成！');
    console.log('\n💡 下一步:');
    console.log('   1. 运行 npm run generate-post 生成发布内容');
    console.log('   2. 发布后运行 npm run collect-feedback <post_id> 收集反馈');

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// 执行初始化
if (require.main === module) {
  initializeFeedbackDatabase();
}

module.exports = initializeFeedbackDatabase;
