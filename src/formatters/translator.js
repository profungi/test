const AIService = require('../utils/ai-service');
const config = require('../config');

// 活动模式配置
const EVENT_PATTERNS = {
  diwali: {
    priority: 1,
    keywords: ['diwali'],
    fixedDescription: '印度舞蹈和音乐表演，南亚美食摊位，Diwali点灯仪式'
  },
  halloween: {
    priority: 1,
    keywords: ['halloween', 'thrill-o-ween'],
    features: {
      'costume': '服装比赛',
      'movie|film': '恐怖电影',
      'trick|treat': '不给糖就捣蛋',
      'pumpkin': '南瓜雕刻'
    },
    fallbackDescription: '万圣节主题活动，服装打扮和互动游戏',
    template: '{features}，万圣节主题活动'
  },
  jazzConcert: {
    priority: 2,
    keywords: ['jazz'],
    requiredKeywords: ['concert', 'performance', 'show', 'music'],
    features: {
      'grammy|award': '获奖音乐家',
      'quartet|ensemble': '爵士乐团',
      'trumpet|saxophone|piano': '现场乐器演奏'
    },
    fallbackDescription: '爵士乐现场演出',
    template: '{features}，爵士乐现场'
  },
  petEvent: {
    priority: 3,
    keywords: ['pet', 'dog', 'cat', 'animal'],
    features: {
      'adoption': '宠物领养',
      'costume': '宠物服装比赛',
      'parade': '宠物游行',
      'vendor': '宠物用品摊位'
    },
    fallbackDescription: '宠物友好活动，带上你的毛孩子',
    template: '{features}，宠物友好活动'
  },
  farmersMarket: {
    priority: 4,
    keywords: ['farmers market', 'farm market'],
    features: {
      'organic': '有机农产品',
      'local': '本地农场',
      'vendor': '摊位众多',
      'food': '新鲜食材'
    },
    fallbackDescription: '新鲜农产品和本地美食',
    template: '农夫市集，{features}'
  },
  weddingExpo: {
    priority: 5,
    keywords: ['wedding'],
    requiredKeywords: ['expo', 'show', 'showcase'],
    features: {
      'vendor': '婚礼供应商展示',
      'fashion': '婚纱展示',
      'planner': '婚礼策划师',
      'cake': '蛋糕试吃'
    },
    fallbackDescription: '婚礼策划展会，婚礼供应商展示',
    template: '{features}，婚礼策划展会'
  }
};

// 通用特征配置
const GENERIC_FEATURES = {
  drinks: {
    'whisky|whiskey': '威士忌品鉴会',
    'wine': '葡萄酒品鉴',
    'beer': '精酿啤酒试饮'
  },
  food: {
    'bbq|barbecue': 'BBQ烧烤',
    'food': '美食摊位'
  },
  entertainment: {
    'live music|band': '现场乐队',
    'dance|dancing': '舞蹈表演',
    'craft|handmade': '手工艺品',
    'art.*exhibition': '艺术作品展',
    'family|kids': '家庭友好',
    'yoga': '瑜伽课程'
  }
};

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
        content: `你是小红书活动内容创作专家。

🎯 核心任务：每个活动都有"详细描述"字段，你必须仔细阅读并从中提取具体信息来创作描述。

【工作流程】
1. 阅读"详细描述"（description）字段
2. 从中提取3-5个具体信息：
   • 什么食物/表演/艺术类型（如：印度舞蹈、BBQ烧烤、钢琴演奏）
   • 数字规模（如：20个摊位、50位艺术家）
   • 特色活动（如：服装比赛、点灯仪式、拍照打卡）
   • 亮点细节（如：免费食物、获奖艺术家、现场DJ）
3. 组织成40-80字描述，信息越丰富越好
4. 可适度加种草话术（值得一去/别错过/超赞）

⚠️ 绝对禁止：
❌ "社区活动" "本地活动" - 太空泛，必须说具体做什么！
❌ "美食音乐娱乐" - 必须说什么美食/音乐！
❌ "各种" "众多" "体验" "氛围" - 空话！
❌ 不要在描述中重复价格信息（价格已单独显示）

【示例：如何使用详细描述】

输入1：
标题: "Barks & Boos"
详细描述: "Costume contest for dogs, trick-or-treating, pet photo booth, Halloween games."
✅ 正确: "宠物万圣节服装比赛、狗狗互动游戏、拍照打卡"
❌ 错误: "社区活动" ← 忽略了description！

输入2：
标题: "Oakland Diwali 2025"
详细描述: "Traditional lighting ceremony, Indian dance and music performances, South Asian food vendors."
✅ 正确: "印度舞蹈和音乐表演，南亚美食摊位，点灯仪式"
❌ 错误: "社区活动" ← 详细描述有这么多信息却不用！

输入3：
标题: "Community Arts Market"
详细描述: "Over 20 local artists showcasing paintings, sculptures, handmade crafts. Live music performances, food trucks, family-friendly activities."
✅ 正确: "20多个本地艺术家摊位，绘画雕塑和手工艺品，现场音乐表演，美食卡车，适合全家，拍照打卡超赞"
❌ 错误: "艺术作品展览" ← 太笼统，没用description！

【description为空时才使用的备选规则】
只有当详细描述为空或很短时，才从标题推断：
• 音乐会 → "[艺术家]现场演出，[音乐类型]"
• 话剧 → "话剧作品《剧名》舞台演出"
• Diwali → "印度舞蹈和音乐表演，南亚美食，点灯仪式"
• 万圣节 → "服装比赛、恐怖电影、互动游戏"

【格式要求】
1. 标题格式：emoji + 英文原标题 + 空格 + 中文翻译
   示例：
   - "🥩 Meat Carnival 肉食嘉年华"
   - "🎨 Arts Festival 艺术节"
   - "🛒 Farmers Market 农夫市集"

2. 时间格式：mm/dd(Day),HH:MMAM/PM
3. 价格格式：免费/原价格/查看链接
4. 地点：原样保留

⚠️ 重要：标题必须包含中文翻译！不能只有英文！

返回纯JSON，不要markdown。`
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
      description: event.description_detail || event.description_preview || event.description || '',
      location: event.location,
      time_display: event.time_display,
      price: event.price,
      event_type: event.event_type
    }));

    return `请为以下活动创作小红书描述。

⚠️ 关键：每个活动都有"详细描述"字段，这是最重要的信息来源！

活动列表:
${eventsData.map(event => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【活动 ${event.id}】
标题: ${event.title}

📝 详细描述（重点阅读！）:
${event.description || '(无详细描述 - 需从标题推断)'}

其他信息:
• 地点: ${event.location}
• 时间: ${event.time_display}
• 价格: ${event.price || '(无价格信息)'}
`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 创作指引：
1. 优先使用"详细描述"中的信息，从中提取3-5个具体内容
2. 描述长度：40-80字，信息越丰富越好
3. 只有详细描述为空时，才从标题推断
4. 禁止输出："社区活动"、"本地活动"、"美食音乐娱乐"等空泛词汇
5. 不要在描述中重复价格（价格已单独显示）
6. 标题必须翻译成中文！格式：emoji + 原英文标题 + 中文翻译

返回JSON（不要markdown）:
{
  "events": [
    {
      "id": 0,
      "title_cn": "🛒 Ferry Plaza Farmers Market 渡轮广场农夫市集",
      "description_cn": "从详细描述提取的40-80字丰富内容",
      "location_cn": "原地点",
      "time_cn": "10/25(Fri),8:00AM",
      "price_cn": "免费"
    }
  ]
}

注意：title_cn 必须是完整的格式，包含emoji、原英文和中文翻译！`;
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
      'farmers market': '农夫市集',
      'flea market': '跳蚤市集',
      'night market': '夜市',
      'art market': '艺术市集',
      'food festival': '美食节',
      'music festival': '音乐节',
      'art festival': '艺术节',
      'film festival': '电影节',
      'street fair': '街头博览会',
      'wedding fair': '婚礼博览会',
      'carnival': '嘉年华',
      'market': '市集',
      'festival': '节日',
      'fair': '博览会',
      'concert': '音乐会',
      'show': '演出',
      'performance': '演出',
      'exhibition': '展览',
      'workshop': '工作坊',
      'class': '课程',
      'tour': '巡演',
      'night': '之夜',
      'party': '派对',
      'celebration': '庆典',
      'gathering': '聚会',
      'meetup': '见面会',
      'tasting': '品鉴会',
      'dinner': '晚宴',
      'brunch': '早午餐',
      'gala': '晚会'
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

    // 添加emoji（按优先级匹配）
    let emoji = '';
    if (lowerTitle.includes('market') || lowerTitle.includes('fair')) emoji = '🛒';
    else if (lowerTitle.includes('festival') || lowerTitle.includes('carnival')) emoji = '🎉';
    else if (lowerTitle.includes('food') || lowerTitle.includes('dining') || lowerTitle.includes('taste')) emoji = '🍽️';
    else if (lowerTitle.includes('music') || lowerTitle.includes('concert')) emoji = '🎵';
    else if (lowerTitle.includes('art') || lowerTitle.includes('exhibition')) emoji = '🎨';
    else if (lowerTitle.includes('workshop') || lowerTitle.includes('class')) emoji = '📚';
    else if (lowerTitle.includes('party') || lowerTitle.includes('night')) emoji = '🎊';
    else if (lowerTitle.includes('tour') || lowerTitle.includes('walk')) emoji = '🚶';
    else if (lowerTitle.includes('wine') || lowerTitle.includes('beer')) emoji = '🍷';
    else if (lowerTitle.includes('halloween')) emoji = '🎃';
    else if (lowerTitle.includes('christmas') || lowerTitle.includes('holiday')) emoji = '🎄';

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
    const title = (event.title || '').toLowerCase();
    const description = (event.description_detail || event.description_preview || event.description || '').toLowerCase();

    // 1. 按优先级尝试匹配特殊模式
    const patterns = Object.entries(EVENT_PATTERNS).sort((a, b) => a[1].priority - b[1].priority);

    for (const [type, pattern] of patterns) {
      if (this.matchesPattern(title, description, pattern)) {
        return this.buildDescriptionFromPattern(event, pattern, title, description);
      }
    }

    // 2. 没有匹配特殊模式，使用通用特征提取
    return this.buildGenericDescription(title, description);
  }

  // 模式匹配
  matchesPattern(title, description, pattern) {
    const hasKeyword = pattern.keywords.some(kw => title.includes(kw) || description.includes(kw));
    if (!hasKeyword) return false;

    if (pattern.requiredKeywords) {
      return pattern.requiredKeywords.some(kw => title.includes(kw) || description.includes(kw));
    }

    return true;
  }

  // 从模式构建描述
  buildDescriptionFromPattern(event, pattern, title, description) {
    // 如果有固定描述，直接返回
    if (pattern.fixedDescription) {
      return pattern.fixedDescription;
    }

    // 提取特征
    const features = [];
    if (pattern.features) {
      for (const [regex, label] of Object.entries(pattern.features)) {
        const regexPattern = new RegExp(regex, 'i');
        if (regexPattern.test(title) || regexPattern.test(description)) {
          features.push(label);
        }
      }
    }

    // 如果找到特征，使用模板
    if (features.length > 0 && pattern.template) {
      return pattern.template.replace('{features}', features.join('、'));
    }

    // 否则使用fallback描述
    return pattern.fallbackDescription || this.buildGenericDescription(title, description);
  }

  // 构建通用描述
  buildGenericDescription(title, description) {
    const features = [];

    // 提取通用特征
    for (const category of Object.values(GENERIC_FEATURES)) {
      for (const [regex, label] of Object.entries(category)) {
        const regexPattern = new RegExp(regex, 'i');
        if (regexPattern.test(title) || regexPattern.test(description)) {
          if (!features.includes(label)) {
            features.push(label);
          }
        }
      }
    }

    if (features.length > 0) {
      return features.slice(0, 3).join('、') + '，精彩活动等你来';
    }

    return '社区活动，欢迎参加';
  }

  // 辅助方法：翻译单词
  translateWord(word) {
    const translations = {
      'vendors': '摊位',
      'artists': '艺术家',
      'food trucks': '美食卡车',
      'booths': '展位',
      'performers': '表演者',
      'bands': '乐队'
    };
    return translations[word.toLowerCase()] || word;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ContentTranslator;