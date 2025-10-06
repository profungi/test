#!/usr/bin/env node

/**
 * 测试 Puppeteer 爬虫 - 只测试一个页面
 */

const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');

async function testSinglePage() {
  console.log('🧪 Testing Puppeteer-based Eventbrite scraper...\n');

  const scraper = new EventbriteScraper();

  try {
    // 获取下周时间范围
    const weekRange = scraper.getNextWeekRange();
    console.log(`📅 Target week: ${weekRange.identifier}\n`);

    // 使用 scraper.scrapeEvents 而不是直接调用 parseEventbritePage
    // 这样会进入详情页获取完整信息
    console.log('🕷️  Starting to scrape events (will fetch detail pages)...\n');
    const allEvents = await scraper.scrapeEvents(weekRange);

    console.log(`\n📊 Results:`);
    console.log(`   Total events scraped: ${allEvents.length}`);

    // 显示前10个活动的详细信息
    console.log(`\n📝 Sample events (first 10):\n`);
    allEvents.slice(0, 10).forEach((event, i) => {
      console.log(`Event ${i + 1}:`);
      console.log(`   Title: ${event.title}`);
      console.log(`   Time: ${event.startTime}`);
      console.log(`   Location: ${event.location}`);
      console.log(`   Price: ${event.price || 'N/A'}`);
      console.log(`   URL: ${event.originalUrl.substring(0, 80)}...`);
      console.log('');
    });

    // 检查问题
    console.log(`\n🔍 Quality Check:`);
    const defaultLocations = allEvents.filter(e =>
      e.location === 'San Francisco Bay Area' || e.location === 'San Francisco'
    );
    const missingPrice = allEvents.filter(e => !e.price);
    const checkTicketPrice = allEvents.filter(e =>
      e.price && e.price.includes('Check ticket')
    );
    const hasFullAddress = allEvents.filter(e =>
      e.location && (e.location.match(/\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd)/i) ||
                     e.location.includes(','))
    );

    console.log(`   Events with default location: ${defaultLocations.length}/${allEvents.length}`);
    console.log(`   Events without price info: ${missingPrice.length}/${allEvents.length}`);
    console.log(`   Events with "Check ticket": ${checkTicketPrice.length}/${allEvents.length}`);
    console.log(`   Events with full address: ${hasFullAddress.length}/${allEvents.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // 确保关闭浏览器
    await scraper.closeBrowser();
    console.log('\n✅ Test completed');
  }
}

testSinglePage();
