#!/usr/bin/env node

/**
 * 综合测试所有爬虫 - 验证修复效果
 * 测试重点：
 * 1. Eventbrite: 时间是否正确（不应该是19:00:00.000Z，应该反映实际的本地时间）
 * 2. DoTheBay: 是否进入详情页，获取完整地址、准确时间和价格
 * 3. SFStation: 是否进入详情页（sfstation.com链接），获取完整标题、地址、时间和价格
 */

const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');
const DoTheBayScraper = require('./src/scrapers/dothebay-scraper');
const SFStationScraper = require('./src/scrapers/sfstation-scraper');

async function testAllScrapers() {
  console.log('🧪 Testing all scrapers with fixes...\n');
  console.log('='.repeat(80));

  const scrapers = [
    { name: 'Eventbrite', instance: new EventbriteScraper() },
    { name: 'DoTheBay', instance: new DoTheBayScraper() },
    { name: 'SFStation', instance: new SFStationScraper() }
  ];

  const results = {};

  for (const { name, instance } of scrapers) {
    console.log(`\n📍 Testing ${name}...`);
    console.log('-'.repeat(80));

    try {
      const weekRange = instance.getNextWeekRange();
      console.log(`   Target week: ${weekRange.identifier}`);

      const events = await instance.scrapeEvents(weekRange);

      console.log(`\n   ✅ Scraped ${events.length} events`);

      // Quality analysis
      const stats = {
        total: events.length,
        withFullAddress: 0,
        withDefaultLocation: 0,
        withPrice: 0,
        withFree: 0,
        withValidTime: 0,
        timeErrors: 0
      };

      events.forEach(event => {
        // Check location quality
        if (event.location && (
          event.location.match(/\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd)/i) ||
          event.location.includes(',')
        )) {
          stats.withFullAddress++;
        }

        if (event.location === 'San Francisco Bay Area' ||
            event.location === 'San Francisco') {
          stats.withDefaultLocation++;
        }

        // Check price
        if (event.price) {
          stats.withPrice++;
          if (event.price.toLowerCase() === 'free') {
            stats.withFree++;
          }
        }

        // Check time validity
        try {
          const date = new Date(event.startTime);
          if (!isNaN(date.getTime())) {
            stats.withValidTime++;
          } else {
            stats.timeErrors++;
          }
        } catch (e) {
          stats.timeErrors++;
        }
      });

      // Display statistics
      console.log(`\n   📊 Quality Statistics:`);
      console.log(`      Full addresses: ${stats.withFullAddress}/${stats.total} (${(stats.withFullAddress/stats.total*100).toFixed(1)}%)`);
      console.log(`      Default locations: ${stats.withDefaultLocation}/${stats.total} (${(stats.withDefaultLocation/stats.total*100).toFixed(1)}%)`);
      console.log(`      With price info: ${stats.withPrice}/${stats.total} (${(stats.withPrice/stats.total*100).toFixed(1)}%)`);
      console.log(`      Free events: ${stats.withFree}/${stats.total}`);
      console.log(`      Valid times: ${stats.withValidTime}/${stats.total} (${(stats.withValidTime/stats.total*100).toFixed(1)}%)`);
      console.log(`      Time errors: ${stats.timeErrors}/${stats.total}`);

      // Sample events
      if (events.length > 0) {
        console.log(`\n   📝 Sample Events (first 3):`);
        events.slice(0, 3).forEach((event, i) => {
          console.log(`\n      Event ${i + 1}:`);
          console.log(`         Title: ${event.title.substring(0, 60)}${event.title.length > 60 ? '...' : ''}`);
          console.log(`         Time: ${event.startTime}`);
          console.log(`         Location: ${event.location}`);
          console.log(`         Price: ${event.price || 'N/A'}`);
        });
      }

      results[name] = { success: true, stats, events: events.slice(0, 3) };

    } catch (error) {
      console.error(`   ❌ ${name} failed:`, error.message);
      results[name] = { success: false, error: error.message };
    } finally {
      // Close browser
      await instance.closeBrowser();
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 SUMMARY\n');

  for (const [name, result] of Object.entries(results)) {
    if (result.success) {
      const { stats } = result;
      console.log(`${name}:`);
      console.log(`   ✅ ${stats.total} events scraped`);
      console.log(`   📍 ${stats.withFullAddress}/${stats.total} with full addresses`);
      console.log(`   💰 ${stats.withPrice}/${stats.total} with price info (${stats.withFree} free)`);
      console.log(`   ⏰ ${stats.withValidTime}/${stats.total} with valid times (${stats.timeErrors} errors)`);
      console.log('');
    } else {
      console.log(`${name}:`);
      console.log(`   ❌ Failed: ${result.error}`);
      console.log('');
    }
  }

  console.log('✅ Test completed\n');
}

testAllScrapers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
