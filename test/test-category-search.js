/**
 * 测试类型定向抓取 - 专门测试 Saratoga 的 food-and-drink 分类
 */

const EventbriteScraper = require('../src/scrapers/eventbrite-scraper');
const TimeHandler = require('../src/utils/time-handler');

async function testCategorySearch() {
  console.log('🧪 测试 Saratoga 类型定向抓取\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  const scraper = new EventbriteScraper();

  // 获取下周的时间范围
  const weekRange = TimeHandler.getNextWeekRange();
  console.log('📅 时间范围:');
  console.log(`   下周: ${weekRange.readable}`);
  console.log(`   标识: ${weekRange.identifier}\n`);

  const seenUrls = new Set();

  // 测试三个类型
  const categories = [
    { name: 'food-and-drink', displayName: 'Food & Drink' },
    { name: 'festivals-fairs', displayName: 'Festivals & Fairs' },
    { name: 'holiday', displayName: 'Holiday Events' }
  ];

  for (const category of categories) {
    try {
      console.log(`\n🔍 测试类型: ${category.displayName}`);
      console.log('─────────────────────────────────────────────────────────');

      const categoryUrl = `https://www.eventbrite.com/d/ca--saratoga/${category.name}--events/?start_date_keyword=next_week`;
      console.log(`📍 URL: ${categoryUrl}\n`);

      const events = await scraper.scrapeEventsFromUrl(categoryUrl, weekRange, seenUrls, 10);

      console.log(`\n✅ 找到 ${events.length} 个 ${category.displayName} 活动:\n`);

      if (events.length === 0) {
        console.log('   (没有找到活动)\n');
        continue;
      }

      events.forEach((event, index) => {
        console.log(`${index + 1}. ${event.title}`);
        console.log(`   📍 ${event.location}`);
        console.log(`   📅 ${event.startTime}`);
        console.log(`   💰 ${event.price || 'N/A'}`);
        console.log(`   🔗 ${event.originalUrl}`);

        // 检查是否是 French Holiday Market
        if (event.originalUrl && event.originalUrl.includes('1902205561039')) {
          console.log(`   🎉🎉🎉 找到了！French Holiday Market！`);
        }

        console.log('');
      });

      // 检查是否包含 French Holiday Market
      const targetEvent = events.find(e => e.originalUrl && e.originalUrl.includes('1902205561039'));
      if (targetEvent) {
        console.log('🎯 SUCCESS: French Holiday Market 已找到！');
        console.log(`   类型: ${category.displayName}`);
        console.log(`   标题: ${targetEvent.title}`);
        console.log(`   地点: ${targetEvent.location}`);
      }

    } catch (error) {
      console.error(`❌ 错误: ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('测试完成');
}

// 运行测试
testCategorySearch().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
