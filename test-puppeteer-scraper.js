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

    // 只抓取第一页
    const url = 'https://www.eventbrite.com/d/ca--san-francisco/events/?page=1';
    console.log(`🌐 Fetching URL: ${url}\n`);

    const $ = await scraper.fetchPage(url);

    // 尝试解析页面
    const pageEvents = await scraper.parseEventbritePage($);

    console.log(`\n📊 Results:`);
    console.log(`   Total events found: ${pageEvents.length}`);

    // 显示前3个活动的详细信息
    console.log(`\n📝 Sample events (first 3):\n`);
    pageEvents.slice(0, 3).forEach((event, i) => {
      console.log(`Event ${i + 1}:`);
      console.log(`   Title: ${event.title}`);
      console.log(`   Time: ${event.startTime}`);
      console.log(`   Location: ${event.location}`);
      console.log(`   Price: ${event.price || 'N/A'}`);
      console.log(`   URL: ${event.originalUrl}`);
      console.log('');
    });

    // 检查问题
    console.log(`\n🔍 Quality Check:`);
    const defaultLocations = pageEvents.filter(e =>
      e.location === 'San Francisco Bay Area' || e.location === 'San Francisco'
    );
    const missingPrice = pageEvents.filter(e => !e.price);
    const tempTime = pageEvents.filter(e => {
      const time = new Date(e.startTime);
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return Math.abs(time - sevenDaysLater) < 60000; // 1分钟内的差异
    });

    console.log(`   Events with default location: ${defaultLocations.length}/${pageEvents.length}`);
    console.log(`   Events without price info: ${missingPrice.length}/${pageEvents.length}`);
    console.log(`   Events with temporary time: ${tempTime.length}/${pageEvents.length}`);

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
