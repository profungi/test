#!/usr/bin/env node

/**
 * 调试版单数据源抓取
 * 不保存到数据库,只显示抓取结果
 */

const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');
const SFStationScraper = require('./src/scrapers/sfstation-scraper');
const FuncheapWeekendScraper = require('./src/scrapers/funcheap-weekend-scraper');

const SCRAPERS = {
  'eventbrite': EventbriteScraper,
  'sfstation': SFStationScraper,
  'funcheap': FuncheapWeekendScraper
};

async function debugScrapeSingleSource(sourceName) {
  try {
    // 验证数据源
    if (!SCRAPERS[sourceName]) {
      console.error(`❌ 未知的数据源: ${sourceName}`);
      console.error(`可用的数据源: ${Object.keys(SCRAPERS).join(', ')}`);
      process.exit(1);
    }

    console.log(`🕷️  开始调试抓取: ${sourceName}`);
    console.log(`📝 模式: 只抓取,不保存到数据库\n`);

    // 创建scraper实例
    const ScraperClass = SCRAPERS[sourceName];
    const scraper = new ScraperClass();

    // 获取周范围
    const weekRange = scraper.getNextWeekRange();
    console.log(`📅 目标周: ${weekRange.identifier}`);
    console.log(`   开始: ${weekRange.start.toISOString().split('T')[0]}`);
    console.log(`   结束: ${weekRange.end.toISOString().split('T')[0]}\n`);

    // 抓取活动
    console.log(`🔍 正在从 ${scraper.sourceName} 抓取活动...`);
    console.log(`${'='.repeat(60)}\n`);

    const startTime = Date.now();
    const events = await scraper.scrape();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n✅ 抓取完成 (耗时: ${duration}秒)`);
    console.log(`📊 找到 ${events.length} 个活动\n`);

    if (events.length === 0) {
      console.log('❌ 没有找到任何活动');
      console.log('\n可能的原因:');
      console.log('  1. CSS选择器失效 (网站结构变化)');
      console.log('  2. 网络错误或超时');
      console.log('  3. 被反爬限制 (403/429)');
      console.log('  4. 日期过滤太严格 (活动都在范围外)');
      return;
    }

    // 统计分析
    console.log(`📈 统计分析:`);
    console.log(`${'─'.repeat(60)}`);

    // 按价格统计
    const freeCount = events.filter(e =>
      e.price && (e.price.toLowerCase() === 'free' || e.price === 'Free')
    ).length;
    const paidCount = events.filter(e =>
      e.price && e.price !== 'Free' && e.price.toLowerCase() !== 'free'
    ).length;
    const unknownCount = events.length - freeCount - paidCount;

    console.log(`\n💰 价格分布:`);
    console.log(`   免费: ${freeCount} (${(freeCount/events.length*100).toFixed(1)}%)`);
    console.log(`   付费: ${paidCount} (${(paidCount/events.length*100).toFixed(1)}%)`);
    console.log(`   未知: ${unknownCount} (${(unknownCount/events.length*100).toFixed(1)}%)`);

    // 按地点统计
    const locationCounts = {};
    events.forEach(e => {
      if (e.location) {
        // 提取城市名
        const city = e.location.split(',')[0].trim();
        locationCounts[city] = (locationCounts[city] || 0) + 1;
      }
    });

    const topLocations = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log(`\n📍 地点分布 (Top 10):`);
    topLocations.forEach(([location, count]) => {
      const bar = '█'.repeat(Math.ceil(count / events.length * 40));
      console.log(`   ${location.padEnd(30)} ${count.toString().padStart(3)} ${bar}`);
    });

    // 检查关键字段
    const hasTitle = events.filter(e => e.title && e.title.length > 0).length;
    const hasTime = events.filter(e => e.startTime).length;
    const hasLocation = events.filter(e => e.location && e.location.length > 0).length;
    const hasUrl = events.filter(e => e.originalUrl).length;
    const hasDescription = events.filter(e => e.description || e.description_detail).length;

    console.log(`\n✓ 字段完整性:`);
    console.log(`   标题:   ${hasTitle}/${events.length} (${(hasTitle/events.length*100).toFixed(1)}%)`);
    console.log(`   时间:   ${hasTime}/${events.length} (${(hasTime/events.length*100).toFixed(1)}%)`);
    console.log(`   地点:   ${hasLocation}/${events.length} (${(hasLocation/events.length*100).toFixed(1)}%)`);
    console.log(`   URL:    ${hasUrl}/${events.length} (${(hasUrl/events.length*100).toFixed(1)}%)`);
    console.log(`   描述:   ${hasDescription}/${events.length} (${(hasDescription/events.length*100).toFixed(1)}%)`);

    // 显示前10个活动样本
    console.log(`\n📋 活动样本 (前10个):`);
    console.log(`${'─'.repeat(60)}`);

    events.slice(0, 10).forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   ⏰ ${event.startTime || 'No time'}`);
      console.log(`   📍 ${event.location || 'No location'}`);
      console.log(`   💰 ${event.price || 'No price'}`);
      console.log(`   🔗 ${event.originalUrl || 'No URL'}`);
      if (event.description) {
        const desc = event.description.length > 100
          ? event.description.substring(0, 100) + '...'
          : event.description;
        console.log(`   📝 ${desc}`);
      }
    });

    // Eventbrite特定分析
    if (sourceName === 'eventbrite') {
      console.log(`\n\n🎯 Eventbrite 特定分析:`);
      console.log(`${'─'.repeat(60)}`);

      const hasPageCategory = events.filter(e => e.pageCategory).length;
      const hasScrapeSource = events.filter(e => e.scrapeSource).length;
      const hasScrapeCity = events.filter(e => e.scrapeCity).length;

      console.log(`\n🏷️  分类信息:`);
      console.log(`   有pageCategory: ${hasPageCategory}/${events.length}`);
      console.log(`   有scrapeSource:  ${hasScrapeSource}/${events.length}`);
      console.log(`   有scrapeCity:    ${hasScrapeCity}/${events.length}`);

      if (hasPageCategory > 0) {
        const categories = {};
        events.forEach(e => {
          if (e.pageCategory) {
            categories[e.pageCategory] = (categories[e.pageCategory] || 0) + 1;
          }
        });

        console.log(`\n📊 Eventbrite 分类分布:`);
        Object.entries(categories)
          .sort((a, b) => b[1] - a[1])
          .forEach(([cat, count]) => {
            console.log(`   ${cat.padEnd(30)} ${count}`);
          });
      }

      if (hasScrapeSource > 0) {
        const sources = {};
        events.forEach(e => {
          if (e.scrapeSource) {
            sources[e.scrapeSource] = (sources[e.scrapeSource] || 0) + 1;
          }
        });

        console.log(`\n🎯 抓取来源分布:`);
        Object.entries(sources)
          .sort((a, b) => b[1] - a[1])
          .forEach(([source, count]) => {
            console.log(`   ${source.padEnd(30)} ${count}`);
          });
      }

      if (hasScrapeCity > 0) {
        const cities = {};
        events.forEach(e => {
          if (e.scrapeCity) {
            cities[e.scrapeCity] = (cities[e.scrapeCity] || 0) + 1;
          }
        });

        console.log(`\n🏙️  抓取城市分布:`);
        Object.entries(cities)
          .sort((a, b) => b[1] - a[1])
          .forEach(([city, count]) => {
            console.log(`   ${city.padEnd(30)} ${count}`);
          });
      }
    }

    console.log(`\n\n✨ 调试完成！`);
    console.log(`\n💡 下一步:`);
    console.log(`   1. 如果抓取数量正常 → 问题可能在数据库去重或后续流程`);
    console.log(`   2. 如果抓取数量很少 → 检查上面的日志,看哪个环节失败`);
    console.log(`   3. 如果要保存到数据库 → 使用 npm run scrape-${sourceName}`);

  } catch (error) {
    console.error('\n❌ 抓取失败:', error.message);
    console.error('\n堆栈追踪:');
    console.error(error.stack);

    console.log('\n\n💡 可能的问题:');
    console.log('   1. 网络连接问题');
    console.log('   2. CSS选择器失效 (网站结构变化)');
    console.log('   3. 超时 (尝试增加 timeout 配置)');
    console.log('   4. 依赖包问题 (运行 npm install)');

    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🔍 调试版单数据源抓取

用法:
  node scrape-single-source-debug.js <source>

可用数据源:
  - eventbrite
  - funcheap
  - sfstation

特点:
  ✅ 只抓取,不保存到数据库
  ✅ 显示详细统计和样本
  ✅ 适合调试和诊断问题
  ✅ 不会污染数据库

示例:
  node scrape-single-source-debug.js eventbrite
  node scrape-single-source-debug.js funcheap
  node scrape-single-source-debug.js sfstation
`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const sourceName = args[0].toLowerCase();
  await debugScrapeSingleSource(sourceName);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = debugScrapeSingleSource;
