const AIService = require('../utils/ai-service');
const config = require('../config');

class ContentTranslator {
  constructor() {
    this.aiService = new AIService();
    
    // 检查是否有可用的AI提供商
    const available = this.aiService.getAvailableProviders();
    if (available.length === 0) {
      console.warn('⚠️ No AI provider is configured for translation. Using fallback translation.');
      console.warn('For better results, set up at least one: OPENAI_API_KEY, GEMINI_API_KEY, or CLAUDE_API_KEY');
      this.aiAvailable = false;
    } else {
      this.aiAvailable = true;
      console.log(`Content Translator initialized with provider: ${this.aiService.provider}`);
    }
  }

  // 翻译和优化事件内容
  async translateAndOptimizeEvents(events) {
    console.log(`🌐 翻译和优化 ${events.length} 个活动内容...`);
    
    if (!this.aiAvailable) {
      console.log('使用基础翻译模式（无AI可用）');
      return events.map(event => this.createFallbackTranslation(event));
    }
    
    const translatedEvents = [];
    const batchSize = 3; // 每批处理3个事件
    
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      try {
        const batchResults = await this.translateEventBatch(batch);
        translatedEvents.push(...batchResults);
      } catch (error) {
        console.error(`翻译批次 ${Math.floor(i / batchSize) + 1} 失败:`, error.message);

        // 失败时使用简单翻译
        const fallbackResults = await this.fallbackTranslation(batch);
        translatedEvents.push(...fallbackResults);
      }
      
      // 批次间延迟
      if (i + batchSize < events.length) {
        await this.delay(2000);
      }
    }
    
    console.log(`✅ 内容翻译完成: ${translatedEvents.length} 个活动`);
    return translatedEvents;
  }

  async translateEventBatch(events) {
    const prompt = this.buildTranslationPrompt(events);
    
    const messages = [
      {
        role: 'system',
        content: `你是专业的活动内容翻译和编辑专家，专门为小红书平台创作内容。
        
        翻译要求:
        1. 标题: 吸引人，不超过50字符，适合小红书风格
        2. 描述: 简洁有趣，18字以内，突出亮点
        3. 地点: 翻译地名但保留英文原名便于查找
        4. 时间: 使用中文表达，清晰明了
        5. 价格: 保留美元符号，添加中文说明
        
        语言风格: 活泼、年轻化、适合湾区华人社区
        返回有效的JSON格式。`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await this.aiService.chatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 2000
    });

    console.log(`Translation completed using ${response.provider} (${response.model})`);
    if (response.fallbackUsed) {
      console.log(`⚠️  Fallback provider used. Original: ${response.originalProvider}`);
    }

    const aiResult = JSON.parse(response.content);
    
    // 将翻译结果映射回原始事件
    return events.map((event, index) => {
      const translation = aiResult.events.find(e => e.id === index);
      if (translation) {
        return {
          ...event,
          title_cn: translation.title_cn,
          description_cn: translation.description_cn,
          location_cn: translation.location_cn,
          time_cn: translation.time_cn,
          price_cn: translation.price_cn,
          highlight: translation.highlight || '',
          translation_quality: 'ai'
        };
      } else {
        return this.createFallbackTranslation(event);
      }
    });
  }

  buildTranslationPrompt(events) {
    const eventsData = events.map((event, index) => ({
      id: index,
      title: event.title,
      description: event.description_preview || '',
      location: event.location,
      time_display: event.time_display,
      price: event.price,
      event_type: event.event_type
    }));

    return `
请翻译并优化以下湾区活动信息，适合小红书发布:

${eventsData.map(event => `
活动 ${event.id}:
标题: ${event.title}
描述: ${event.description}
地点: ${event.location} 
时间: ${event.time_display}
价格: ${event.price}
类型: ${event.event_type}
`).join('\n')}

请返回以下JSON格式:
{
  "events": [
    {
      "id": 0,
      "title_cn": "吸引人的中文标题（50字内）",
      "description_cn": "简洁描述（18字内）",
      "location_cn": "地点中文名 (English Name)",
      "time_cn": "周六 12/25 下午7点",
      "price_cn": "$45-85 (约¥315-595)",
      "highlight": "活动亮点或特色"
    }
  ]
}

翻译指南:
1. 标题要有吸引力，符合小红书风格
2. 描述突出最大亮点，控制在18字内
3. 地点保留英文方便导航
4. 时间用中文表达习惯
5. 价格添加人民币参考(1美元≈7元)
6. 突出对华人社区的吸引点
`;
  }

  // 简单后备翻译方法
  async fallbackTranslation(events) {
    return events.map(event => this.createFallbackTranslation(event));
  }

  createFallbackTranslation(event) {
    // 基础翻译逻辑
    const titleCn = this.translateTitle(event.title);
    const locationCn = this.translateLocation(event.location);
    const timeCn = this.translateTime(event.time_display);
    const priceCn = this.translatePrice(event.price);
    
    return {
      ...event,
      title_cn: titleCn,
      description_cn: this.generateSimpleDescription(event),
      location_cn: locationCn,
      time_cn: timeCn,
      price_cn: priceCn,
      highlight: '',
      translation_quality: 'fallback'
    };
  }

  translateTitle(title) {
    if (!title) return '活动详情';
    
    // 简单的关键词翻译
    const translations = {
      'market': '市集',
      'farmers market': '农夫市集',
      'festival': '节庆',
      'music festival': '音乐节',
      'food festival': '美食节',
      'art festival': '艺术节',
      'fair': '博览会',
      'expo': '展览会',
      'concert': '音乐会',
      'show': '演出',
      'event': '活动'
    };
    
    let translatedTitle = title;
    Object.entries(translations).forEach(([en, cn]) => {
      const regex = new RegExp(en, 'gi');
      translatedTitle = translatedTitle.replace(regex, cn);
    });
    
    return translatedTitle.substring(0, 50);
  }

  translateLocation(location) {
    if (!location) return '地点待定';
    
    // 常见地点翻译
    const locationMap = {
      'San Francisco': '旧金山',
      'Oakland': '奥克兰', 
      'Berkeley': '伯克利',
      'San Jose': '圣何塞',
      'Palo Alto': '帕洛阿尔托',
      'Mountain View': '山景城',
      'Ferry Building': '渡轮大厦',
      'Union Square': '联合广场',
      'Golden Gate Park': '金门公园'
    };
    
    let translatedLocation = location;
    Object.entries(locationMap).forEach(([en, cn]) => {
      if (location.includes(en)) {
        translatedLocation = `${cn} (${en})`;
      }
    });
    
    return translatedLocation;
  }

  translateTime(timeDisplay) {
    if (!timeDisplay) return '时间待定';
    
    try {
      // 简单的时间翻译
      const dayMap = {
        'Monday': '周一',
        'Tuesday': '周二', 
        'Wednesday': '周三',
        'Thursday': '周四',
        'Friday': '周五',
        'Saturday': '周六',
        'Sunday': '周日'
      };
      
      let translated = timeDisplay;
      Object.entries(dayMap).forEach(([en, cn]) => {
        translated = translated.replace(en, cn);
      });
      
      // 转换AM/PM
      translated = translated.replace(/(\d{1,2}:\d{2})\s*AM/gi, '上午$1');
      translated = translated.replace(/(\d{1,2}:\d{2})\s*PM/gi, '下午$1');
      
      return translated;
    } catch (error) {
      return timeDisplay;
    }
  }

  translatePrice(price) {
    if (!price) return '免费';
    
    if (price.toLowerCase().includes('free')) {
      return '免费';
    }
    
    // 提取美元金额并转换
    const dollarMatch = price.match(/\$(\d+(?:-\d+)?)/);
    if (dollarMatch) {
      const dollarAmount = dollarMatch[1];
      if (dollarAmount.includes('-')) {
        const [min, max] = dollarAmount.split('-');
        const minRmb = Math.round(parseInt(min) * 7);
        const maxRmb = Math.round(parseInt(max) * 7);
        return `$${dollarAmount} (约¥${minRmb}-${maxRmb})`;
      } else {
        const rmb = Math.round(parseInt(dollarAmount) * 7);
        return `$${dollarAmount} (约¥${rmb})`;
      }
    }
    
    return price;
  }

  generateSimpleDescription(event) {
    const type = event.event_type;
    const typeDescriptions = {
      'market': '新鲜好物等你来淘',
      'festival': '精彩活动不容错过',
      'food': '美食盛宴味蕾享受',
      'music': '音乐盛会现场嗨翻',
      'free': '免费参与快来体验',
      'art': '艺术盛宴文化熏陶'
    };
    
    return typeDescriptions[type] || '精彩活动等你参与';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ContentTranslator;