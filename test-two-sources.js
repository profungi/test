#!/usr/bin/env node

/**
 * 专门测试 DoTheBay 和 San Jose Downtown 两个网站的抓取
 * 目的：隔离调试这两个网站的问题
 *
 * DoTheBay 问题：找不到时间
 * San Jose Downtown 问题：其他问题待排查
 */

const path = require('path');
const fs = require('fs');

// ==================== 环境设置 ====================
// 测试数据库路径
const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-two-sources.db');

// 确保测试数据目录存在
const testDataDir = path.dirname(TEST_DB_PATH);
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// 删除旧的测试数据库
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
  console.log(`🗑️  已删除旧的测试数据库: ${TEST_DB_PATH}`);
}

// ⚠️ 关键：在require任何模块之前设置环境变量
// 注意：不能 delete USE_TURSO，因为 dotenv.config() 会重新从 .env 读取
// 必须设置为空字符串（falsy值），这样 dotenv 不会覆盖，且 boolean 判断为 false
process.env.USE_TURSO = '';  // 禁用Turso（空字符串 = false）
process.env.DATABASE_PATH = TEST_DB_PATH;  // 设置测试数据库路径

console.log('🔧 环境变量设置:');
console.log(`   USE_TURSO = '${process.env.USE_TURSO}' (空字符串 = 禁用)`);
console.log(`   DATABASE_PATH = ${process.env.DATABASE_PATH}`);
console.log('');

// ==================== 导入模块 ====================
const ConfigurableScraperManager = require('./src/scrapers/configurable-scraper-manager');
const Database = require('./src/utils/database');

// ==================== 主测试函数 ====================
async function testTwoSources() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  测试 DoTheBay 和 San Jose Downtown 抓取');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const db = new Database();
  await db.connect();

  try {
    // 初始化配置化抓取器管理器
    const manager = new ConfigurableScraperManager();

    // 获取所有配置化抓取器
    const allScrapers = manager.getAllScrapers();
    console.log(`📋 总共加载了 ${allScrapers.length} 个配置化抓取器\n`);

    // 找到 DoTheBay 和 San Jose Downtown 抓取器
    // 使用 config.name 或 config.displayName 来匹配
    const dothebay = allScrapers.find(s => {
      const name = s.config.name || s.config.displayName || '';
      return name.toLowerCase().includes('dothebay');
    });
    const sjdowntown = allScrapers.find(s => {
      const displayName = s.config.displayName || s.config.name || '';
      return displayName.toLowerCase().includes('san jose downtown') ||
             displayName.toLowerCase().includes('sjdowntown');
    });

    if (!dothebay) {
      console.error('❌ 找不到 DoTheBay 抓取器');
    } else {
      console.log(`✅ 找到抓取器: ${dothebay.config.displayName || dothebay.config.name}`);
    }

    if (!sjdowntown) {
      console.error('❌ 找不到 San Jose Downtown 抓取器');
    } else {
      console.log(`✅ 找到抓取器: ${sjdowntown.config.displayName || sjdowntown.config.name}`);
    }

    if (!dothebay && !sjdowntown) {
      console.error('\n❌ 两个抓取器都找不到，退出测试');
      return;
    }

    console.log('');

    // 获取当前周的时间范围
    const weekRange = dothebay ? dothebay.getCurrentWeekRange() : sjdowntown.getCurrentWeekRange();
    console.log(`📅 抓取时间范围: ${weekRange.start.toLocaleDateString()} - ${weekRange.end.toLocaleDateString()}\n`);

    // ==================== 测试 DoTheBay ====================
    if (dothebay) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  测试 1: DoTheBay (问题：找不到时间)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      try {
        console.log(`🔄 [${dothebay.name}] 开始抓取...`);
        console.log(`   配置信息:`);
        console.log(`   - URL: ${dothebay.config.url || dothebay.config.listUrl}`);
        console.log(`   - 抓取方式: ${dothebay.config.extractionType ? 'AI提取' : 'CSS选择器'}`);
        console.log('');

        const events = await dothebay.scrapeEvents(weekRange);

        console.log(`\n✅ [${dothebay.name}] 抓取完成`);
        console.log(`   找到 ${events.length} 个活动\n`);

        if (events.length > 0) {
          console.log('📝 前3个活动预览:');
          events.slice(0, 3).forEach((event, idx) => {
            console.log(`\n   活动 ${idx + 1}:`);
            console.log(`   - 标题: ${event.title}`);
            console.log(`   - 时间: ${event.time || '❌ 未找到'}`);
            console.log(`   - 地点: ${event.location || '未知'}`);
            console.log(`   - 链接: ${event.link}`);
          });

          // 保存到数据库
          console.log(`\n💾 保存活动到数据库...`);
          let savedCount = 0;
          for (const event of events) {
            const saved = await db.saveEvent(event);
            if (saved) savedCount++;
          }
          console.log(`✅ 成功保存 ${savedCount}/${events.length} 个活动到数据库`);
        } else {
          console.log('⚠️  没有找到任何活动，可能的原因：');
          console.log('   1. 网站内容被时间过滤掉了');
          console.log('   2. CSS选择器/AI提取失败');
          console.log('   3. 所有活动都被验证步骤过滤掉了');
        }
      } catch (error) {
        console.error(`\n❌ [${dothebay.name}] 抓取失败:`);
        console.error(`   错误: ${error.message}`);
        console.error(`   堆栈:\n${error.stack}`);
      }
    }

    console.log('\n');

    // ==================== 测试 San Jose Downtown ====================
    if (sjdowntown) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  测试 2: San Jose Downtown');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      try {
        console.log(`🔄 [${sjdowntown.name}] 开始抓取...`);
        console.log(`   配置信息:`);
        console.log(`   - URL: ${sjdowntown.config.url || sjdowntown.config.listUrl}`);
        console.log(`   - 抓取方式: ${sjdowntown.config.extractionType ? 'AI提取' : 'CSS选择器'}`);
        console.log('');

        const events = await sjdowntown.scrapeEvents(weekRange);

        console.log(`\n✅ [${sjdowntown.name}] 抓取完成`);
        console.log(`   找到 ${events.length} 个活动\n`);

        if (events.length > 0) {
          console.log('📝 前3个活动预览:');
          events.slice(0, 3).forEach((event, idx) => {
            console.log(`\n   活动 ${idx + 1}:`);
            console.log(`   - 标题: ${event.title}`);
            console.log(`   - 时间: ${event.time || '❌ 未找到'}`);
            console.log(`   - 地点: ${event.location || '未知'}`);
            console.log(`   - 链接: ${event.link}`);
          });

          // 保存到数据库
          console.log(`\n💾 保存活动到数据库...`);
          let savedCount = 0;
          for (const event of events) {
            const saved = await db.saveEvent(event);
            if (saved) savedCount++;
          }
          console.log(`✅ 成功保存 ${savedCount}/${events.length} 个活动到数据库`);
        } else {
          console.log('⚠️  没有找到任何活动，可能的原因：');
          console.log('   1. 网站内容被时间过滤掉了');
          console.log('   2. CSS选择器/AI提取失败');
          console.log('   3. 所有活动都被验证步骤过滤掉了');
        }
      } catch (error) {
        console.error(`\n❌ [${sjdowntown.name}] 抓取失败:`);
        console.error(`   错误: ${error.message}`);
        console.error(`   堆栈:\n${error.stack}`);
      }
    }

    // ==================== 数据库统计 ====================
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  数据库统计');
    console.log('═══════════════════════════════════════════════════════════');

    const stats = await db.getEventStats();
    console.log(`\n📊 测试数据库: ${TEST_DB_PATH}`);
    console.log(`   总活动数: ${stats.total}`);
    console.log(`   按来源分布:`);

    if (stats.byScraper) {
      for (const [scraper, count] of Object.entries(stats.byScraper)) {
        console.log(`   - ${scraper}: ${count}`);
      }
    }

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:');
    console.error(error);
  } finally {
    await db.close();
    console.log('\n✅ 测试完成\n');
  }
}

// ==================== 执行测试 ====================
testTwoSources().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
