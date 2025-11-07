const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');
const config = require('../config');
const CoverGenerator = require('../utils/cover-generator');

class PostGenerator {
  constructor() {
    this.outputDir = config.output.directory;
    this.coverGenerator = new CoverGenerator();
  }

  // 生成最终的小红书发布内容
  async generatePost(translatedEvents, weekRange, reviewSummary = {}) {
    console.log(`📝 生成小红书发布内容，包含 ${translatedEvents.length} 个活动...`);

    const postContent = this.buildPostContent(translatedEvents, weekRange);
    const metadata = this.generatePostMetadata(translatedEvents, weekRange, reviewSummary);

    // 保存到文件
    const filename = config.output.finalFilename.replace('{date}', format(new Date(), 'yyyy-MM-dd_HHmm'));
    const filepath = path.join(this.outputDir, filename);

    await this.ensureOutputDirectory();
    await fs.writeFile(filepath, postContent, 'utf8');

    // 同时保存元数据
    const metadataFilepath = filepath.replace('.txt', '_metadata.json');
    await fs.writeFile(metadataFilepath, JSON.stringify(metadata, null, 2), 'utf8');

    // 生成封面图片
    console.log('');
    const coverResult = await this.coverGenerator.generateCover(weekRange);

    console.log(`✅ 发布内容已生成:`);
    console.log(`   📄 内容文件: ${filepath}`);
    console.log(`   📊 元数据文件: ${metadataFilepath}`);
    console.log(`   🎨 封面图片: ${coverResult.filepath}`);
    console.log(`   📏 内容长度: ${postContent.length} 字符`);

    // 显示内容预览
    this.displayPreview(postContent);

    return {
      content: postContent,
      filepath,
      metadata,
      coverImage: coverResult,
      stats: {
        totalEvents: translatedEvents.length,
        contentLength: postContent.length,
        hashtagCount: this.countHashtags(postContent)
      }
    };
  }

  buildPostContent(events, weekRange) {
    const dateRange = this.formatDateRange(weekRange);
    const eventsList = this.formatEventsList(events);
    const hashtags = this.generateHashtags(events);
    
    // 使用配置的模板
    let content = config.content.postTemplate
      .replace('{date_range}', dateRange)
      .replace('{events_list}', eventsList);
    
    // 添加标签
    content += `\n\n${hashtags}`;
    
    return content;
  }

  formatDateRange(weekRange) {
    // weekRange.identifier 格式: "2024-09-23_to_2024-09-29"
    const [startStr, endStr] = weekRange.identifier.split('_to_');
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    
    const startFormatted = format(startDate, 'M.d');
    const endFormatted = format(endDate, 'M.d');
    
    return `${startFormatted}-${endFormatted}`;
  }

  formatEventsList(events) {
    return events.map(event => this.formatSingleEvent(event)).join('\n\n');
  }

  formatSingleEvent(event) {
    // 使用翻译后的内容
    const title = event.title_cn || event.title;
    const time = event.time_cn || event.time_display;
    const location = event.location_cn || event.location;
    const price = event.price_cn || event.price || '免费';
    const description = event.description_cn || this.generateDefaultDescription(event);
    const link = event.short_url || event.original_url;
    
    // 使用配置的事件模板
    return config.content.eventTemplate
      .replace('{title}', title)
      .replace('{time}', time)
      .replace('{location}', location)
      .replace('{price}', price)
      .replace('{description}', description)
      .replace('{link}', link);
  }

  generateDefaultDescription(event) {
    const typeDescriptions = {
      'market': '精品市集好物多多',
      'festival': '节庆活动精彩纷呈',
      'food': '美食盛宴不容错过',
      'music': '音乐现场气氛热烈',
      'art': '艺术展览文化体验',
      'free': '免费活动快来参加'
    };
    
    return typeDescriptions[event.event_type] || '精彩活动等你来';
  }

  generateHashtags(events) {
    // 固定标签
    const fixedHashtags = [
      '#湾区生活',
      '#湾区周末',
      '#香槟小葡萄',
      '#湾区活动'
    ];

    return fixedHashtags.join(' ');
  }

  generatePostMetadata(events, weekRange, reviewSummary) {
    return {
      generated_at: new Date().toISOString(),
      week_range: weekRange,
      post_stats: {
        total_events: events.length,
        events_by_type: this.getEventTypeCount(events),
        events_by_day: this.getEventsByDay(events),
        price_distribution: this.getPriceDistribution(events)
      },
      review_summary: reviewSummary,
      events_details: events.map(event => ({
        title: event.title_cn || event.title,
        original_title: event.title,
        location: event.location_cn || event.location,
        time: event.time_cn || event.time_display,
        price: event.price_cn || event.price,
        event_type: event.event_type,
        chinese_relevant: event.chinese_relevant,
        source: event.source,
        original_url: event.original_url,
        short_url: event.short_url,
        translation_quality: event.translation_quality || 'unknown'
      }))
    };
  }

  getEventTypeCount(events) {
    const count = {};
    events.forEach(event => {
      const type = event.event_type || 'unknown';
      count[type] = (count[type] || 0) + 1;
    });
    return count;
  }

  getEventsByDay(events) {
    const dayCount = {};
    events.forEach(event => {
      try {
        const timeStr = event.time_display || '';
        const dayMatch = timeStr.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
        if (dayMatch) {
          const day = dayMatch[1];
          dayCount[day] = (dayCount[day] || 0) + 1;
        }
      } catch (e) {
        // 忽略解析错误
      }
    });
    return dayCount;
  }

  getPriceDistribution(events) {
    const distribution = {
      free: 0,
      low: 0,    // $1-20
      medium: 0, // $21-50
      high: 0    // $51+
    };
    
    events.forEach(event => {
      const price = event.price || '';
      
      if (!price || price.toLowerCase().includes('free')) {
        distribution.free++;
      } else {
        const dollarMatch = price.match(/\$(\d+)/);
        if (dollarMatch) {
          const amount = parseInt(dollarMatch[1]);
          if (amount <= 20) {
            distribution.low++;
          } else if (amount <= 50) {
            distribution.medium++;
          } else {
            distribution.high++;
          }
        }
      }
    });
    
    return distribution;
  }

  countHashtags(content) {
    const hashtags = content.match(/#\S+/g);
    return hashtags ? hashtags.length : 0;
  }

  displayPreview(content) {
    console.log('\n' + '='.repeat(50));
    console.log('📱 小红书发布内容预览:');
    console.log('='.repeat(50));
    console.log(content);
    console.log('='.repeat(50));
    console.log(`📏 字符总数: ${content.length}`);
    console.log('='.repeat(50) + '\n');
  }

  async ensureOutputDirectory() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }

  // 验证内容长度和格式
  validateContent(content) {
    const issues = [];
    
    // 检查长度（小红书单条内容限制）
    if (content.length > 1000) {
      issues.push(`内容过长 (${content.length} 字符)，建议控制在1000字符以内`);
    }
    
    // 检查是否包含链接
    const linkCount = (content.match(/https?:\/\/\S+/g) || []).length;
    if (linkCount === 0) {
      issues.push('内容中没有找到活动链接');
    }
    
    // 检查标签数量
    const hashtagCount = this.countHashtags(content);
    if (hashtagCount > 10) {
      issues.push(`标签过多 (${hashtagCount} 个)，建议控制在10个以内`);
    }
    
    return {
      valid: issues.length === 0,
      issues: issues
    };
  }

  // 生成内容摘要
  generateContentSummary(content) {
    const validation = this.validateContent(content);
    const eventCount = (content.match(/📅/g) || []).length;
    const linkCount = (content.match(/https?:\/\/\S+/g) || []).length;
    const hashtagCount = this.countHashtags(content);
    
    return {
      character_count: content.length,
      event_count: eventCount,
      link_count: linkCount,
      hashtag_count: hashtagCount,
      validation: validation
    };
  }
}

module.exports = PostGenerator;