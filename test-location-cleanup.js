#!/usr/bin/env node

/**
 * 测试 location 清理功能
 */

const SFStationScraper = require('./src/scrapers/sfstation-scraper.js');
const DoTheBayScraper = require('./src/scrapers/dothebay-scraper.js');
const BaseScraper = require('./src/scrapers/base-scraper.js');

console.log('=' .repeat(80));
console.log('Testing Location Cleanup Functions');
console.log('=' .repeat(80));

// Test cases
const testCases = [
  {
    name: 'SF Station format with URL and time',
    input: 'at The Midway https://www.sfstation.com/the-midway-b38984166 (8:30pm) 900 Marin Street San Francisco, CA',
    expected: 'at The Midway 900 Marin Street San Francisco, CA'
  },
  {
    name: 'Location with time range',
    input: 'The Fillmore (7:00 PM - 11:00 PM) https://example.com 1805 Geary Blvd',
    expected: 'The Fillmore 1805 Geary Blvd'
  },
  {
    name: 'Simple location without URL or time',
    input: 'Golden Gate Park',
    expected: 'Golden Gate Park'
  },
  {
    name: 'Ferry Building with URL and time',
    input: 'Ferry Building https://test.com (3:30pm)',
    expected: 'Ferry Building'
  },
  {
    name: 'Multiple URLs',
    input: 'Venue Name http://url1.com https://url2.com (10:00AM)',
    expected: 'Venue Name'
  }
];

// Test SF Station Scraper
console.log('\n1. Testing SFStationScraper.cleanLocationText()');
console.log('-' .repeat(80));
const sfScraper = new SFStationScraper();

testCases.forEach((test, i) => {
  const result = sfScraper.cleanLocationText(test.input);
  const passed = result === test.expected;

  console.log(`\nTest ${i + 1}: ${test.name}`);
  console.log(`Input:    "${test.input}"`);
  console.log(`Expected: "${test.expected}"`);
  console.log(`Result:   "${result}"`);
  console.log(`Status:   ${passed ? '✅ PASS' : '❌ FAIL'}`);
});

// Test DoTheBay Scraper
console.log('\n\n2. Testing DoTheBayScraper.cleanLocationText()');
console.log('-' .repeat(80));
const doTheBayScraper = new DoTheBayScraper();

testCases.forEach((test, i) => {
  const result = doTheBayScraper.cleanLocationText(test.input);
  const passed = result === test.expected;

  console.log(`\nTest ${i + 1}: ${test.name}`);
  console.log(`Input:    "${test.input}"`);
  console.log(`Expected: "${test.expected}"`);
  console.log(`Result:   "${result}"`);
  console.log(`Status:   ${passed ? '✅ PASS' : '❌ FAIL'}`);
});

// Test Base Scraper
console.log('\n\n3. Testing BaseScraper.cleanLocationText()');
console.log('-' .repeat(80));

// Create a dummy BaseScraper instance
class DummyScraper extends BaseScraper {
  constructor() {
    // Create a minimal sourceConfig to satisfy BaseScraper constructor
    const dummyConfig = {
      name: 'test',
      baseUrl: 'http://test.com',
      eventSelector: '.test'
    };

    // Temporarily add to config
    const config = require('./src/config');
    const originalSources = [...config.eventSources];
    config.eventSources.push(dummyConfig);

    super('test');

    // Restore original config
    config.eventSources = originalSources;
  }
}

const baseScraper = new DummyScraper();

testCases.forEach((test, i) => {
  const result = baseScraper.cleanLocationText(test.input);
  const passed = result === test.expected;

  console.log(`\nTest ${i + 1}: ${test.name}`);
  console.log(`Input:    "${test.input}"`);
  console.log(`Expected: "${test.expected}"`);
  console.log(`Result:   "${result}"`);
  console.log(`Status:   ${passed ? '✅ PASS' : '❌ FAIL'}`);
});

console.log('\n' + '=' .repeat(80));
console.log('Testing Complete');
console.log('=' .repeat(80));
