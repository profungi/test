#!/usr/bin/env node

/**
 * Bay Area Events Scraper - Main Entry Point
 * 湾区活动抓取器主程序
 */

const EventScrapeOrchestrator = require('./scrape-events');
const PostGenerationOrchestrator = require('./generate-post');

function showMainHelp() {
  console.log(`
🎯 Bay Area Events Scraper for Xiaohongshu

这是一个自动抓取湾区活动并生成小红书发布内容的工具。

主要功能:
1. 📡 抓取 Eventbrite, SF Station, DoTheBay 的活动信息
2. 🤖 AI 智能分类和优先级排序
3. 👁️  生成人工审核文件供选择活动
4. 🔗 生成短链接 (Short.io)
5. 🌐 AI 翻译优化内容
6. 📱 生成小红书发布格式

使用流程:
┌─────────────────────────────────────────┐
│ 1. npm run scrape                       │ 
│    抓取活动 → 生成审核文件                │
├─────────────────────────────────────────┤
│ 2. 手动编辑审核文件                       │
│    选择要发布的活动 (selected: true)      │
├─────────────────────────────────────────┤ 
│ 3. npm run generate-post [文件路径]       │
│    生成短链接 → 翻译 → 小红书格式         │
└─────────────────────────────────────────┘

环境配置:
请先设置环境变量:
- SHORTIO_API_KEY=你的short.io API密钥
- OPENAI_API_KEY=你的OpenAI API密钥

常用命令:
  npm run scrape                    # 抓取活动，生成审核文件
  npm run generate-post <文件路径>   # 生成最终发布内容
  npm run validate                  # 验证环境配置
  
示例:
  npm run scrape
  npm run generate-post "./output/review_2024-09-19_1430.json"

更多帮助:
  npm run scrape -- --help         # 抓取命令帮助
  npm run generate-post -- --help  # 生成命令帮助
`);
}

  async run() {
    try {
      console.log('🚀 Starting Bay Area Events Scraper...');
      console.log(`📅 Target week: ${DateUtils.formatDateRange(this.weekRange.start, this.weekRange.end)}`);
      
      // 初始化数据库
      await this.database.connect();
      
      // 执行抓取
      const allEvents = await this.scrapeAllSources();
      
      // 保存事件到数据库
      const savedEvents = await this.saveEventsToDatabase(allEvents);
      
      // 生成内容
      const formattedContent = await this.generateContent(savedEvents);
      
      // 保存输出
      const outputFile = await this.saveOutput(formattedContent);
      
      // 生成统计报告
      await this.generateReport(savedEvents, formattedContent);
      
      console.log(`✅ Scraping completed! Output saved to: ${outputFile}`);
      
    } catch (error) {
      console.error('❌ Error in main process:', error);
      throw error;
    } finally {
      await this.database.close();
    }
  }

  async scrapeAllSources() {
    console.log('🕷️ Starting to scrape all sources...');
    const allEvents = [];
    
    for (const scraper of this.scrapers) {
      try {
        console.log(`📡 Scraping ${scraper.sourceName}...`);
        const events = await scraper.getEvents();
        
        console.log(`✅ ${scraper.sourceName}: Found ${events.length} valid events`);
        allEvents.push(...events);
        
        // 记录抓取日志
        await this.database.logScrapingResult(
          scraper.sourceName,
          events.length,
          true
        );
        
      } catch (error) {
        console.error(`❌ Error scraping ${scraper.sourceName}:`, error);
        
        // 记录错误日志
        await this.database.logScrapingResult(
          scraper.sourceName,
          0,
          false,
          error.message
        );
      }
      
      // 避免被网站封禁，添加延迟
      await this.delay(2000);
    }
    
    console.log(`📊 Total events scraped: ${allEvents.length}`);
    return allEvents;
  }

  async saveEventsToDatabase(events) {
    console.log('💾 Saving events to database...');
    const savedEvents = [];
    const duplicateEvents = [];
    
    for (const event of events) {
      try {
        const result = await this.database.saveEvent(event);
        
        if (result.saved) {
          savedEvents.push({ ...event, id: result.id });
        } else if (result.reason === 'duplicate') {
          duplicateEvents.push(event);
        }
        
      } catch (error) {
        console.error(`Error saving event ${event.title}:`, error.message);
      }
    }
    
    console.log(`💾 Saved ${savedEvents.length} new events`);
    console.log(`🔄 Skipped ${duplicateEvents.length} duplicate events`);
    
    return savedEvents;
  }

  async generateContent(events) {
    console.log('📝 Generating content...');
    
    if (events.length === 0) {
      console.log('⚠️ No events to format');
      return {
        content: '本周暂无新活动推荐，请关注下周更新！\n\n#湾区生活 #活动推荐',
        events: [],
        weekRange: this.weekRange,
        stats: { totalEvents: 0, keywords: [] }
      };
    }
    
    try {
      const formattedContent = await this.contentFormatter.formatWeeklyPost(
        events,
        this.weekRange
      );
      
      console.log(`📝 Generated content with ${formattedContent.events.length} events`);
      return formattedContent;
      
    } catch (error) {
      console.error('Error generating content:', error);
      
      // 降级：生成简单格式
      return this.generateSimpleContent(events);
    }
  }

  generateSimpleContent(events) {
    console.log('📝 Generating simple fallback content...');
    
    const dateRange = DateUtils.formatDateRange(this.weekRange.start, this.weekRange.end);
    const limitedEvents = events.slice(0, 8);
    
    let content = `🎉 本周湾区精彩活动 ${dateRange}\n\n`;
    
    limitedEvents.forEach((event, index) => {
      const eventDate = new Date(event.startTime);
      const dateStr = eventDate.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
      });
      
      content += `${index + 1}. ${event.title}\n`;
      content += `📅 ${dateStr}\n`;
      content += `📍 ${event.location}\n`;
      content += `💰 ${event.price}\n`;
      content += `🔗 ${event.originalUrl}\n\n`;
    });
    
    content += '#湾区生活 #旧金山 #活动推荐 #周末去哪儿';
    
    return {
      content,
      events: limitedEvents,
      weekRange: this.weekRange,
      stats: { totalEvents: limitedEvents.length, keywords: ['湾区生活', '活动推荐'] }
    };
  }

  async saveOutput(formattedContent) {
    // 确保输出目录存在
    const outputDir = config.output.directory;
    await fs.mkdir(outputDir, { recursive: true });
    
    // 生成文件名
    const dateStr = this.weekRange.start.toISOString().split('T')[0];
    const fileName = config.output.filename.replace('{date}', dateStr);
    const filePath = path.join(outputDir, fileName);
    
    // 保存主要内容
    await fs.writeFile(filePath, formattedContent.content, 'utf-8');
    
    // 保存详细数据（JSON格式）
    const detailsPath = filePath.replace('.txt', '_details.json');
    await fs.writeFile(detailsPath, JSON.stringify(formattedContent, null, 2), 'utf-8');
    
    console.log(`📄 Content saved to: ${filePath}`);
    console.log(`📊 Details saved to: ${detailsPath}`);
    
    return filePath;
  }

  async generateReport(events, formattedContent) {
    const report = {
      timestamp: new Date().toISOString(),
      weekRange: {
        start: this.weekRange.start.toISOString(),
        end: this.weekRange.end.toISOString(),
        identifier: this.weekRange.identifier
      },
      stats: {
        totalScraped: events.length,
        totalFormatted: formattedContent.events.length,
        sourceBreakdown: this.getSourceBreakdown(events),
        typeBreakdown: this.getTypeBreakdown(events)
      },
      contentPreview: formattedContent.content.substring(0, 200) + '...'
    };
    
    // 保存报告
    const reportPath = path.join(
      config.output.directory, 
      `report_${this.weekRange.identifier}.json`
    );
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    
    console.log('\n📊 Scraping Report:');
    console.log(`🔍 Total events scraped: ${report.stats.totalScraped}`);
    console.log(`📝 Events included in post: ${report.stats.totalFormatted}`);
    console.log('📈 Source breakdown:', report.stats.sourceBreakdown);
    console.log('🏷️ Type breakdown:', report.stats.typeBreakdown);
    console.log(`📋 Report saved to: ${reportPath}`);
  }

  getSourceBreakdown(events) {
    const breakdown = {};
    events.forEach(event => {
      breakdown[event.source] = (breakdown[event.source] || 0) + 1;
    });
    return breakdown;
  }

  getTypeBreakdown(events) {
    const breakdown = {};
    events.forEach(event => {
      breakdown[event.eventType] = (breakdown[event.eventType] || 0) + 1;
    });
    return breakdown;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 主执行函数
async function main() {
  try {
    const scraper = new BayAreaEventsScraper();
    await scraper.run();
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，执行主函数
if (require.main === module) {
  main();
}

module.exports = BayAreaEventsScraper;