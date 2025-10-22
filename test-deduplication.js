#!/usr/bin/env node

/**
 * 测试去重逻辑功能
 */

const EventScrapeOrchestrator = require('./src/scrape-events');

// 创建测试实例
const orchestrator = new EventScrapeOrchestrator();

// 测试数据
const testEvents = [
  {
    title: 'Test Event 1',
    originalUrl: 'https://example.com/event1',
    startTime: '2024-10-20T18:00:00',
    location: 'San Francisco, CA'
  },
  {
    title: 'Test Event 1',  // 相同URL
    originalUrl: 'https://example.com/event1',
    startTime: '2024-10-20T18:30:00',  // 时间略不同
    location: 'San Francisco, CA'
  },
  {
    title: 'Test Event 2',  // 测试内容去重：相同标题+时间+地点
    // 无URL，使用内容特征
    startTime: '2024-10-20T19:00:00',
    location: 'Oakland, CA'
  },
  {
    title: 'Test Event 2',  // 相同标题+时间+地点
    // 无URL，应该和事件3去重
    startTime: '2024-10-20T19:15:00',  // 在同一小时内
    location: 'Oakland, CA'
  },
  {
    title: 'Test Event 3',
    originalUrl: 'https://example.com/event3',
    startTime: '2024-10-20T20:00:00',
    location: 'Berkeley, CA'
  }
];

console.log('🧪 测试去重逻辑\n');
console.log('='.repeat(60));

console.log(`\n📥 输入: ${testEvents.length} 个事件`);

// 测试生成唯一键
console.log('\n🔑 测试唯一键生成:');
testEvents.forEach((event, i) => {
  const key = orchestrator.generateEventKey(event);
  console.log(`   事件 ${i + 1}: ${key}`);
});

// 测试时间标准化
console.log('\n🕒 测试时间标准化:');
const timeTests = [
  '2024-10-20T18:00:00',
  '2024-10-20T18:45:30',
  '2024-10-20T19:00:00',
  ''
];
timeTests.forEach(time => {
  const normalized = orchestrator.normalizeTime(time);
  console.log(`   ${time} → ${normalized}`);
});

// 测试地点标准化
console.log('\n📍 测试地点标准化:');
const locationTests = [
  'San Francisco, CA',
  'San Francisco',
  'Oakland, CA',
  ''
];
locationTests.forEach(location => {
  const normalized = orchestrator.normalizeLocation(location);
  console.log(`   "${location}" → "${normalized}"`);
});

// 手动模拟去重
console.log('\n🔄 模拟去重过程:');
const uniqueMap = new Map();
let duplicates = 0;

testEvents.forEach((event, i) => {
  const key = orchestrator.generateEventKey(event);

  if (!uniqueMap.has(key)) {
    uniqueMap.set(key, event);
    console.log(`   ✅ 事件 ${i + 1}: 保留 - ${event.title}`);
  } else {
    duplicates++;
    console.log(`   📝 事件 ${i + 1}: 去重 - ${event.title}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`📊 去重结果:`);
console.log(`   原始: ${testEvents.length} 个事件`);
console.log(`   去重后: ${uniqueMap.size} 个事件`);
console.log(`   去除: ${duplicates} 个重复`);

// 验证结果
const expectedUnique = 3; // 应该剩下3个唯一事件
if (uniqueMap.size === expectedUnique) {
  console.log(`\n🎉 测试通过！去重逻辑正确`);
  process.exit(0);
} else {
  console.log(`\n❌ 测试失败！预期 ${expectedUnique} 个唯一事件，实际 ${uniqueMap.size} 个`);
  process.exit(1);
}
