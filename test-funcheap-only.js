#!/usr/bin/env node

/**
 * 单独测试 Funcheap scraper
 * 快速调试，不运行其他 scrapers
 */

const FuncheapWeekendScraper = require('./src/scrapers/funcheap-weekend-scraper');

async function testFuncheap() {
  console.log('🧪 Testing Funcheap Scraper (standalone)...\n');

  const scraper = new FuncheapWeekendScraper();

  try {
    // 使用 scrape() 方法（包含完整的 base-scraper 流程）
    const events = await scraper.scrape();

    console.log(`\n✅ Final result: ${events.length} events passed all filters\n`);

    // 显示通过验证的活动
    if (events.length > 0) {
      console.log('Events that passed validation:');
      events.forEach((event, i) => {
        console.log(`\n${i + 1}. ${event.title}`);
        console.log(`   📅 ${event.startTime}`);
        console.log(`   📍 ${event.location}`);
        console.log(`   💰 ${event.price || 'N/A'}`);
        console.log(`   🔗 ${event.originalUrl}`);
      });
    } else {
      console.log('❌ No events passed validation. Check the debug logs above.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFuncheap();
