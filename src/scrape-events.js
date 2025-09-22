#!/usr/bin/env node

/**
 * Bay Area Events Scraper - 主要抓取脚本
 * 执行活动抓取、AI分类和生成人工审核文件
 */

const EventDatabase = require('./utils/database');
const AIEventClassifier = require('./utils/ai-classifier');
const ManualReviewManager = require('./utils/manual-review');

// 导入所有爬虫
const EventbriteScraper = require('./scrapers/eventbrite-scraper');
const SFStationScraper = require('./scrapers/sfstation-scraper');
const DoTheBayScraper = require('./scrapers/dothebay-scraper');

const config = require('./config');

class EventScrapeOrchestrator {
  constructor() {
    this.database = new EventDatabase();
    this.aiClassifier = new AIEventClassifier();
    this.reviewManager = new ManualReviewManager();
    
    this.scrapers = [
      new EventbriteScraper(),
      new SFStationScraper(),
      new DoTheBayScraper()
    ];
  }

  async run() {
    console.log('🚀 开始抓取湾区活动...\n');
    
    try {
      // 1. 连接数据库
      await this.database.connect();
      
      // 2. 并行抓取所有数据源
      const allEvents = await this.scrapeAllSources();
      
      if (allEvents.length === 0) {
        console.log('❌ 没有找到任何活动');
        return;
      }
      
      // 3. 去重和数据清理
      const uniqueEvents = await this.deduplicateEvents(allEvents);
      console.log(`🔍 去重后剩余 ${uniqueEvents.length} 个活动`);
      
      // 4. AI分类和优先级排序
      const classifiedEvents = await this.aiClassifier.classifyEvents(uniqueEvents);
      
      // 5. 选择最佳候选活动
      const topCandidates = this.aiClassifier.selectTopCandidates(
        classifiedEvents, 
        config.scraping.totalCandidatesForReview
      );
      
      // 6. 生成分类报告
      const classificationReport = this.aiClassifier.generateClassificationReport(classifiedEvents);
      console.log('\n📊 AI分类报告:', classificationReport);
      
      // 7. 生成人工审核文件
      const weekRange = this.scrapers[0].getNextWeekRange();
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

  // 并行抓取所有数据源
  async scrapeAllSources() {
    console.log('🕷️  开始并行抓取数据源...\n');
    
    const scrapePromises = this.scrapers.map(async (scraper) => {
      try {
        console.log(`开始抓取: ${scraper.sourceName}`);
        const events = await scraper.scrape();
        
        // 记录抓取日志
        await this.database.logScrapingResult(
          scraper.sourceName,
          events.length,
          true
        );
        
        console.log(`✅ ${scraper.sourceName}: ${events.length} 个活动`);
        return events;
        
      } catch (error) {
        console.error(`❌ ${scraper.sourceName} 抓取失败:`, error.message);
        
        // 记录错误日志
        await this.database.logScrapingResult(
          scraper.sourceName,
          0,
          false,
          error.message
        );
        
        return [];
      }
    });
    
    const results = await Promise.all(scrapePromises);
    const allEvents = results.flat();
    
    console.log(`\n📈 抓取汇总: 总共 ${allEvents.length} 个活动`);
    console.log(`   - Eventbrite: ${results[0]?.length || 0}`);
    console.log(`   - SF Station: ${results[1]?.length || 0}`);
    console.log(`   - DoTheBay: ${results[2]?.length || 0}\n`);
    
    return allEvents;
  }

  // 去重处理
  async deduplicateEvents(events) {
    console.log('🔄 开始去重处理...');
    
    const uniqueEvents = [];
    const weekRange = this.scrapers[0].getNextWeekRange();
    
    for (const event of events) {
      // 设置周标识
      event.weekIdentifier = weekRange.identifier;
      
      try {
        const saveResult = await this.database.saveEvent(event);
        if (saveResult.saved) {
          uniqueEvents.push(event);
        }
      } catch (error) {
        console.warn(`保存活动时出错: ${event.title} - ${error.message}`);
      }
    }
    
    return uniqueEvents;
  }

  // 显示帮助信息
  static showHelp() {
    console.log(`
🎯 Bay Area Events Scraper

用法:
  npm run scrape                           # 抓取活动并生成审核文件
  npm run scrape -- --ai-provider gemini  # 使用指定的AI提供商
  npm run scrape -- --help                # 显示帮助信息

参数:
  --ai-provider <provider>  指定AI提供商 (openai, gemini, claude)
                           默认使用环境变量 AI_PROVIDER 或 openai

功能:
1. 并行抓取 Eventbrite, SF Station, DoTheBay 的活动信息
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
  
  const orchestrator = new EventScrapeOrchestrator();
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