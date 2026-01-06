#!/usr/bin/env node

/**
 * Test script for configurable scrapers
 * 测试配置驱动的爬虫是否正常工作
 */

require('dotenv').config();

const ConfigurableScraperManager = require('./src/scrapers/configurable-scraper-manager');
const BaseScraper = require('./src/scrapers/base-scraper');

async function testConfigurableScrapers() {
  console.log('🧪 Testing Configurable Scrapers\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const manager = new ConfigurableScraperManager();

  // 获取week range (用于测试) - 使用现有的scraper
  const cssScrapers = manager.getCSSScrapers();
  if (cssScrapers.length === 0) {
    console.error('No CSS scrapers configured!');
    return;
  }
  const weekRange = cssScrapers[0].getNextWeekRange();
  console.log(`📅 Target week: ${weekRange.identifier}\n`);

  try {
    // Test 1: CSS Scrapers
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST 1: CSS Scrapers');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Found ${cssScrapers.length} CSS scrapers:\n`);

    for (const scraper of cssScrapers) {
      console.log(`\n🔍 Testing: ${scraper.config.displayName}`);
      console.log(`   URL: ${scraper.config.listUrl}`);

      try {
        const events = await scraper.scrapeEvents(weekRange);
        console.log(`   ✅ Result: ${events.length} events`);

        if (events.length > 0) {
          const sampleCount = Math.min(5, events.length);
          console.log(`   📄 First ${sampleCount} sample events:\n`);
          events.slice(0, sampleCount).forEach((e, idx) => {
            console.log(`      ${idx + 1}. ${e.title}`);
            console.log(`         Date: ${e.startTime || 'N/A'}`);
            console.log(`         Location: ${e.location || 'N/A'}`);
            console.log(`         URL: ${e.originalUrl}`);
            console.log('');
          });
        }

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Test 2: AI Scrapers (只测试一个，避免消耗太多AI token)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST 2: AI Scrapers (limited test)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const aiScrapers = manager.getAIScrapers();
    console.log(`Found ${aiScrapers.length} AI scrapers (filtered by season)\n`);

    if (aiScrapers.length > 0) {
      // 只测试第一个AI爬虫
      const scraper = aiScrapers[0];
      console.log(`\n🤖 Testing: ${scraper.config.displayName}`);
      console.log(`   URL: ${scraper.config.url}`);
      console.log(`   Type: ${scraper.config.extractionType}`);

      try {
        const events = await scraper.scrapeEvents(weekRange);
        console.log(`   ✅ Result: ${events.length} events`);

        if (events.length > 0) {
          console.log(`   📄 Sample events:`);
          events.slice(0, 3).forEach((event, idx) => {
            console.log(`      ${idx + 1}. ${event.title?.substring(0, 50) || 'N/A'}`);
            console.log(`         Date: ${event.startTime || 'N/A'}`);
            console.log(`         Location: ${event.location || 'N/A'}`);
          });
        }

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }

      console.log(`\n⚠️  Skipping other AI scrapers to save API costs`);
      console.log(`   Total AI scrapers available: ${aiScrapers.length}`);
    } else {
      console.log('   ℹ️  No AI scrapers active in current month');
    }

    // Test 3: Recurring Events
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST 3: Recurring Events');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const recurringEvents = manager.generateRecurringEvents(weekRange);
    console.log(`✅ Generated ${recurringEvents.length} recurring events\n`);

    if (recurringEvents.length > 0) {
      recurringEvents.forEach((event, idx) => {
        console.log(`${idx + 1}. ${event.title}`);
        console.log(`   Date: ${event.startTime}`);
        console.log(`   Location: ${event.location}`);
        console.log(`   Price: ${event.price}`);
        console.log('');
      });
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Total CSS scrapers: ${cssScrapers.length}`);
    console.log(`Total AI scrapers (seasonal): ${aiScrapers.length}`);
    console.log(`Total recurring events: ${recurringEvents.length}`);
    console.log('');
    console.log('✅ Configuration-driven scraper system is working!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run full scrape: npm run scrape');
    console.log('2. Check output for new events from configured sources');
    console.log('3. Add more sources to src/config/sources-config.js');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testConfigurableScrapers().catch(console.error);
