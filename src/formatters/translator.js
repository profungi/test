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

你的任务是将英文活动信息处理成适合小红书发布的格式。

重要规则:
1. 标题格式：emoji + 英文原标题 + 中文翻译
   示例："🥩 Meat Carnival 肉食嘉年华"
2. 描述：必须基于活动的实际内容和描述，小红书风格，自然活泼，每个活动不同，18字以内
   重要：仔细阅读活动标题和描述，提取具体信息（如活动特色、亮点、主题等）
   好的示例："金银岛海景烤肉趴！现场live music超嗨"（基于实际内容）
   避免："精彩活动不容错过"（太笼统机械）
3. 地点：原样保留，不要翻译
4. 时间格式：mm/dd(DayAbbr),HH:MMAM/PM （注意星期括号后有逗号）
   示例："10/10(Fri),6:30PM"
5. 价格：免费写"免费"，有具体价格保留原价格，无信息写"查看链接"

语言风格: 轻松、真实、像朋友推荐活动的感觉

CRITICAL: 返回纯JSON，不要markdown标记。`
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

    // 清理可能的markdown代码块标记
    let cleanedContent = response.content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    // 调试日志
    console.log('🔍 AI Response (first 500 chars):', cleanedContent.substring(0, 500));

    const aiResult = JSON.parse(cleanedContent);
    
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
      description: event.description_preview || event.description || '',
      location: event.location,
      time_display: event.time_display,
      price: event.price,
      event_type: event.event_type
    }));

    return `处理以下湾区活动信息为小红书格式。每个活动的描述必须独特且自然。

活动列表:
${eventsData.map(event => `
【活动 ${event.id}】
标题: ${event.title}
描述: ${event.description || '(无)'}
地点: ${event.location}
时间: ${event.time_display}
价格: ${event.price || '(无价格信息)'}
`).join('\n---\n')}

返回JSON格式（不要markdown）:
{
  "events": [
    {
      "id": 0,
      "title_cn": "English Title + 中文翻译",
      "description_cn": "小红书风格描述",
      "location_cn": "原地点不翻译",
      "time_cn": "mm/dd,(Day),HH:MMAM/PM",
      "price_cn": "价格或免费或查看链接"
    }
  ]
}

格式要求:
1. title_cn - 格式："emoji + English Title + 中文"
   示例："🥩 Meat Carnival 肉食嘉年华"
2. description_cn - 基于活动实际描述内容，小红书风格，18字内
   关键：从活动描述中提取具体信息（如活动内容、特色、亮点）
   好："海岛烤肉趴配live music！湾区最嗨周末"（基于实际描述）
   差："精彩活动不容错过"（太笼统）
3. location_cn - 原样保留地点，不翻译
   示例："Treasure Island San Francisco, CA"
4. time_cn - 格式：mm/dd(DayAbbr),HH:MMAM/PM （星期括号后有逗号）
   示例："10/10(Fri),6:30PM"
5. price_cn - 免费写"免费"，有价格就写，无信息写"查看链接"
   示例："$25-50" 或 "免费" 或 "查看链接"

示例:
输入: "Meat Carnival at Treasure Island - BBQ, music, bay views"
输出 title_cn: "🥩 Meat Carnival 肉食嘉年华"
输出 description_cn: "海景BBQ派对配live music！氛围绝了"
输出 location_cn: "Treasure Island San Francisco, CA"
输出 time_cn: "10/10(Fri),6:30PM"
输出 price_cn: "查看链接"`;
  }

  // 简单后备翻译方法
  async fallbackTranslation(events) {
    return events.map(event => this.createFallbackTranslation(event));
  }

  createFallbackTranslation(event) {
    // 基础翻译逻辑 - 新格式
    const titleCn = this.translateTitleMixed(event.title);
    const locationCn = event.location; // 保持原样
    const timeCn = this.formatTimeNew(event.time_display);
    const priceCn = this.formatPriceNew(event.price);

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

  translateTitleMixed(title) {
    if (!title) return 'Event 活动';

    // 保留英文原标题 + 添加中文翻译
    const translations = {
      'carnival': '嘉年华',
      'market': '市集',
      'farmers market': '农夫市集',
      'festival': '节日',
      'music festival': '音乐节',
      'food festival': '美食节',
      'fair': '博览会',
      'concert': '音乐会',
      'show': '演出',
      'night': '之夜',
      'party': '派对'
    };

    let chineseTranslation = '';
    const lowerTitle = title.toLowerCase();

    // 找匹配的翻译
    for (const [en, cn] of Object.entries(translations)) {
      if (lowerTitle.includes(en)) {
        chineseTranslation = cn;
        break;
      }
    }

    // 添加emoji
    let emoji = '';
    if (lowerTitle.includes('meat') || lowerTitle.includes('food')) emoji = '🥩';
    else if (lowerTitle.includes('music')) emoji = '🎵';
    else if (lowerTitle.includes('art')) emoji = '🎨';
    else if (lowerTitle.includes('market')) emoji = '🛒';

    // 格式：emoji + 英文 + 中文
    if (emoji && chineseTranslation) {
      return `${emoji} ${title} ${chineseTranslation}`;
    } else if (emoji) {
      return `${emoji} ${title}`;
    } else if (chineseTranslation) {
      return `${title} ${chineseTranslation}`;
    }
    return title;
  }

  translateLocation(location) {
    if (!location) return '地点待定';

    // 如果地点信息很简略（只有城市名），保持原样但添加中文
    const simpleCities = {
      'San Francisco': '旧金山',
      'Oakland': '奥克兰',
      'Berkeley': '伯克利',
      'San Jose': '圣何塞',
      'Palo Alto': '帕洛阿尔托',
      'Mountain View': '山景城'
    };

    // 如果只是一个城市名，直接翻译
    if (simpleCities[location]) {
      return `${simpleCities[location]} (${location})`;
    }

    // 如果包含更详细信息，尝试智能翻译
    const venueTranslations = {
      'Ferry Building': '渡轮大厦',
      'Union Square': '联合广场',
      'Golden Gate Park': '金门公园',
      'Treasure Island': '金银岛',
      'Civic Center': '市政中心',
      'Mission District': '教会区',
      'Fisherman\'s Wharf': '渔人码头',
      'Chinatown': '唐人街',
      'Marina': '码头区',
      'SOMA': 'SOMA区'
    };

    let translatedLocation = location;
    let hasTranslation = false;

    // 翻译特定场馆
    Object.entries(venueTranslations).forEach(([en, cn]) => {
      if (location.includes(en)) {
        translatedLocation = location.replace(en, `${cn} (${en})`);
        hasTranslation = true;
      }
    });

    // 翻译城市名
    Object.entries(simpleCities).forEach(([en, cn]) => {
      if (location.includes(en) && !hasTranslation) {
        translatedLocation = location.replace(en, `${cn}`);
      }
    });

    return translatedLocation;
  }

  formatTimeNew(timeDisplay) {
    // 新格式: mm/dd(DayAbbr)HH:MMAM/PM （无逗号无空格）
    if (!timeDisplay) return 'TBD';

    try {
      // 尝试从现有时间字符串中提取信息
      // 假设输入可能是 "Friday, Oct 10, 6:30 PM" 或类似格式

      const dayAbbr = {
        'Monday': 'Mon', 'Mon': 'Mon',
        'Tuesday': 'Tue', 'Tue': 'Tue',
        'Wednesday': 'Wed', 'Wed': 'Wed',
        'Thursday': 'Thu', 'Thu': 'Thu',
        'Friday': 'Fri', 'Fri': 'Fri',
        'Saturday': 'Sat', 'Sat': 'Sat',
        'Sunday': 'Sun', 'Sun': 'Sun'
      };

      // 提取日期、星期、时间
      let day = '';
      for (const [full, abbr] of Object.entries(dayAbbr)) {
        if (timeDisplay.includes(full)) {
          day = abbr;
          break;
        }
      }

      // 提取月/日 (如 "Oct 10" 或 "10/10")
      const dateMatch = timeDisplay.match(/(\d{1,2})\/(\d{1,2})/);
      let formattedDate = '';
      if (dateMatch) {
        formattedDate = `${dateMatch[1]}/${dateMatch[2]}`;
      } else {
        const monthMatch = timeDisplay.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
        if (monthMatch) {
          const monthNum = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          formattedDate = `${monthNum[monthMatch[1]]}/${monthMatch[2]}`;
        }
      }

      // 提取时间 (如 "6:30 PM")
      const timeMatch = timeDisplay.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      let formattedTime = '';
      if (timeMatch) {
        formattedTime = `${timeMatch[1]}:${timeMatch[2]}${timeMatch[3].toUpperCase()}`;
      }

      // 组合：mm/dd(Day),HH:MMAM/PM （星期括号后有逗号）
      if (formattedDate && day && formattedTime) {
        return `${formattedDate}(${day}),${formattedTime}`;
      } else if (formattedDate && formattedTime) {
        return `${formattedDate},${formattedTime}`;
      }

      // 如果解析失败，返回原始值
      return timeDisplay;
    } catch (error) {
      return timeDisplay;
    }
  }

  // 保留旧的翻译方法用于兼容
  translateTime(timeDisplay) {
    return this.formatTimeNew(timeDisplay);
  }

  formatPriceNew(price) {
    // 新格式：免费/"具体价格"/"查看链接"
    if (!price) return '查看链接';

    const priceLower = price.toLowerCase();

    // 检查是否免费
    if (priceLower.includes('free') || priceLower === '$0' || priceLower === '0') {
      return '免费';
    }

    // 如果有具体价格，返回价格
    const dollarMatch = price.match(/\$\d+/);
    if (dollarMatch) {
      return price; // 返回原始价格如 "$25" 或 "$25-50"
    }

    // 如果包含"check"、"see"等词，说明需要查看
    if (priceLower.includes('check') || priceLower.includes('see') ||
        priceLower.includes('visit') || priceLower.includes('page')) {
      return '查看链接';
    }

    // 其他情况，如果有内容就返回，否则返回"查看链接"
    return price.length > 0 ? price : '查看链接';
  }

  // 保留旧的翻译方法用于兼容
  translatePrice(price) {
    return this.formatPriceNew(price);
  }

  generateSimpleDescription(event) {
    // 小红书风格描述 - 尝试从标题和描述中提取具体信息
    const title = (event.title || '').toLowerCase();
    const description = (event.description || event.description_preview || '').toLowerCase();
    const location = (event.location || '').toLowerCase();
    const type = event.event_type;

    // 组合多个关键词生成更贴近活动的描述
    let keywords = [];

    // 从标题和描述中提取关键信息
    if (title.includes('meat') || description.includes('bbq')) keywords.push('烤肉');
    if (title.includes('music') || description.includes('live') || description.includes('band')) keywords.push('现场音乐');
    if (title.includes('carnival') || title.includes('festival')) keywords.push('嘉年华');
    if (location.includes('island') || location.includes('beach')) keywords.push('海景');
    if (title.includes('wine') || title.includes('beer')) keywords.push('美酒');
    if (description.includes('food') || description.includes('dining')) keywords.push('美食');
    if (title.includes('art') || description.includes('exhibition')) keywords.push('艺术');
    if (title.includes('night') || title.includes('evening')) keywords.push('夜间');
    if (title.includes('outdoor') || description.includes('outdoor')) keywords.push('户外');

    // 根据关键词组合生成描述
    if (keywords.length >= 2) {
      const combo = keywords.slice(0, 2).join('+');
      if (combo.includes('烤肉') && combo.includes('现场音乐')) return '烤肉派对配live music！氛围绝了';
      if (combo.includes('海景') && combo.includes('烤肉')) return '海景烤肉趴！边吃边看海超惬意';
      if (combo.includes('美食') && combo.includes('现场音乐')) return '美食配音乐！周末最佳选择';
      if (combo.includes('户外') && combo.includes('嘉年华')) return '户外嘉年华！阳光美食一次满足';
    }

    // 单关键词具体描述
    if (title.includes('carnival')) return '超嗨嘉年华！美食游戏一站式体验';
    if (title.includes('meat') || title.includes('bbq')) return '肉食爱好者天堂！各种烤肉管够';
    if (title.includes('festival')) return '节日氛围拉满！带上朋友一起来';
    if (title.includes('market')) return '周末逛市集！淘到好物心情好';
    if (title.includes('food')) return '吃货必打卡！美味多到选择困难';
    if (title.includes('music') || title.includes('concert')) return '现场太燃了！音乐氛围绝绝子';
    if (title.includes('art') || title.includes('gallery')) return '艺术熏陶来啦！拍照超出片';
    if (title.includes('night')) return '夜生活开启！氛围感直接拉满';
    if (title.includes('party')) return '派对时间到！和朋友嗨翻天';
    if (title.includes('wine') || title.includes('beer')) return '小酌怡情！氛围感满满';
    if (title.includes('free')) return '免费参加！这么好的机会别错过';

    // 按类型提供自然的默认描述
    const typeDescriptions = {
      'market': '周末好去处！逛吃逛吃心情好',
      'festival': '氛围感拉满！适合全家一起来',
      'food': '美食天堂！好吃到停不下来',
      'music': '现场感爆棚！音乐迷别错过',
      'free': '免费哦！这种好事必须安排',
      'art': '文艺青年集合！拍照很出片',
      'fair': '有意思的活动！值得去看看'
    };

    return typeDescriptions[type] || '有趣的活动！周末可以安排上';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ContentTranslator;