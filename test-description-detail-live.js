#!/usr/bin/env node

/**
 * 实时测试 description_detail 功能
 * 测试步骤：
 * 1. 运行 Funcheap 爬虫抓取 1 个事件
 * 2. 检查事件对象是否包含 description_detail
 * 3. 验证 description_detail 是否从详情页获取
 */

const FuncheapWeekendScraper = require('./src/scrapers/funcheap-weekend-scraper');

async function testDescriptionDetail() {
  console.log('🧪 Testing description_detail Functionality\n');
  console.log('='.repeat(70));
  console.log('');

  const scraper = new FuncheapWeekendScraper();

  try {
    console.log('📅 Getting week range...');
    const weekRange = scraper.getNextWeekRange();
    console.log(`   Week: ${weekRange.identifier}\n`);

    console.log('🕷️  Running Funcheap scraper...');
    console.log('   (This may take a minute as we fetch detail pages)\n');

    const events = await scraper.scrapeEvents(weekRange);

    if (events.length === 0) {
      console.log('❌ No events found. Cannot test description_detail.');
      return;
    }

    console.log(`\n✅ Scraped ${events.length} events\n`);
    console.log('='.repeat(70));
    console.log('\n📊 Testing description_detail field:\n');

    // 统计
    let hasFieldCount = 0;
    let hasValueCount = 0;
    let missingFieldCount = 0;

    // 检查前 5 个事件
    const eventsToCheck = Math.min(5, events.length);

    for (let i = 0; i < eventsToCheck; i++) {
      const event = events[i];

      console.log(`${i + 1}. ${event.title}`);
      console.log(`   URL: ${event.originalUrl}`);

      // 检查字段存在性
      if (event.hasOwnProperty('description_detail')) {
        hasFieldCount++;
        console.log(`   ✅ Has description_detail field`);

        // 检查值
        if (event.description_detail && event.description_detail.trim().length > 0) {
          hasValueCount++;
          const preview = event.description_detail.substring(0, 100);
          console.log(`   ✅ Has description_detail VALUE (${event.description_detail.length} chars)`);
          console.log(`      Preview: ${preview}${event.description_detail.length > 100 ? '...' : ''}`);
        } else {
          console.log(`   ⚠️  description_detail is empty or null`);
        }
      } else {
        missingFieldCount++;
        console.log(`   ❌ Missing description_detail field`);
      }

      // 也显示基本描述以便对比
      if (event.description) {
        const descPreview = event.description.substring(0, 80);
        console.log(`   📝 Basic description: ${descPreview}...`);
      }

      console.log('');
    }

    // 总结报告
    console.log('='.repeat(70));
    console.log('\n📈 Test Summary:\n');
    console.log(`Total events tested: ${eventsToCheck}`);
    console.log(`✅ Has description_detail field: ${hasFieldCount}/${eventsToCheck}`);
    console.log(`✅ Has non-empty description_detail: ${hasValueCount}/${eventsToCheck}`);
    console.log(`❌ Missing description_detail field: ${missingFieldCount}/${eventsToCheck}`);

    const successRate = (hasValueCount / eventsToCheck * 100).toFixed(1);
    console.log(`\n📊 Success Rate: ${successRate}%`);

    if (hasValueCount === eventsToCheck) {
      console.log('\n🎉 SUCCESS: All events have description_detail with values!');
    } else if (hasFieldCount === eventsToCheck && hasValueCount > 0) {
      console.log('\n⚠️  PARTIAL SUCCESS: All events have the field, but some are empty');
      console.log('   This may be normal if detail pages failed to load or have no content.');
    } else {
      console.log('\n❌ FAILURE: Some events are missing description_detail field');
      console.log('   Please check the scraper implementation.');
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n💡 Next Steps:');
    console.log('   1. If test passed: Run full scraper with "node src/scrape-events.js"');
    console.log('   2. Check database after scraping with "node verify-description-detail.js"');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testDescriptionDetail();
