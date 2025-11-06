#!/usr/bin/env node

/**
 * 测试手动添加活动功能
 * 测试3个scraper网站 + AI提取未知网站
 */

const UniversalScraper = require('./src/utils/universal-scraper');

async function testManualAdd() {
  console.log('🧪 测试手动添加活动功能\n');
  console.log('测试内容:');
  console.log('  1. Eventbrite 活动');
  console.log('  2. Funcheap 活动');
  console.log('  3. SFStation 活动');
  console.log('  4. 未知网站 (AI提取)');
  console.log('\n' + '━'.repeat(70) + '\n');

  const scraper = new UniversalScraper();

  // 测试URL列表
  const testUrls = [
    {
      name: 'Eventbrite - French Holiday Market',
      url: 'https://www.eventbrite.com/e/french-holiday-market-tickets-1902205561039'
    },
    {
      name: 'Funcheap - 示例活动',
      url: 'https://funcheap.com/event/fillmore-jazz-festival-san-francisco-2024-07-06/'
    },
    {
      name: 'SFStation - 示例活动',
      url: 'https://sfstation.com/2024/07/01/fillmore-jazz-festival/'
    }
  ];

  for (const test of testUrls) {
    console.log(`\n📝 测试: ${test.name}`);
    console.log(`URL: ${test.url}`);
    console.log('━'.repeat(70));

    try {
      // 检测来源
      const source = scraper.detectSource(test.url);
      console.log(`🔍 检测到来源: ${source}`);

      // 抓取活动
      const event = await scraper.scrapeEventFromUrl(test.url);

      // 显示结果
      console.log('✅ 抓取成功！');
      console.log(`   标题: ${event.title}`);
      console.log(`   时间: ${event.startTime}`);
      console.log(`   地点: ${event.location}`);
      console.log(`   价格: ${event.price || 'N/A'}`);
      console.log(`   URL: ${event.originalUrl}`);
      console.log(`   手动添加标记: ${event._manually_added}`);
      console.log(`   来源网站: ${event._source_website}`);

    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
    }

    console.log('');
  }

  // 测试AI提取（可选，因为需要实际网站）
  console.log('\n💡 如需测试AI提取功能，请手动运行:');
  console.log('   node test-manual-add.js <any-event-url>');
  console.log('\n示例:');
  console.log('   node test-manual-add.js https://example.com/event');
}

// 如果提供了参数，测试该URL
if (process.argv[2]) {
  const testUrl = process.argv[2];
  console.log(`🧪 测试自定义URL: ${testUrl}\n`);

  const scraper = new UniversalScraper();

  scraper.scrapeEventFromUrl(testUrl)
    .then(event => {
      console.log('\n✅ 成功！');
      console.log(JSON.stringify(event, null, 2));
    })
    .catch(error => {
      console.error('\n❌ 失败:', error.message);
      process.exit(1);
    });
} else {
  // 运行标准测试
  testManualAdd()
    .then(() => {
      console.log('\n✅ 测试完成！');
    })
    .catch(error => {
      console.error('\n❌ 测试失败:', error);
      process.exit(1);
    });
}
