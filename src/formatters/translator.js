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

【其他格式】
• 标题: emoji + 英文 + 中文（如 "🥩 Meat Carnival 肉食嘉年华"）
• 时间: mm/dd(Day),HH:MMAM/PM
• 价格: 免费/原价格/查看链接
• 地点: 原样保留

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

返回JSON（不要markdown）:
{
  "events": [
    {
      "id": 0,
      "title_cn": "emoji + English Title + 中文",
      "description_cn": "从详细描述提取的40-80字丰富内容",
      "location_cn": "原地点",
      "time_cn": "mm/dd(Day),HH:MMAM/PM",
      "price_cn": "免费/价格/查看链接"
    }
  ]
}`;
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
    const title = (event.title || '').toLowerCase();
    const description = (event.description_detail || event.description_preview || event.description || '').toLowerCase();

    // 特殊类型优先处理

    // Diwali/排灯节
    if (title.includes('diwali') || description.includes('diwali')) {
      return '印度舞蹈和音乐表演，南亚美食摊位，Diwali点灯仪式';
    }

    // 万圣节活动
    if (title.includes('halloween') || title.includes('thrill-o-ween')) {
      let features = [];
      if (description.includes('costume') || title.includes('costume')) features.push('服装比赛');
      if (description.includes('movie') || description.includes('film')) features.push('恐怖电影');
      if (description.includes('trick') || description.includes('treat')) features.push('不给糖就捣蛋');
      if (description.includes('pumpkin')) features.push('南瓜雕刻');

      if (features.length > 0) {
        return features.join('、') + '，万圣节主题活动';
      }
      return '万圣节主题活动，服装打扮和互动游戏';
    }

    // Wedding Fair
    if (title.includes('wedding') && (title.includes('fair') || title.includes('expo'))) {
      return '婚纱礼服展示、婚礼策划咨询、摄影化妆摊位';
    }

    // 宠物活动
    if (title.includes('barks') || title.includes('dog') || title.includes('pet')) {
      return '宠物服装秀、狗狗互动游戏、拍照打卡';
    }

    // 音乐会/演出（有艺术家名）
    if (title.includes(' - ') || title.includes(' tour') || title.includes(' concert')) {
      const artistMatch = title.match(/^([^-]+)/);
      if (artistMatch) {
        const artist = artistMatch[1].trim();
        if (title.includes('jazz')) return `${artist}爵士音乐现场演出`;
        if (title.includes('classical') || title.includes('symphony')) return `${artist}古典音乐现场演奏会`;
        if (title.includes('rock')) return `${artist}摇滚音乐现场`;
        return `${artist}现场音乐演出`;
      }
    }

    // 话剧/戏剧
    if (title.includes('theatre') || title.includes('theater') || title.includes('play') ||
        title.includes('doll\'s house') || title.includes('opera')) {
      const playName = title.split(/\s*-\s*/)[0].trim();
      return `话剧作品《${playName}》舞台演出`;
    }

    // 摄影/相机工作坊
    if ((title.includes('photo') || title.includes('camera')) &&
        (title.includes('workshop') || title.includes('class'))) {
      return '摄影技巧教学、实地拍摄练习、构图技巧指导';
    }

    // 提取数量信息
    const numberMatch = description.match(/(\d+)\+?\s*(vendors|artists|food trucks|booths|performers|bands|exhibitors)/i);
    const hasNumber = numberMatch ? `${numberMatch[1]}多个${this.translateWord(numberMatch[2])}` : '';

    // 提取具体内容特色
    let contentFeatures = [];

    if (title.includes('whisky') || title.includes('whiskey')) contentFeatures.push('威士忌品鉴会');
    else if (title.includes('wine')) contentFeatures.push('葡萄酒品鉴');
    else if (title.includes('beer')) contentFeatures.push('精酿啤酒试饮');

    if (title.includes('bbq') || description.includes('barbecue')) contentFeatures.push('BBQ烧烤');
    else if (title.includes('food')) contentFeatures.push('美食摊位');

    if (description.includes('live music') || description.includes('band')) contentFeatures.push('现场乐队');
    if (description.includes('dance') || description.includes('dancing')) contentFeatures.push('舞蹈表演');
    if (description.includes('craft') || description.includes('handmade')) contentFeatures.push('手工艺品');
    if (description.includes('art') && description.includes('exhibition')) contentFeatures.push('艺术作品展');
    if (description.includes('family') || description.includes('kids')) contentFeatures.push('家庭友好');
    if (description.includes('yoga') || title.includes('yoga')) contentFeatures.push('瑜伽课程');

    // 构建描述
    if (hasNumber && contentFeatures.length >= 2) {
      return `${hasNumber}，${contentFeatures[0]}和${contentFeatures[1]}`;
    }
    if (hasNumber && contentFeatures.length > 0) {
      return `${hasNumber}，主要是${contentFeatures[0]}`;
    }
    if (contentFeatures.length >= 3) {
      return `${contentFeatures[0]}、${contentFeatures[1]}和${contentFeatures[2]}`;
    }
    if (contentFeatures.length >= 2) {
      return `${contentFeatures[0]}和${contentFeatures[1]}`;
    }
    if (contentFeatures.length > 0) {
      return contentFeatures[0];
    }

    // 最后的备选（基于标题关键词）
    if (title.includes('market')) return '本地艺术家和手工艺人摊位';
    if (title.includes('festival')) return '美食摊位、现场音乐和互动活动';
    if (title.includes('fair')) return '主题展览和互动体验';
    if (title.includes('art')) return '艺术作品展览';
    if (title.includes('music')) return '现场音乐演出';
    if (title.includes('night') && title.includes('market')) return '夜市摊位，美食和手工艺品';

    // 实在没信息时的通用描述
    return '查看活动详情';
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