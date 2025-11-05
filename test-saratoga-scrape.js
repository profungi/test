#!/usr/bin/env node

/**
 * 测试 Saratoga 的活动抓取
 * 用于调试为什么特定活动没有被抓到
 */

const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');
const { addWeeks, startOfWeek, endOfWeek, format } = require('date-fns');

async function testSaratogaScrape() {
  console.log('🧪 测试 Saratoga 活动抓取\n');
  console.log('目标活动: French Holiday Market');
  console.log('URL: https://www.eventbrite.com/e/french-holiday-market-tickets-1902205561039\n');

  const scraper = new EventbriteScraper();

  // 获取下周的时间范围
  const today = new Date();
  const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 }); // 下周一
  const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 }); // 下周日

  const weekRange = {
    start: nextWeekStart,
    end: nextWeekEnd,
    identifier: `${format(nextWeekStart, 'yyyy-MM-dd')}_to_${format(nextWeekEnd, 'yyyy-MM-dd')}`,
    readable: `${format(nextWeekStart, 'MM/dd')} - ${format(nextWeekEnd, 'MM/dd')}`
  };

  console.log('📅 时间范围:');
  console.log(`   下周: ${weekRange.readable}`);
  console.log(`   标识: ${weekRange.identifier}\n`);

  try {
    // 测试抓取 Saratoga 页面
    const saratogaUrl = 'https://www.eventbrite.com/d/ca--saratoga/events/?start_date_keyword=next_week';
    console.log('🕷️  抓取 Saratoga 页面...');
    console.log(`   URL: ${saratogaUrl}\n`);

    const seenUrls = new Set();

    // 增加maxEvents到20，确保能抓到更多活动
    const events = await scraper.scrapeEventsFromUrl(saratogaUrl, weekRange, seenUrls, 20);

    console.log(`\n✅ 找到 ${events.length} 个活动:\n`);

    if (events.length === 0) {
      console.log('❌ 没有找到任何活动！\n');
      console.log('可能的原因:');
      console.log('  1. 活动不在"下周"时间范围内');
      console.log('  2. Eventbrite 页面结构变化');
      console.log('  3. 活动被地理位置过滤掉了');
      console.log('  4. 网络问题或 Eventbrite 限流\n');
      return;
    }

    // 显示所有找到的活动
    events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   地点: ${event.location}`);
      console.log(`   时间: ${event.startTime}`);
      console.log(`   URL: ${event.originalUrl}`);

      // 检查是否是目标活动
      if (event.originalUrl && event.originalUrl.includes('1902205561039')) {
        console.log('   ✅ 这是目标活动！');
      }
      console.log('');
    });

    // 检查目标活动
    const targetEvent = events.find(e =>
      e.originalUrl && e.originalUrl.includes('1902205561039')
    );

    if (targetEvent) {
      console.log('🎉 成功找到 French Holiday Market！\n');
      console.log('活动详情:');
      console.log(JSON.stringify(targetEvent, null, 2));
    } else {
      console.log('⚠️  没有找到 French Holiday Market\n');
      console.log('已找到的活动:');
      events.forEach(e => console.log(`  - ${e.title}`));
    }

  } catch (error) {
    console.error('❌ 抓取失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testSaratogaScrape().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
