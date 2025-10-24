#!/usr/bin/env node

/**
 * Funcheap 爬虫独立测试脚本
 * 快速测试 Funcheap 爬虫的功能，无需运行完整的抓取流程
 */

const FuncheapWeekendScraper = require('./src/scrapers/funcheap-weekend-scraper');

async function main() {
  const scraper = new FuncheapWeekendScraper();

  try {
    console.log('🧪 Funcheap 爬虫测试\n');
    console.log('='.repeat(50));

    // 获取下周的时间范围
    const weekRange = scraper.getNextWeekRange();
    console.log(`\n📅 时间范围: ${weekRange.identifier}`);

    // 开始抓取
    console.log('\n🕷️  开始抓取 Funcheap 活动...\n');
    const events = await scraper.scrapeEvents(weekRange);

    console.log('\n' + '='.repeat(50));
    console.log(`\n✅ 抓取完成！\n`);
    console.log(`📊 总共找到 ${events.length} 个活动\n`);

    if (events.length > 0) {
      console.log('📋 前 5 个活动（完整详情）：\n');
      events.slice(0, 5).forEach((event, index) => {
        console.log(`${index + 1}. ${event.title}`);
        console.log(`   🕒 时间: ${event.startTime}${event.endTime ? ` - ${event.endTime}` : '(无结束时间)'}`);
        console.log(`   📍 地点: ${event.location}`);
        console.log(`   💰 价格: ${event.price || '(未获取到)'}`);
        console.log(`   🔗 链接: ${event.originalUrl}`);
        if (event.description) {
          const desc = event.description.trim();
          if (desc) {
            console.log(`   📝 描述: ${desc.substring(0, 150)}${desc.length > 150 ? '...' : ''}`);
          } else {
            console.log(`   📝 描述: (空)`);
          }
        } else {
          console.log(`   📝 描述: (无)`);
        }
        console.log('');
      });

      // 统计信息
      console.log('\n' + '='.repeat(50));
      console.log('📊 数据统计：\n');
      const hasPrice = events.filter(e => e.price && e.price.trim()).length;
      const hasDesc = events.filter(e => e.description && e.description.trim()).length;
      console.log(`✅ 有价格信息: ${hasPrice}/${events.length}`);
      console.log(`✅ 有描述信息: ${hasDesc}/${events.length}`);
    } else {
      console.log('❌ 没有找到任何活动');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

main();
