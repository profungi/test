#!/usr/bin/env node

/**
 * 验证脚本：检查所有爬虫是否都返回 description_detail 字段
 */

const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');
const SFStationScraper = require('./src/scrapers/sfstation-scraper');
const FuncheapWeekendScraper = require('./src/scrapers/funcheap-weekend-scraper');

const scrapers = [
  { name: 'Eventbrite', scraper: new EventbriteScraper() },
  { name: 'SF Station', scraper: new SFStationScraper() },
  { name: 'Funcheap', scraper: new FuncheapWeekendScraper() }
];

async function testScrapers() {
  console.log('🧪 Testing description_detail field in all scrapers\n');
  console.log('='.repeat(60));

  const weekRange = scrapers[0].scraper.getNextWeekRange();

  for (const { name, scraper } of scrapers) {
    console.log(`\n📍 Testing ${name}...`);
    console.log('-'.repeat(60));

    try {
      const events = await scraper.scrapeEvents(weekRange);

      if (events.length === 0) {
        console.log(`⚠️  No events found for ${name}`);
        continue;
      }

      console.log(`Found ${events.length} events\n`);

      // Check if all events have description_detail field
      let hasDescriptionDetail = 0;
      let hasValidDescriptionDetail = 0;

      events.forEach((event, idx) => {
        if (event.hasOwnProperty('description_detail')) {
          hasDescriptionDetail++;
          if (event.description_detail && event.description_detail.trim().length > 0) {
            hasValidDescriptionDetail++;
          }
        }

        if (idx < 3) {
          console.log(`Event ${idx + 1}: ${event.title}`);
          console.log(`  - Has description_detail field: ${event.hasOwnProperty('description_detail')}`);
          if (event.description_detail) {
            const desc = event.description_detail.trim();
            console.log(`  - description_detail length: ${desc.length} chars`);
            console.log(`  - description_detail preview: ${desc.substring(0, 100)}${desc.length > 100 ? '...' : ''}`);
          } else {
            console.log(`  - description_detail: ${event.description_detail}`);
          }
          console.log('');
        }
      });

      console.log(`\n✅ Statistics for ${name}:`);
      console.log(`   Total events: ${events.length}`);
      console.log(`   Has description_detail field: ${hasDescriptionDetail}/${events.length}`);
      console.log(`   Has non-empty description_detail: ${hasValidDescriptionDetail}/${events.length}`);

      if (hasDescriptionDetail === events.length) {
        console.log(`   ✅ ALL events have description_detail field`);
      } else {
        console.log(`   ❌ MISSING description_detail field in ${events.length - hasDescriptionDetail} events`);
      }

    } catch (error) {
      console.error(`❌ Error testing ${name}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test completed\n');
}

testScrapers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
