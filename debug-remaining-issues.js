#!/usr/bin/env node

const DoTheBayScraper = require('./src/scrapers/dothebay-scraper');
const SFStationScraper = require('./src/scrapers/sfstation-scraper');

async function debugRemainingIssues() {
  console.log('🔍 Debugging remaining issues\n');

  // 测试 DoTheBay
  console.log('='.repeat(70));
  console.log('TESTING DOTHEBAY');
  console.log('='.repeat(70));

  const dothebay = new DoTheBayScraper();
  try {
    const weekRange = dothebay.getNextWeekRange();
    console.log(`\nTarget week: ${weekRange.identifier}\n`);

    const events = await dothebay.scrapeEvents(weekRange);
    console.log(`\n✅ DoTheBay found ${events.length} valid events`);

    if (events.length > 0) {
      console.log('\nFirst 3 events:');
      events.slice(0, 3).forEach((e, i) => {
        console.log(`\n${i + 1}. ${e.title}`);
        console.log(`   Time: ${e.startTime}`);
        console.log(`   Location: ${e.location}`);
        console.log(`   Price: ${e.price || 'N/A'}`);
      });
    }
  } catch (error) {
    console.error('❌ DoTheBay error:', error.message);
  } finally {
    await dothebay.closeBrowser();
  }

  // 测试 SFStation
  console.log('\n\n' + '='.repeat(70));
  console.log('TESTING SFSTATION');
  console.log('='.repeat(70));

  const sfstation = new SFStationScraper();
  try {
    const weekRange = sfstation.getNextWeekRange();
    console.log(`\nTarget week: ${weekRange.identifier}\n`);

    const events = await sfstation.scrapeEvents(weekRange);
    console.log(`\n✅ SFStation found ${events.length} valid events`);

    if (events.length > 0) {
      console.log('\nFirst 5 events:');
      events.slice(0, 5).forEach((e, i) => {
        console.log(`\n${i + 1}. ${e.title}`);
        console.log(`   Time: ${e.startTime}`);
        console.log(`   Location: ${e.location}`);
        console.log(`   Price: ${e.price || 'N/A'}`);
      });
    } else {
      console.log('\n⚠️  No events found! This is the problem.');
    }
  } catch (error) {
    console.error('❌ SFStation error:', error.message);
  } finally {
    await sfstation.closeBrowser();
  }

  console.log('\n✅ Debugging completed');
}

debugRemainingIssues();
