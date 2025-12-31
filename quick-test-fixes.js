/**
 * 快速测试脚本 - 验证时间过滤和location清理
 */

const ConfigurableScraper = require('./src/scrapers/configurable-scraper');
const BaseScraper = require('./src/scrapers/base-scraper');

// 创建测试scraper实例
const scraper = new ConfigurableScraper({
  name: 'test-source',
  type: 'css',
  url: 'https://example.com',
  enabled: true
});

// 测试数据
const testEvents = [
  {
    title: "Yo La Tengo @ Luna",
    startTime: "2025-12-28T20:00:00",  // 上周六，应该被过滤
    location: "at Luna, 123 Main St, San Francisco, CA at 8:00 PM",
    originalUrl: "https://example.com/event1"
  },
  {
    title: "New Year's Eve Party",
    startTime: "2025-12-31T22:00:00",  // 下周三，应该保留
    location: "The Chapel, 777 Valencia St, San Francisco",
    originalUrl: "https://example.com/event2"
  },
  {
    title: "Weekend Market",
    startTime: "2026-01-04T10:00:00",  // 下周日（最后一天），应该保留
    location: "at Ferry Building at 10AM https://ferrybuildingmarketplace.com",
    originalUrl: "https://example.com/event3"
  },
  {
    title: "Glow",  // 标题太短
    startTime: "2026-01-01T19:00:00",
    location: "Some Venue",
    originalUrl: "https://example.com/event4"
  },
  {
    title: "Make Your Plans",  // 无效标题（导航元素）
    startTime: "2026-01-02T10:00:00",
    location: "San Francisco",
    originalUrl: "https://example.com/event5"
  },
  {
    title: "November Festival",  // 11月活动，应该被过滤
    startTime: "2025-11-28T14:00:00",
    location: "Discovery Kingdom",
    originalUrl: "https://example.com/event6"
  }
];

console.log('🧪 快速验证测试\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 获取下周范围
const weekRange = scraper.getNextWeekRange();
console.log('📅 目标时间范围:');
console.log(`   ${weekRange.start.toISOString().split('T')[0]} 到 ${weekRange.end.toISOString().split('T')[0]}`);
console.log(`   (${weekRange.identifier})\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📋 测试结果:\n');

let passedCount = 0;
let filteredCount = 0;

testEvents.forEach((event, idx) => {
  console.log(`${idx + 1}. "${event.title}"`);
  console.log(`   原始时间: ${event.startTime}`);
  console.log(`   原始地点: ${event.location}`);

  // 测试 shouldSkipEvent
  const shouldSkip = scraper.shouldSkipEvent(event);
  if (shouldSkip) {
    console.log(`   ❌ 被过滤（内容验证）`);
    filteredCount++;
    console.log('');
    return;
  }

  // 测试时间验证
  const validTime = scraper.isValidEventTime(event.startTime, weekRange);
  if (!validTime) {
    console.log(`   ❌ 被过滤（时间不在范围）`);
    filteredCount++;
    console.log('');
    return;
  }

  // 测试normalizeEvent
  const normalized = scraper.normalizeEvent(event, weekRange);

  console.log(`   ✅ 通过验证`);
  console.log(`   清理后地点: ${normalized.location}`);
  console.log(`   最终时间: ${normalized.startTime}`);
  passedCount++;
  console.log('');
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📊 汇总:');
console.log(`   总活动数: ${testEvents.length}`);
console.log(`   ✅ 通过: ${passedCount}`);
console.log(`   ❌ 过滤: ${filteredCount}`);
console.log('');

// 验证预期结果
const expectedPassed = 2;  // 只有 event2 和 event3 应该通过
if (passedCount === expectedPassed) {
  console.log('✅ 测试通过！修复按预期工作。\n');
  process.exit(0);
} else {
  console.log(`❌ 测试失败！预期 ${expectedPassed} 个通过，实际 ${passedCount} 个。\n`);
  process.exit(1);
}
