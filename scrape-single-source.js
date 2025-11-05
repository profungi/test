#!/usr/bin/env node

/**
 * 单独抓取某个数据源
 * 用于快速补充活动或调试特定scraper
 */

const EventDatabase = require('./src/utils/database');
const AIEventClassifier = require('./src/utils/ai-classifier');
const ManualReviewManager = require('./src/utils/manual-review');

const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');
const SFStationScraper = require('./src/scrapers/sfstation-scraper');
const FuncheapWeekendScraper = require('./src/scrapers/funcheap-weekend-scraper');

const config = require('./src/config');

const SCRAPERS = {
  'eventbrite': EventbriteScraper,
  'sfstation': SFStationScraper,
  'funcheap': FuncheapWeekendScraper
};

async function scrapeSingleSource(sourceName) {
  const database = new EventDatabase();
  const aiClassifier = new AIEventClassifier();
  const reviewManager = new ManualReviewManager();

  try {
    // 验证数据源
    if (!SCRAPERS[sourceName]) {
      console.error(`❌ 未知的数据源: ${sourceName}`);
      console.error(`可用的数据源: ${Object.keys(SCRAPERS).join(', ')}`);
      process.exit(1);
    }

    console.log(`🕷️  开始抓取: ${sourceName}\n`);

    // 连接数据库
    await database.connect();

    // 创建scraper实例
    const ScraperClass = SCRAPERS[sourceName];
    const scraper = new ScraperClass();

    // 抓取活动
    console.log(`🔍 正在从 ${scraper.sourceName} 抓取活动...`);
    const events = await scraper.scrape();

    if (events.length === 0) {
      console.log('❌ 没有找到任何活动');
      return;
    }

    console.log(`✅ 找到 ${events.length} 个活动`);

    // 记录抓取日志
    await database.logScrapingResult(scraper.sourceName, events.length, true);

    // 去重
    console.log('\n🔄 开始去重处理...');
    const weekRange = scraper.getNextWeekRange();
    const uniqueEvents = [];

    for (const event of events) {
      event.weekIdentifier = weekRange.identifier;
      try {
        const result = await database.saveEvent(event);
        if (result.saved) {
          uniqueEvents.push(event);
        }
      } catch (error) {
        console.warn(`保存失败: ${event.title}`);
      }
    }

    console.log(`✅ 去重后剩余 ${uniqueEvents.length} 个活动`);

    if (uniqueEvents.length === 0) {
      console.log('⚠️  所有活动都已存在于数据库中');
      return;
    }

    // AI分类
    console.log('\n🤖 开始AI分类和优先级排序...');
    const classifiedEvents = await aiClassifier.classifyEvents(uniqueEvents);

    // 选择候选
    const topCandidates = aiClassifier.selectTopCandidates(
      classifiedEvents,
      Math.min(50, classifiedEvents.length) // 最多50个
    );

    // 生成报告
    const classificationReport = aiClassifier.generateClassificationReport(classifiedEvents);
    console.log('\n📊 AI分类报告:', classificationReport);

    // 生成审核文件
    const reviewResult = await reviewManager.generateReviewFile(
      topCandidates,
      weekRange,
      {
        source: sourceName,
        total_scraped: events.length,
        after_deduplication: uniqueEvents.length,
        after_classification: classifiedEvents.length,
        classification_report: classificationReport
      }
    );

    console.log('\n✨ 抓取完成！');
    console.log(`📝 审核文件: ${reviewResult.filepath}`);
    console.log(`📊 包含 ${topCandidates.length} 个候选活动`);
    console.log(`\n💡 下一步操作:`);
    console.log(`   1. 打开审核文件标记活动 (selected: true)`);
    console.log(`   2. 运行: npm run generate-post`);
    console.log(`   3. 系统会自动合并本周的所有review文件`);

  } catch (error) {
    console.error('❌ 抓取失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await database.close();
  }
}

function showHelp() {
  console.log(`
🎯 单数据源抓取工具

用法:
  npm run scrape-eventbrite    # 只抓取 Eventbrite
  npm run scrape-funcheap      # 只抓取 Funcheap
  npm run scrape-sfstation     # 只抓取 SF Station

或者:
  node scrape-single-source.js <source>

可用数据源:
  - eventbrite   (推荐，活动质量高)
  - funcheap     (免费活动多)
  - sfstation    (本地活动)

用途:
  • 快速补充某一类活动
  • 调试特定scraper
  • 备选活动不够时快速抓取

示例:
  npm run scrape-eventbrite
  # 生成 review_*.json
  # 标记 selected: true
  npm run generate-post
  # 系统会自动合并所有同周的review
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
  await scrapeSingleSource(sourceName);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = scrapeSingleSource;
