const fs = require('fs').promises;
const path = require('path');
const { format, parseISO } = require('date-fns');
const config = require('../config');

class EnglishPostGenerator {
  constructor() {
    this.outputDir = config.output.directory;
  }

  // 生成指定平台的英文帖子
  async generatePost(events, weekRange, platform = 'reddit') {
    if (!config.englishPlatforms[platform]) {
      throw new Error(`Unknown platform: ${platform}. Available: reddit, nextdoor`);
    }

    console.log(`📝 Generating ${platform} post with ${events.length} events...`);

    const platformConfig = config.englishPlatforms[platform];
    const postContent = this.buildPostContent(events, weekRange, platformConfig, platform);

    // 保存到文件
    const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const extension = platform === 'reddit' ? 'md' : 'txt';
    const filename = `events_${platform}_${timestamp}.${extension}`;
    const filepath = path.join(this.outputDir, filename);

    await this.ensureOutputDirectory();
    await fs.writeFile(filepath, postContent, 'utf8');

    console.log(`✅ ${platform} post generated:`);
    console.log(`   📄 File: ${filepath}`);
    console.log(`   📏 Length: ${postContent.length} characters`);
    console.log(`   🎯 Events: ${events.length}`);

    // 显示内容预览
    this.displayPreview(postContent, platform);

    return {
      content: postContent,
      filepath,
      platform,
      stats: {
        totalEvents: events.length,
        contentLength: postContent.length
      }
    };
  }

  buildPostContent(events, weekRange, platformConfig, platform) {
    const dateRange = this.formatDateRange(weekRange);

    // 生成header
    let content = platformConfig.headerTemplate.replace('{date_range}', dateRange);

    // 根据平台决定是否分组
    if (platformConfig.groupByCategory) {
      content += this.formatEventsByCategory(events, platformConfig, platform);
    } else {
      content += this.formatEventsByDate(events, platformConfig, platform);
    }

    // 添加footer
    content += platformConfig.footerTemplate;

    return content;
  }

  formatDateRange(weekRange) {
    // weekRange.identifier 格式: "2024-09-23_to_2024-09-29"
    const [startStr, endStr] = weekRange.identifier.split('_to_');
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const startFormatted = format(startDate, 'MMM d');
    const endFormatted = format(endDate, 'd');

    return `${startFormatted}-${endFormatted}`;
  }

  formatEventsByCategory(events, platformConfig, platform) {
    // 按类型分组
    const categories = {
      'Markets & Fairs': [],
      'Festivals': [],
      'Food & Drink': [],
      'Music': [],
      'Arts & Culture': [],
      'Tech & Business': [],
      'Free Events': [],
      'Other': []
    };

    events.forEach(event => {
      const type = event.event_type || 'other';

      // 优先按活动类型分类，不论是否免费
      if (type === 'market' || type === 'fair') {
        categories['Markets & Fairs'].push(event);
      } else if (type === 'festival') {
        categories['Festivals'].push(event);
      } else if (type === 'food') {
        categories['Food & Drink'].push(event);
      } else if (type === 'music') {
        categories['Music'].push(event);
      } else if (type === 'art') {
        categories['Arts & Culture'].push(event);
      } else if (type === 'tech') {
        categories['Tech & Business'].push(event);
      } else if (type === 'free') {
        // 只有当 event_type 本身是 'free' 时才归到 Free Events
        categories['Free Events'].push(event);
      } else {
        categories['Other'].push(event);
      }
    });

    let content = '';

    // 按分类输出
    Object.keys(categories).forEach(category => {
      const categoryEvents = categories[category];
      if (categoryEvents.length > 0) {
        content += `\n## ${category}\n\n`;
        categoryEvents.forEach(event => {
          content += this.formatSingleEvent(event, platformConfig, platform) + '\n';
        });
      }
    });

    return content;
  }

  formatEventsByDate(events, platformConfig, platform) {
    // 按日期分组
    const eventsByDate = {};

    events.forEach(event => {
      try {
        const date = parseISO(event.start_time);
        const dateKey = format(date, 'yyyy-MM-dd');
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push(event);
      } catch (e) {
        // 如果日期解析失败，放入其他组
        if (!eventsByDate['unknown']) {
          eventsByDate['unknown'] = [];
        }
        eventsByDate['unknown'].push(event);
      }
    });

    let content = '';

    // 按日期排序
    const sortedDates = Object.keys(eventsByDate)
      .filter(d => d !== 'unknown')
      .sort();

    sortedDates.forEach(dateKey => {
      const dateEvents = eventsByDate[dateKey];
      content += '\n';
      dateEvents.forEach(event => {
        content += this.formatSingleEvent(event, platformConfig, platform) + '\n';
      });
    });

    // 添加未知日期的活动
    if (eventsByDate['unknown']) {
      content += '\n';
      eventsByDate['unknown'].forEach(event => {
        content += this.formatSingleEvent(event, platformConfig, platform) + '\n';
      });
    }

    return content;
  }

  formatSingleEvent(event, platformConfig, platform) {
    const title = event.title;
    const time = this.formatTime(event.start_time, event.end_time);
    const dayDate = this.formatDayDate(event.start_time);
    const location = this.formatLocation(event.location);
    const price = event.price || 'Free';
    const description = this.formatDescription(event);
    const link = event.original_url;
    const emoji = this.getEventEmoji(event.event_type);

    return platformConfig.eventTemplate
      .replace('{title}', title)
      .replace('{time}', time)
      .replace('{day_date}', dayDate)
      .replace('{location}', location)
      .replace('{price}', price)
      .replace('{description}', description)
      .replace('{link}', link)
      .replace('{emoji}', emoji);
  }

  formatTime(startTime, endTime) {
    try {
      const start = parseISO(startTime);
      let timeStr = format(start, 'EEE M/d, h:mm a');

      if (endTime) {
        try {
          const end = parseISO(endTime);
          timeStr += ` - ${format(end, 'h:mm a')}`;
        } catch (e) {
          // 忽略结束时间解析错误
        }
      }

      return timeStr;
    } catch (e) {
      return startTime;
    }
  }

  formatDayDate(startTime) {
    try {
      const start = parseISO(startTime);
      return format(start, 'EEE M/d');
    } catch (e) {
      return '';
    }
  }

  formatLocation(location) {
    // 简化地址，只保留主要部分
    if (!location) return 'TBA';

    // 如果地址太长，尝试提取城市
    if (location.length > 60) {
      const parts = location.split(',');
      if (parts.length >= 2) {
        // 取最后两部分（通常是城市和州）
        return parts.slice(-2).join(',').trim();
      }
    }

    return location;
  }

  formatDescription(event) {
    if (event.description_detail && event.description_detail.length > 10) {
      // 截取详细描述的前150个字符
      let desc = event.description_detail.substring(0, 150);
      if (event.description_detail.length > 150) {
        desc += '...';
      }
      return desc;
    } else if (event.description) {
      return event.description;
    }
    return '';
  }

  isFreeEvent(price) {
    if (!price) return true;
    const priceLower = price.toLowerCase();
    return priceLower.includes('free') || priceLower === '$0' || priceLower === '0';
  }

  getEventEmoji(eventType) {
    const emojiMap = {
      'market': '🛒',
      'fair': '🎪',
      'festival': '🎉',
      'food': '🍽️',
      'music': '🎵',
      'art': '🎨',
      'tech': '💻',
      'free': '🆓',
      'other': '📅'
    };

    return emojiMap[eventType] || '📅';
  }

  displayPreview(content, platform) {
    console.log('\n' + '='.repeat(60));
    console.log(`📱 ${platform.toUpperCase()} POST PREVIEW:`);
    console.log('='.repeat(60));

    // 只显示前500字符
    const preview = content.length > 500 ? content.substring(0, 500) + '\n...(truncated)' : content;
    console.log(preview);

    console.log('='.repeat(60));
    console.log(`📏 Total characters: ${content.length}`);
    console.log('='.repeat(60) + '\n');
  }

  async ensureOutputDirectory() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }
}

module.exports = EnglishPostGenerator;
