#!/usr/bin/env node
const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');
const SFStationScraper = require('./src/scrapers/sfstation-scraper');
const DoTheBayScraper = require('./src/scrapers/dothebay-scraper');

async function testScrapersOnly() {
  console.log('🕷️ Testing individual scrapers without AI...\n');
  
  const scrapers = [
    { name: 'Eventbrite', scraper: new EventbriteScraper() },
    { name: 'SF Station', scraper: new SFStationScraper() },
    { name: 'DoTheBay', scraper: new DoTheBayScraper() }
  ];
  
  for (const { name, scraper } of scrapers) {
    console.log(`📡 Testing ${name} scraper...`);
    
    try {
      // 获取目标周范围
      const weekRange = scraper.getNextWeekRange();
      console.log(`   Target week: ${weekRange.identifier}`);
      
      // 尝试抓取前5个事件作为测试
      const events = await scraper.scrape();
      
      if (events && events.length > 0) {
        console.log(`   ✅ Successfully scraped ${events.length} events`);
        
        // 显示前2个事件的基本信息
        const sampleEvents = events.slice(0, 2);
        sampleEvents.forEach((event, index) => {
          console.log(`   📅 Event ${index + 1}: ${event.title}`);
          console.log(`      📍 ${event.location || 'No location'}`);
          console.log(`      🕒 ${event.start_time || 'No time'}`);
          console.log(`      💰 ${event.price || 'No price'}`);
        });
      } else {
        console.log(`   ⚠️ No events found or scraper returned empty`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log(''); // Empty line between scrapers
  }
  
  console.log('🏁 Scraper testing completed!');
}

// 带超时的测试运行
async function main() {
  const timeout = 60000; // 60秒超时
  
  try {
    await Promise.race([
      testScrapersOnly(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout after 60 seconds')), timeout)
      )
    ]);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testScrapersOnly };