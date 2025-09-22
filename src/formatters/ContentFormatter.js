const { OpenAI } = require('openai');
const DateUtils = require('../utils/dateUtils');
const ShortUrlService = require('../utils/shortUrl');
const config = require('../config');

class ContentFormatter {
  constructor() {
    this.openai = config.apis.openai.key ? new OpenAI({
      apiKey: config.apis.openai.key
    }) : null;
    this.shortUrlService = new ShortUrlService();
  }

  async formatWeeklyPost(events, weekRange) {
    try {
      console.log(`Formatting weekly post for ${events.length} events...`);
      
      // 按优先级排序事件
      const sortedEvents = events.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.start_time) - new Date(b.start_time);
      });
      
      // 处理每个事件
      const formattedEvents = [];
      for (const event of sortedEvents.slice(0, 10)) { // 限制最多10个事件
        const formattedEvent = await this.formatSingleEvent(event);
        if (formattedEvent) {
          formattedEvents.push(formattedEvent);
        }
      }
      
      // 生成最终帖子
      const post = await this.generateFinalPost(formattedEvents, weekRange);
      
      return post;
    } catch (error) {
      console.error('Error formatting weekly post:', error);
      throw error;
    }
  }

  async formatSingleEvent(event) {
    try {
      // 翻译和优化标题
      const translatedTitle = await this.translateAndOptimizeTitle(event.title);
      
      // 生成简短描述
      const shortDescription = await this.generateShortDescription(event);
      
      // 生成短链接
      const shortUrl = await this.shortUrlService.createShortUrl(
        event.original_url,
        this.shortUrlService.generateEventAlias(event.title, event.start_time)
      );
      
      // 格式化时间
      const formattedTime = this.formatEventTime(event.start_time, event.end_time);
      
      // 格式化地点
      const formattedLocation = this.formatLocation(event.location);
      
      // 生成关键词
      const keywords = this.generateKeywords(event);
      
      return {
        title: translatedTitle,
        time: formattedTime,
        location: formattedLocation,
        price: event.price || 'Free',
        description: shortDescription,
        shortUrl,
        keywords,
        originalEvent: event
      };
    } catch (error) {
      console.error(`Error formatting event ${event.title}:`, error);
      return null;
    }
  }

  async translateAndOptimizeTitle(title) {
    try {
      if (!this.openai) {
        return this.manualTitleOptimization(title);
      }
      
      const prompt = `请将以下英文活动标题翻译成中文，并优化为适合小红书的标题格式（不超过50字符，吸引人且简洁）：

英文标题：${title}

要求：
1. 保持原意
2. 适合中文社交媒体
3. 突出活动亮点
4. 不超过50字符

只返回翻译后的标题，不要其他内容。`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      });
      
      const translatedTitle = response.choices[0].message.content.trim();
      return translatedTitle.length > 50 ? translatedTitle.substring(0, 50) : translatedTitle;
      
    } catch (error) {
      console.error('Error translating title:', error);
      return this.manualTitleOptimization(title);
    }
  }

  manualTitleOptimization(title) {
    // 简单的手动翻译映射
    const translations = {
      'market': '市集',
      'festival': '节日',
      'fair': '集市',
      'food': '美食',
      'music': '音乐',
      'art': '艺术',
      'free': '免费',
      'concert': '音乐会',
      'show': '演出',
      'event': '活动'
    };
    
    let optimizedTitle = title;
    
    // 应用翻译
    for (const [en, cn] of Object.entries(translations)) {
      const regex = new RegExp(en, 'gi');
      optimizedTitle = optimizedTitle.replace(regex, cn);
    }
    
    // 截断过长标题
    if (optimizedTitle.length > 50) {
      optimizedTitle = optimizedTitle.substring(0, 50) + '...';
    }
    
    return optimizedTitle;
  }

  async generateShortDescription(event) {
    try {
      if (!this.openai) {
        return this.manualDescriptionGeneration(event);
      }
      
      const context = `
活动标题：${event.title}
地点：${event.location}
价格：${event.price}
类型：${event.event_type}
原始描述：${event.description || '暂无'}
`.trim();
      
      const prompt = `基于以下活动信息，生成一个18字以内的中文简介，要简洁有吸引力：

${context}

要求：
1. 严格控制在18字以内
2. 突出活动亮点
3. 适合小红书风格
4. 不要使用引号

只返回简介文字，不要其他内容。`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.7
      });
      
      let description = response.choices[0].message.content.trim();
      description = description.replace(/["'「」《》]/g, ''); // 移除引号
      
      return description.length > 18 ? description.substring(0, 18) : description;
      
    } catch (error) {
      console.error('Error generating description:', error);
      return this.manualDescriptionGeneration(event);
    }
  }

  manualDescriptionGeneration(event) {
    const typeDescriptions = {
      market: '特色市集体验',
      festival: '节日庆典活动', 
      fair: '精彩集市活动',
      food: '美食体验活动',
      music: '音乐演出活动',
      art: '艺术文化活动',
      free: '免费参与活动'
    };
    
    const baseDescription = typeDescriptions[event.event_type] || '精彩活动体验';
    
    // 加上地点信息
    if (event.location.includes('SF') || event.location.includes('San Francisco')) {
      return `旧金山${baseDescription}`;
    } else if (event.location.includes('Oakland')) {
      return `奥克兰${baseDescription}`;
    } else if (event.location.includes('San Jose')) {
      return `圣荷西${baseDescription}`;
    }
    
    return baseDescription.substring(0, 18);
  }

  formatEventTime(startTime, endTime = null) {
    try {
      const start = new Date(startTime);
      const dateStr = start.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
      });
      
      const timeStr = start.toLocaleTimeString('zh-CN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: false
      });
      
      if (endTime) {
        const end = new Date(endTime);
        const endTimeStr = end.toLocaleTimeString('zh-CN', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: false
        });
        return `${dateStr} ${timeStr}-${endTimeStr}`;
      }
      
      return `${dateStr} ${timeStr}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return startTime;
    }
  }

  formatLocation(location) {
    if (!location) return '湾区';
    
    // 地名翻译映射
    const locationMap = {
      'San Francisco': '旧金山',
      'Oakland': '奥克兰',
      'San Jose': '圣荷西',
      'Berkeley': '伯克利',
      'Palo Alto': '帕洛阿尔托',
      'Mountain View': '山景城',
      'Fremont': '弗里蒙特',
      'Bay Area': '湾区'
    };
    
    let formatted = location;
    for (const [en, cn] of Object.entries(locationMap)) {
      if (location.includes(en)) {
        formatted = location.replace(en, cn);
        break;
      }
    }
    
    // 简化过长的地址
    if (formatted.length > 20) {
      formatted = formatted.substring(0, 20) + '...';
    }
    
    return formatted;
  }

  generateKeywords(event) {
    const keywords = ['湾区生活', '周末活动'];
    
    // 基于活动类型添加关键词
    const typeKeywords = {
      market: ['市集', '购物'],
      festival: ['节日', '庆典'],
      fair: ['集市', '展会'],
      food: ['美食', '餐饮'],
      music: ['音乐', '演出'],
      art: ['艺术', '文化'],
      free: ['免费活动']
    };
    
    if (typeKeywords[event.event_type]) {
      keywords.push(...typeKeywords[event.event_type]);
    }
    
    // 基于地点添加关键词
    if (event.location.includes('San Francisco') || event.location.includes('SF')) {
      keywords.push('旧金山');
    }
    if (event.location.includes('Oakland')) {
      keywords.push('奥克兰');
    }
    if (event.location.includes('San Jose')) {
      keywords.push('硅谷', '圣荷西');
    }
    
    return keywords.slice(0, 8); // 限制关键词数量
  }

  async generateFinalPost(formattedEvents, weekRange) {
    const dateRange = DateUtils.formatDateRange(weekRange.start, weekRange.end);
    
    let eventsList = '';
    formattedEvents.forEach((event, index) => {
      eventsList += config.content.eventTemplate
        .replace('{title}', event.title)
        .replace('{time}', event.time)
        .replace('{location}', event.location)
        .replace('{price}', event.price)
        .replace('{description}', event.description)
        .replace('{link}', event.shortUrl);
      
      if (index < formattedEvents.length - 1) {
        eventsList += '\n';
      }
    });
    
    // 收集所有关键词
    const allKeywords = new Set();
    formattedEvents.forEach(event => {
      event.keywords.forEach(keyword => allKeywords.add(keyword));
    });
    
    const hashtagString = Array.from(allKeywords).map(tag => `#${tag}`).join(' ');
    
    const finalPost = config.content.postTemplate
      .replace('{date_range}', dateRange)
      .replace('{events_list}', eventsList)
      + '\n\n' + hashtagString;
    
    return {
      content: finalPost,
      events: formattedEvents,
      weekRange,
      stats: {
        totalEvents: formattedEvents.length,
        keywords: Array.from(allKeywords)
      }
    };
  }
}

module.exports = ContentFormatter;