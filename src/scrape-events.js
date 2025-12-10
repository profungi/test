#!/usr/bin/env node

/**
 * Bay Area Events Scraper - 主要抓取脚本
 * 执行活动抓取、AI分类和生成人工审核文件
 */

// 加载环境变量（如果有 .env 文件）
require('dotenv').config();

// 根据环境变量选择数据库: Turso (生产) 或 SQLite (本地测试)
const EventDatabase = process.env.USE_TURSO
  ? require('./utils/turso-database')
  : require('./utils/database');

const AIEventClassifier = require('./utils/ai-classifier');
const ManualReviewManager = require('./utils/manual-review');
const Translator = require('./utils/translator');

// 导入所有爬虫
const EventbriteScraper = require('./scrapers/eventbrite-scraper');
const SFStationScraper = require('./scrapers/sfstation-scraper');
const FuncheapWeekendScraper = require('./scrapers/funcheap-weekend-scraper');

const config = require('./config');

class EventScrapeOrchestrator {
  constructor(options = {}) {
    this.database = new EventDatabase();
    this.aiClassifier = new AIEventClassifier();
    this.reviewManager = new ManualReviewManager();

    // 初始化翻译器（默认使用 auto 模式：Gemini → OpenAI → Mistral → Google）
    const translatorProvider = process.env.TRANSLATOR_PROVIDER || 'auto';
    this.translator = new Translator(translatorProvider);

    this.scrapers = [
      new EventbriteScraper(),
      new SFStationScraper(),
      new FuncheapWeekendScraper()
    ];

    // 设置抓取哪一周: 'current' 或 'next' (默认)
    this.targetWeek = options.week || 'next';
  }

  async run() {
    const weekText = this.targetWeek === 'current' ? '本周' : '下周';
    const dbType = process.env.USE_TURSO ? 'Turso 云数据库' : '本地 SQLite';
    console.log(`🚀 开始抓取湾区${weekText}活动...`);
    console.log(`💾 数据库: ${dbType}\n`);

    try {
      // 1. 连接数据库
      await this.database.connect();
      
      // 2. 并行抓取所有数据源
      const allEvents = await this.scrapeAllSources();

      if (allEvents.length === 0) {
        console.log('❌ 没有找到任何活动');
        return;
      }

      // 3. 翻译活动标题（在去重之前，确保 title_zh 在保存到数据库时已存在）
      console.log('\n🌐 开始翻译活动标题...');
      const translatedEvents = await this.translator.translateEvents(
        allEvents,
        10,  // 每批翻译 10 个
        1000 // 每批间隔 1 秒
      );

      // 4. 去重和数据清理（此时每个 event 已经有 title_zh 字段）
      const uniqueEvents = await this.deduplicateEvents(translatedEvents);
      console.log(`🔍 去重后剩余 ${uniqueEvents.length} 个活动`);

      // 5. AI分类和优先级排序
      const classifiedEvents = await this.aiClassifier.classifyEvents(uniqueEvents);

      // 6. 选择最佳候选活动
      const topCandidates = this.aiClassifier.selectTopCandidates(
        classifiedEvents,
        config.scraping.totalCandidatesForReview
      );

      // 7. 生成分类报告
      const classificationReport = this.aiClassifier.generateClassificationReport(classifiedEvents);
      console.log('\n📊 AI分类报告:', classificationReport);

      // 8. 生成人工审核文件
      const weekRange = this.targetWeek === 'current'
        ? this.scrapers[0].getCurrentWeekRange()
        : this.scrapers[0].getNextWeekRange();
      const reviewResult = await this.reviewManager.generateReviewFile(
        topCandidates, 
        weekRange,
        {
          total_scraped: allEvents.length,
          after_deduplication: uniqueEvents.length,
          after_classification: classifiedEvents.length,
          classification_report: classificationReport
        }
      );
      
      console.log('\n✨ 抓取完成！');
      console.log(`📝 请审核文件: ${reviewResult.filepath}`);
      console.log(`⏭️  下一步运行: npm run generate-post "${reviewResult.filepath}"`);
      
    } catch (error) {
      console.error('❌ 抓取过程中发生错误:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await this.database.close();
    }
  }

  // 并行抓取所有数据源（使用 Promise.allSettled 确保所有爬虫都有机会完成）
  async scrapeAllSources() {
    console.log('🕷️  开始并行抓取数据源...\n');

    const scrapePromises = this.scrapers.map(async (scraper) => {
      try {
        console.log(`开始抓取: ${scraper.sourceName}`);
        const events = await scraper.scrape(this.targetWeek);

        // 记录抓取日志
        await this.database.logScrapingResult(
          scraper.sourceName,
          events.length,
          true
        );

        console.log(`✅ ${scraper.sourceName}: ${events.length} 个活动`);
        return { success: true, events, source: scraper.sourceName };

      } catch (error) {
        console.error(`❌ ${scraper.sourceName} 抓取失败:`, error.message);

        // 记录错误日志
        await this.database.logScrapingResult(
          scraper.sourceName,
          0,
          false,
          error.message
        );

        return { success: false, events: [], source: scraper.sourceName, error: error.message };
      }
    });

    // 使用 allSettled 确保即使某些爬虫失败，其他的也能继续
    const results = await Promise.allSettled(scrapePromises);

    // 处理结果
    const allEvents = [];
    const sourceStats = {};

    results.forEach((result, index) => {
      const scraperName = this.scrapers[index].sourceName;

      if (result.status === 'fulfilled') {
        const data = result.value;
        allEvents.push(...data.events);
        sourceStats[scraperName] = {
          count: data.events.length,
          success: data.success,
          error: data.error || null
        };
      } else {
        // Promise 本身被拒绝（极少见情况）
        console.error(`⚠️  ${scraperName} Promise rejected:`, result.reason);
        sourceStats[scraperName] = {
          count: 0,
          success: false,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });

    // 生成详细汇总报告
    console.log(`\n📈 抓取汇总报告:`);
    console.log(`   总计: ${allEvents.length} 个活动\n`);

    Object.entries(sourceStats).forEach(([source, stats]) => {
      const statusIcon = stats.success ? '✅' : '❌';
      console.log(`   ${statusIcon} ${source}: ${stats.count} 个活动`);
      if (!stats.success && stats.error) {
        console.log(`      错误: ${stats.error}`);
      }
    });

    const successCount = Object.values(sourceStats).filter(s => s.success).length;
    const totalScrapers = this.scrapers.length;

    console.log(`\n   成功率: ${successCount}/${totalScrapers} (${Math.round(successCount / totalScrapers * 100)}%)\n`);

    return allEvents;
  }

  // 去重处理（优化：统一key生成 + 数据库去重）
  async deduplicateEvents(events) {
    console.log('🔄 开始去重处理...');

    // 第一步：内存快速去重
    const uniqueMap = new Map();

    for (const event of events) {
      const key = this.generateEventKey(event);

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, event);
      } else {
        console.log(`  📝 去重: ${event.title}`);
      }
    }

    const memoryDedupedEvents = Array.from(uniqueMap.values());
    console.log(`  ✅ 内存去重: ${events.length} → ${memoryDedupedEvents.length}`);

    // 第二步：数据库历史去重
    const uniqueEvents = await this.filterByDatabase(memoryDedupedEvents);

    console.log(`\n📊 去重统计:`);
    console.log(`   原始活动: ${events.length}`);
    console.log(`   内存去重后: ${memoryDedupedEvents.length} (-${events.length - memoryDedupedEvents.length})`);
    console.log(`   最终唯一活动: ${uniqueEvents.length} (-${memoryDedupedEvents.length - uniqueEvents.length})`);

    return uniqueEvents;
  }

  // 生成活动唯一键
  generateEventKey(event) {
    // URL优先（URL相同必定是同一个活动）
    const url = event.originalUrl || event.url;
    if (url) return `url:${url}`;

    // 否则使用内容特征
    const title = (event.title || '').toLowerCase().trim();
    const time = this.normalizeTime(event.startTime);
    const location = this.normalizeLocation(event.location);

    return `content:${title}|${time}|${location}`;
  }

  // 时间标准化（只保留到小时）
  normalizeTime(timeStr) {
    if (!timeStr) return '';

    try {
      // 提取 YYYY-MM-DDTHH 部分
      const match = timeStr.match(/^(\d{4}-\d{2}-\d{2}T\d{2})/);
      return match ? match[1] : timeStr.substring(0, 13);
    } catch (e) {
      return timeStr;
    }
  }

  // 地点标准化（统一小写，去除标点和空格）
  normalizeLocation(location) {
    if (!location) return '';
    return location.toLowerCase().replace(/[,.\s]+/g, '');
  }

  // 数据库去重逻辑
  async filterByDatabase(events) {
    const uniqueEvents = [];
    const weekRange = this.targetWeek === 'current'
      ? this.scrapers[0].getCurrentWeekRange()
      : this.scrapers[0].getNextWeekRange();

    for (const event of events) {
      event.weekIdentifier = weekRange.identifier;

      try {
        const result = await this.database.saveEvent(event);
        if (result.saved) {
          uniqueEvents.push(event);
        } else {
          console.log(`  📝 数据库去重: ${event.title}`);
        }
      } catch (error) {
        console.warn(`保存失败: ${event.title} - ${error.message}`);
      }
    }

    console.log(`  ✅ 数据库去重: ${events.length} → ${uniqueEvents.length}`);
    return uniqueEvents;
  }

  // 显示帮助信息
  static showHelp() {
    console.log(`
🎯 Bay Area Events Scraper

用法:
  npm run scrape                           # 抓取下周活动并生成审核文件
  npm run scrape-current-week              # 抓取本周活动
  npm run scrape -- --week current         # 抓取本周活动
  npm run scrape -- --ai-provider gemini   # 使用指定的AI提供商
  USE_TURSO=1 npm run scrape               # 直接写入 Turso 数据库
  npm run scrape -- --help                 # 显示帮助信息

参数:
  --week <current|next>     指定抓取本周或下周的活动 (默认: next)
  --ai-provider <provider>  指定AI提供商 (openai, gemini, claude)
                           默认使用环境变量 AI_PROVIDER 或 openai

环境变量:
  USE_TURSO=1              直接写入 Turso 云数据库 (推荐用于生产)
                           默认使用本地 SQLite (用于开发测试)

功能:
1. 并行抓取 Eventbrite, SF Station, Funcheap 的活动信息
2. AI分类和优先级排序 (market > food/music > free > other)
3. 智能去重 (标题相似度 + 时间 + 地点)
4. 生成 JSON 格式的审核文件供人工选择

输出文件位置: ${config.output.directory}/

下一步: 人工审核后运行 npm run generate-post [审核文件路径]
`);
  }
}

// 处理命令行参数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    EventScrapeOrchestrator.showHelp();
    return;
  }

  // 处理周选择
  let targetWeek = 'next'; // 默认下周
  const weekIndex = args.indexOf('--week');
  if (weekIndex !== -1 && args[weekIndex + 1]) {
    const week = args[weekIndex + 1];
    if (['current', 'next'].includes(week)) {
      targetWeek = week;
      console.log(`📅 Target week: ${week === 'current' ? '本周' : '下周'}`);
    } else {
      console.error(`❌ Invalid week option: ${week}`);
      console.error('Valid options: current, next');
      process.exit(1);
    }
  }

  // 处理AI提供商选择
  const aiProviderIndex = args.indexOf('--ai-provider');
  if (aiProviderIndex !== -1 && args[aiProviderIndex + 1]) {
    const provider = args[aiProviderIndex + 1];
    if (['openai', 'gemini', 'claude'].includes(provider)) {
      process.env.AI_PROVIDER = provider;
      console.log(`🤖 Using AI provider: ${provider}`);
    } else {
      console.error(`❌ Invalid AI provider: ${provider}`);
      console.error('Valid options: openai, gemini, claude');
      process.exit(1);
    }
  }

  const orchestrator = new EventScrapeOrchestrator({ week: targetWeek });
  await orchestrator.run();
}

// 只在直接运行时执行
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = EventScrapeOrchestrator;