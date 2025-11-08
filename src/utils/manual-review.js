const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');
const config = require('../config');
const CommonHelpers = require('./common-helpers');

class ManualReviewManager {
  constructor() {
    this.outputDir = config.output.directory;
  }

  async ensureOutputDirectory() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log(`Created output directory: ${this.outputDir}`);
    }
  }

  // 生成人工审核文件
  async generateReviewFile(events, weekRange, scrapingReport = {}) {
    await this.ensureOutputDirectory();

    const reviewId = this.generateReviewId();
    const reviewData = {
      review_id: reviewId,
      generated_at: new Date().toISOString(),
      scrape_date: format(new Date(), 'yyyy-MM-dd'),
      target_week: weekRange.identifier,
      target_week_readable: `${format(weekRange.start, 'MM/dd')} - ${format(weekRange.end, 'MM/dd')}`,
      scraping_report: scrapingReport,
      instructions: {
        how_to_review: "将你想要发布的活动的 'selected' 字段改为 true",
        next_step: "保存文件后运行: npm run generate-post [此文件路径]",
        fields_explanation: {
          title: "活动标题",
          time_display: "显示用的时间格式",
          location: "活动地点",  
          price: "票价信息",
          event_type: "AI识别的活动类型",
          priority: "优先级分数 (越高越重要)",
          chinese_relevant: "是否与中文社区相关",
          original_url: "原始活动链接"
        }
      },
      stats: {
        total_candidates: events.length,
        by_type: this.getEventTypeStats(events),
        by_priority: this.getPriorityStats(events),
        chinese_relevant: events.filter(e => e.chineseRelevant).length
      },
      events: events.map((event, index) => this.formatEventForReview(event, index))
    };

    const filename = config.output.reviewFilename.replace('{date}', format(new Date(), 'yyyy-MM-dd_HHmm'));
    const filepath = path.join(this.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(reviewData, null, 2), 'utf8');
    
    console.log(`\n✅ 审核文件已生成: ${filepath}`);
    console.log(`📋 找到 ${events.length} 个候选活动待审核`);
    console.log(`📊 统计信息:`);
    console.log(`   - 高优先级活动: ${events.filter(e => e.priority >= 7).length} 个`);
    console.log(`   - 中文社区相关: ${events.filter(e => e.chineseRelevant).length} 个`);
    console.log(`   - 免费活动: ${events.filter(e => e.eventType === 'free' || (e.price && e.price.toLowerCase().includes('free'))).length} 个`);
    
    console.log(`\n📝 下一步操作:`);
    console.log(`1. 打开文件: ${filepath}`);
    console.log(`2. 将想要发布的活动的 'selected' 改为 true`);
    console.log(`3. 保存文件后运行: npm run generate-post "${filepath}"`);

    return {
      filepath,
      reviewId,
      totalCandidates: events.length
    };
  }

  generateReviewId() {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const randomSuffix = Math.random().toString(36).substring(2, 5);
    return `review_${timestamp}_${randomSuffix}`;
  }

  formatEventForReview(event, index) {
    return {
      id: index + 1,
      selected: false, // 用户需要手动改为 true
      
      // 基本信息
      title: event.title,
      time_display: this.formatEventTime(event),
      location: this.cleanLocationForDisplay(event.location),
      price: event.price || 'Free',
      
      // 分类信息
      event_type: event.eventType,
      priority: event.priority,
      chinese_relevant: event.chineseRelevant || false,
      
      // 链接信息
      original_url: event.originalUrl,
      
      // AI 分析信息 (仅供参考)
      ai_info: {
        confidence: event.aiConfidence || 0,
        reasoning: event.aiReasoning || ''
      },
      
      // 原始描述 (供参考)
      description_preview: event.description ?
        event.description.substring(0, 100) + (event.description.length > 100 ? '...' : '') :
        null,

      // 详细描述 (从detail页提取的完整描述)
      description_detail: event.description_detail || null,
      
      // 源信息
      source: event.source,
      scraped_at: event.scraped_at
    };
  }

  formatEventTime(event) {
    try {
      const startDate = new Date(event.startTime);
      const dayOfWeek = format(startDate, 'EEEE'); // Monday, Tuesday, etc.
      const date = format(startDate, 'MM/dd');
      const time = format(startDate, 'h:mm a');

      let timeDisplay = `${dayOfWeek} ${date} ${time}`;

      if (event.endTime) {
        const endDate = new Date(event.endTime);

        // 检查是否是同一天
        const startDateOnly = format(startDate, 'yyyy-MM-dd');
        const endDateOnly = format(endDate, 'yyyy-MM-dd');

        if (startDateOnly === endDateOnly) {
          // 同一天：只显示结束时间（不重复日期）
          const endTime = format(endDate, 'h:mm a');
          timeDisplay += ` - ${endTime}`;
        } else {
          // 不同天：显示完整的日期和时间
          const endDayOfWeek = format(endDate, 'EEEE');
          const endDateStr = format(endDate, 'MM/dd');
          const endTime = format(endDate, 'h:mm a');
          timeDisplay += ` - ${endDayOfWeek} ${endDateStr} ${endTime}`;
        }
      }

      return timeDisplay;
    } catch (error) {
      return event.startTime; // 返回原始时间如果格式化失败
    }
  }

  cleanLocationForDisplay(location) {
    if (!location) return 'Location TBD';
    
    // 清理常见的地址格式问题
    return location
      .replace(/\s+/g, ' ')
      .replace(/,$/, '')
      .trim();
  }

  getEventTypeStats(events) {
    return CommonHelpers.getEventTypeStats(events);
  }

  getPriorityStats(events) {
    return CommonHelpers.getPriorityStats(events);
  }

  // 读取用户审核后的文件
  async readReviewFile(filepath) {
    try {
      const content = await fs.readFile(filepath, 'utf8');
      const reviewData = JSON.parse(content);
      
      const selectedEvents = reviewData.events.filter(event => event.selected === true);
      
      console.log(`📖 读取审核文件: ${path.basename(filepath)}`);
      console.log(`✅ 用户选择了 ${selectedEvents.length} 个活动`);
      
      return {
        reviewData,
        selectedEvents,
        weekRange: {
          identifier: reviewData.target_week,
          readable: reviewData.target_week_readable
        }
      };
      
    } catch (error) {
      throw new Error(`无法读取审核文件: ${error.message}`);
    }
  }

  // 验证审核文件格式
  validateReviewFile(reviewData) {
    const requiredFields = ['review_id', 'target_week', 'events'];
    
    for (const field of requiredFields) {
      if (!reviewData[field]) {
        throw new Error(`审核文件缺少必需字段: ${field}`);
      }
    }
    
    if (!Array.isArray(reviewData.events)) {
      throw new Error('events 字段必须是数组');
    }
    
    const selectedEvents = reviewData.events.filter(e => e.selected === true);
    if (selectedEvents.length === 0) {
      throw new Error('请至少选择一个活动 (将 selected 改为 true)');
    }
    
    return true;
  }

  // 生成审核总结报告
  generateReviewSummary(reviewData, selectedEvents) {
    const summary = {
      review_completed_at: new Date().toISOString(),
      original_candidates: reviewData.events.length,
      selected_count: selectedEvents.length,
      selection_rate: (selectedEvents.length / reviewData.events.length * 100).toFixed(1),
      selected_by_type: this.getEventTypeStats(selectedEvents),
      selected_by_priority: this.getPriorityStats(selectedEvents)
    };
    
    console.log(`\n📊 审核总结:`);
    console.log(`   - 原始候选: ${summary.original_candidates} 个`);
    console.log(`   - 用户选择: ${summary.selected_count} 个`);
    console.log(`   - 选择比例: ${summary.selection_rate}%`);
    console.log(`   - 按类型分布:`, summary.selected_by_type);
    
    return summary;
  }
}

module.exports = ManualReviewManager;