#!/usr/bin/env node
/**
 * 测试短链接标签生成逻辑
 */

const URLShortener = require('./src/utils/url-shortener');

function testTagGeneration() {
  const shortener = new URLShortener();

  console.log('🏷️  测试短链接标签生成逻辑\n');

  // 测试用例
  const testCases = [
    {
      name: '免费活动 - 旧金山',
      event: { title: 'Free SF Music Festival', price: 'Free', location: 'San Francisco, CA' },
      expected: ['free', 'SF']
    },
    {
      name: '付费活动 - San Jose',
      event: { title: 'Tech Conference', price: '$50', location: 'San Jose, CA' },
      expected: ['South bay']
    },
    {
      name: '免费活动 - Palo Alto',
      event: { title: 'Community Event', price: '$0', location: 'Palo Alto, CA' },
      expected: ['free', 'Peninsula']
    },
    {
      name: '付费活动 - Oakland',
      event: { title: 'Art Show', price: '$20', location: 'Oakland, CA' },
      expected: ['East bay']
    },
    {
      name: '免费活动 - Santa Rosa',
      event: { title: 'Wine Tasting', price: 'Free', location: 'Santa Rosa, CA' },
      expected: ['free', 'North bay']
    },
    {
      name: '付费活动 - Mountain View',
      event: { title: 'Food Festival', price: '$15', location: 'Mountain View, CA' },
      expected: ['Peninsula']
    },
    {
      name: '免费活动 - Berkeley',
      event: { title: 'Book Fair', price: 'Free admission', location: 'Berkeley, CA' },
      expected: ['free', 'East bay']
    },
    {
      name: '免费活动 - Santa Clara',
      event: { title: 'Tech Meetup', price: '免费', location: 'Santa Clara, CA' },
      expected: ['free', 'South bay']
    },
    {
      name: '付费活动 - San Mateo',
      event: { title: 'Concert', price: '$30', location: 'San Mateo, CA' },
      expected: ['Peninsula']
    },
    {
      name: '免费活动 - Napa',
      event: { title: 'Farmers Market', price: '$0.00', location: 'Napa, CA' },
      expected: ['free', 'North bay']
    },
    {
      name: '无价格 - Fremont',
      event: { title: 'Community Gathering', location: 'Fremont, CA' },
      expected: ['East bay']
    },
    {
      name: '无地点 - 免费',
      event: { title: 'Online Event', price: 'Free' },
      expected: ['free']
    },
    {
      name: '无价格无特定地点',
      event: { title: 'Random Event', location: 'Bay Area' },
      expected: []
    }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    const tags = shortener.generateTagsForEvent(testCase.event);
    const isMatch = JSON.stringify(tags.sort()) === JSON.stringify(testCase.expected.sort());

    if (isMatch) {
      console.log(`✅ 测试 ${index + 1}: ${testCase.name}`);
      console.log(`   生成标签: [${tags.join(', ')}]`);
      passed++;
    } else {
      console.log(`❌ 测试 ${index + 1}: ${testCase.name}`);
      console.log(`   期望: [${testCase.expected.join(', ')}]`);
      console.log(`   实际: [${tags.join(', ')}]`);
      failed++;
    }
    console.log('');
  });

  console.log('='.repeat(60));
  console.log(`测试结果: ${passed}/${testCases.length} 通过, ${failed}/${testCases.length} 失败`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

testTagGeneration();
