#!/usr/bin/env node

/**
 * Test AI extraction for new sources
 */

const UniversalScraper = require('./src/utils/universal-scraper');

async function testAIExtraction() {
  const scraper = new UniversalScraper();

  const testUrls = [
    {
      name: 'San José Made - SJMADE Fest',
      url: 'https://www.sanjosemade.com/pages/sjmade-fest-2025'
    },
    {
      name: '365 Night Market',
      url: 'https://www.365nightmarket.com/events'
    }
  ];

  console.log('🤖 Testing AI Extraction for New Sources\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const test of testUrls) {
    console.log(`📍 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}\n`);

    try {
      const event = await scraper.scrapeWithAI(test.url);

      console.log('✅ Success! Extracted event:');
      console.log(JSON.stringify(event, null, 2));
      console.log('\n');

    } catch (error) {
      console.error(`❌ Failed: ${error.message}\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// Only run if executed directly (not if required as module)
if (require.main === module) {
  testAIExtraction().catch(console.error);
}

module.exports = { testAIExtraction };
