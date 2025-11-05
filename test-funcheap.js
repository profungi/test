#!/usr/bin/env node

/**
 * 测试 Funcheap 抓取器
 */

const FuncheapWeekendScraper = require('./src/scrapers/funcheap-weekend-scraper');

async function testFuncheap() {
  console.log('🧪 Testing Funcheap Scraper...\n');

  const scraper = new FuncheapWeekendScraper();

  try {
    // 抓取活动
    const events = await scraper.scrape();

    console.log(`\n✅ 抓取完成！共找到 ${events.length} 个活动\n`);

    // 显示前3个活动
    if (events.length > 0) {
      console.log('前3个活动示例:');
      events.slice(0, 3).forEach((event, i) => {
        console.log(`\n${i + 1}. ${event.title}`);
        console.log(`   时间: ${event.startTime}`);
        console.log(`   地点: ${event.location}`);
        console.log(`   价格: ${event.price || 'N/A'}`);
        console.log(`   URL: ${event.originalUrl}`);
        console.log(`   描述: ${(event.description || '').substring(0, 100)}...`);
      });
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFuncheap();
