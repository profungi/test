#!/usr/bin/env node

/**
 * 测试地址和描述格式修复
 */

const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');

async function testFormatFixes() {
  console.log('🧪 测试地址和描述格式修复\n');

  const scraper = new EventbriteScraper();

  // 测试1: 地址格式 - 模拟cheerio对象
  console.log('1️⃣ 测试地址格式修复：');

  // 创建模拟的cheerio对象
  const cheerio = require('cheerio');

  // 测试用例1: 原始格式（无逗号）
  const html1 = '<div class="address">Thrive City 1 Warriors Way San Francisco, CA 94158</div>';
  const $1 = cheerio.load(html1);
  const result1 = scraper.extractFullAddress($1);
  console.log('   输入: "Thrive City 1 Warriors Way San Francisco, CA 94158"');
  console.log('   输出:', result1);
  console.log('   预期: "Thrive City 1 Warriors Way, San Francisco, CA 94158"');
  console.log('   ✓', result1 && result1.includes(', San Francisco,') ? '通过' : '❌ 失败');

  // 测试用例2: 另一个地址
  const html2 = '<div class="address">Castro Theatre 429 Castro Street San Francisco, CA 94114</div>';
  const $2 = cheerio.load(html2);
  const result2 = scraper.extractFullAddress($2);
  console.log('\n   输入: "Castro Theatre 429 Castro Street San Francisco, CA 94114"');
  console.log('   输出:', result2);
  console.log('   预期: "Castro Theatre 429 Castro Street, San Francisco, CA 94114"');
  console.log('   ✓', result2 && result2.includes(', San Francisco,') ? '通过' : '❌ 失败');

  // 测试2: Description格式
  console.log('\n2️⃣ 测试描述格式修复（去掉Overview）：');

  // 测试用例1: Overview开头
  const html3 = '<div class="structured-content-rich-text">Overview This is a great event with lots of fun activities for everyone. Join us for an amazing time!</div>';
  const $3 = cheerio.load(html3);
  const result3 = scraper.extractDetailedDescription($3);
  console.log('   输入: "Overview This is a great event..."');
  console.log('   输出:', result3);
  console.log('   预期: 不应包含"Overview"');
  console.log('   ✓', result3 && !result3.startsWith('Overview') && !result3.startsWith('overview') ? '通过' : '❌ 失败');

  // 测试用例2: OVERVIEW（大写）
  const html4 = '<div class="structured-content-rich-text">OVERVIEW This event will feature amazing performances and delicious food. Come and enjoy!</div>';
  const $4 = cheerio.load(html4);
  const result4 = scraper.extractDetailedDescription($4);
  console.log('\n   输入: "OVERVIEW This event will feature..."');
  console.log('   输出:', result4);
  console.log('   预期: 不应包含"OVERVIEW"');
  console.log('   ✓', result4 && !result4.startsWith('Overview') && !result4.startsWith('OVERVIEW') && !result4.startsWith('overview') ? '通过' : '❌ 失败');

  // 测试用例3: 正常描述（不以Overview开头）
  const html5 = '<div class="structured-content-rich-text">Join us for an incredible evening of music and entertainment. This event features local artists and great food.</div>';
  const $5 = cheerio.load(html5);
  const result5 = scraper.extractDetailedDescription($5);
  console.log('\n   输入: "Join us for an incredible evening..."');
  console.log('   输出:', result5);
  console.log('   预期: 保持原样');
  console.log('   ✓', result5 && result5.startsWith('Join us') ? '通过' : '❌ 失败');

  console.log('\n✅ 测试完成！\n');
}

// 运行测试
testFormatFixes().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
