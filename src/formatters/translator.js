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

2. 描述：这是最重要的部分！

   【描述创作要求】
   - 字数：必须20-35字，不能太短
   - 内容来源：从活动详细描述中提炼活动内容本身的特色和亮点
   - 严禁重复：不要提时间（几点）、地点名称（哪里）、价格（多少钱/免费）
   - 专注描述：活动具体内容、有什么摊位/表演/展品、怎么体验、特色是什么
   - 语言风格：真诚、务实、朴实，像朋友在客观介绍活动内容
   - 表达方式：陈述活动实际内容，少用夸张词汇，避免煽动性语言

   【优秀示例 - 专注活动内容】
   ✅ "20多个本地BBQ餐厅摊位，有现场乐队表演"（活动规模+内容形式）
   ✅ "手工艺品、有机农产品、现烤面包，可以试吃"（商品类型+体验）
   ✅ "本地艺术家的绘画和雕塑作品，可以和创作者交流"（展览内容+互动）
   ✅ "瑜伽课程配冥想引导，提供瑜伽垫，适合初学者"（活动形式+提供物品+适合人群）
   ✅ "精酿啤酒试饮，10多个本地酒厂，有小食搭配"（主要内容+规模+配套）

   【避免的写法】
   ❌ "在Mission District体验" "在Grant Avenue举办" "日落时分" "免费入场"（重复地点时间价格）
   ❌ "品尝各种威士忌" "聚集各种艺术作品"（太笼统，没说具体有什么）
   ❌ "来参加万圣节派对吧"（字数太少，无实质内容）
   ❌ "氛围绝了" "超嗨" "拉满" "天堂" "必打卡"（夸张煽动词汇）
   ❌ "精彩活动不容错过"（模板化无信息量）

   【创作流程】
   第一步：仔细阅读活动的详细描述（description字段）
   第二步：从描述中提取活动内容相关信息：有什么、做什么、看什么、特色是什么
   第三步：排除时间、地点、价格等信息（这些已有独立字段）
   第四步：用2-3句话客观陈述活动的实际内容
   第五步：检查是否有夸张词语，替换为平实表述

3. 地点：原样保留，不要翻译
4. 时间格式：mm/dd(DayAbbr),HH:MMAM/PM （注意星期括号后有逗号）
   示例："10/10(Fri),6:30PM"
5. 价格：免费写"免费"，有具体价格保留原价格，无信息写"查看链接"

语言风格: 真诚、务实、客观，专注于介绍活动内容本身

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

    return `处理以下湾区活动信息为小红书格式。描述要从活动详细内容中提炼，专注活动本身。

活动列表:
${eventsData.map(event => `
【活动 ${event.id}】
标题: ${event.title}
详细描述: ${event.description || '(无详细描述)'}
地点: ${event.location}
时间: ${event.time_display}
价格: ${event.price || '(无价格信息)'}
分类: ${event.event_type || '(无分类)'}
`).join('\n---\n')}

⚠️ 特别注意描述的创作：
- 仔细阅读"详细描述"字段，从中提炼活动内容
- 描述要专注于活动内容本身：有什么、做什么、看什么、体验什么
- 不要重复时间、地点、价格信息（这些已有独立字段显示）
- 用平实语言陈述活动实际内容，避免夸张煽动词汇
- 每个活动根据其详细描述提炼独特内容

返回JSON格式（不要markdown）:
{
  "events": [
    {
      "id": 0,
      "title_cn": "English Title + 中文翻译",
      "description_cn": "从详细描述中提炼的活动内容，20-35字",
      "location_cn": "原地点不翻译",
      "time_cn": "mm/dd(DayAbbr),HH:MMAM/PM",
      "price_cn": "价格或免费或查看链接"
    }
  ]
}

格式要求:
1. title_cn - 格式："emoji + English Title + 中文"
   示例："🥩 Meat Carnival 肉食嘉年华"

2. description_cn - 必须20-35字，从详细描述中提炼活动具体内容
   创作原则：
   a) 从"详细描述"中提取活动的实际内容和特色（不能太笼统）
   b) 具体描述：有哪些摊位/表演者/展品/课程，什么体验，有什么特色
   c) 严禁提及：时间（几点）、地点名称（哪里）、价格（免费/多少钱）
   d) 避免笼统表述（如"各种""一些"），要具体
   e) 避免夸张词汇和煽动性语言

   好的示例（具体且不重复信息）：
   - "精选苏格兰麦芽威士忌品鉴，专业讲解威士忌历史和制作工艺"（具体内容+体验）
   - "本地艺术家的绘画雕塑和手工艺品，可以和创作者面对面交流"（具体类型+互动）
   - "万圣节主题服装比赛，有DJ现场，提供特调鸡尾酒和小吃"（活动项目+提供内容）
   - "户外瑜伽课程配冥想引导，提供瑜伽垫，适合初学者参加"（课程内容+提供物+适合人群）

   避免的写法：
   - "在Mission District体验威士忌节，品尝各种威士忌"（提到地点+太笼统）
   - "社区艺术市集，聚集各种艺术作品"（太笼统，没说具体有什么）
   - "来参加万圣节派对吧"（字数太少，无实质内容）
   - "氛围绝了" "超嗨" "拉满"（夸张煽动）

3. location_cn - 原样保留地点，不翻译
   示例："Treasure Island, San Francisco, CA"

4. time_cn - 格式：mm/dd(DayAbbr),HH:MMAM/PM （星期括号后有逗号）
   示例："10/10(Fri),6:30PM"

5. price_cn - 免费写"免费"，有价格就写，无信息写"查看链接"
   示例："$25-50" 或 "免费" 或 "查看链接"

完整示例:
输入活动:
  标题: "Treasure Island BBQ & Music Festival"
  详细描述: "Annual barbecue festival featuring local BBQ vendors, live bands, and stunning bay views. Over 20 food trucks and craft beer selection."
  地点: "Treasure Island, San Francisco, CA"
  时间: "10/10(Sat), 6:00 PM"
  价格: "See event page"

输出:
  title_cn: "🥩 Treasure Island BBQ & Music Festival 金银岛烧烤音乐节"
  description_cn: "20多个本地BBQ餐厅的美食卡车，有现场乐队表演，提供精酿啤酒"
  （注意：没有提"在Treasure Island" "6:00PM开始" "查看价格"等已有信息）
  location_cn: "Treasure Island, San Francisco, CA"
  time_cn: "10/10(Sat),6:00PM"
  price_cn: "查看链接"`;
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
    // 专注活动内容的描述 - 不重复时间地点价格
    const title = (event.title || '').toLowerCase();
    const description = (event.description || event.description_preview || '').toLowerCase();
    const type = event.event_type;

    // 提取数量信息（如"20+ vendors", "50 artists"等）
    const numberMatch = description.match(/(\d+)\+?\s*(vendors|artists|food trucks|booths|performers|bands)/i);
    const hasNumber = numberMatch ? `${numberMatch[1]}多个${this.translateWord(numberMatch[2])}` : '';

    // 提取活动内容特色
    let contentFeatures = [];

    // 活动内容（不是地点或时间）
    if (title.includes('bbq') || description.includes('barbecue')) contentFeatures.push('BBQ烧烤摊位');
    else if (title.includes('food') || description.includes('dining') || description.includes('culinary')) contentFeatures.push('美食摊位');

    if (title.includes('music') || description.includes('live music') || description.includes('band')) contentFeatures.push('现场乐队');
    if (title.includes('wine') || description.includes('wine tasting')) contentFeatures.push('葡萄酒品鉴');
    else if (title.includes('beer') || description.includes('craft beer')) contentFeatures.push('精酿啤酒');

    if (title.includes('art') || description.includes('exhibition') || description.includes('gallery')) contentFeatures.push('艺术作品展');
    if (description.includes('craft') || description.includes('handmade')) contentFeatures.push('手工艺品');
    if (description.includes('family') || description.includes('kids')) contentFeatures.push('适合家庭参与');
    if (title.includes('yoga') || title.includes('meditation')) contentFeatures.push('瑜伽冥想课程');
    if (title.includes('market')) contentFeatures.push('市集摊位');
    if (description.includes('dance') || description.includes('dancing')) contentFeatures.push('舞蹈表演');
    if (description.includes('food truck')) contentFeatures.push('美食卡车');
    if (description.includes('local vendor')) contentFeatures.push('本地商家');

    // 构建描述（只描述活动内容，不提地点时间价格）
    const buildDescription = () => {
      // 数量 + 双特色
      if (hasNumber && contentFeatures.length >= 2) {
        return `${hasNumber}，有${contentFeatures[0]}和${contentFeatures[1]}`;
      }

      // 数量 + 单特色
      if (hasNumber && contentFeatures.length > 0) {
        return `${hasNumber}，主要是${contentFeatures[0]}`;
      }

      // 三个特色
      if (contentFeatures.length >= 3) {
        return `有${contentFeatures[0]}、${contentFeatures[1]}和${contentFeatures[2]}`;
      }

      // 双特色
      if (contentFeatures.length >= 2) {
        return `有${contentFeatures[0]}和${contentFeatures[1]}`;
      }

      // 单特色展开描述
      if (contentFeatures.length > 0) {
        const feature = contentFeatures[0];
        if (feature.includes('乐队')) return '有现场乐队演出';
        if (feature.includes('美食')) return '本地餐厅和小吃摊位';
        if (feature.includes('BBQ')) return '各种烧烤美食';
        if (feature.includes('品鉴')) return '多款葡萄酒试饮';
        if (feature.includes('艺术')) return '本地艺术家的绘画雕塑作品';
        if (feature.includes('市集')) return '手工艺品和农场新鲜产品';
        if (feature.includes('瑜伽')) return '户外瑜伽和冥想练习';
        if (feature.includes('舞蹈')) return '舞蹈演出和互动';
        return feature;
      }

      // 基于类型的内容描述（避免提地点时间）
      const typeDescriptions = {
        'market': '各类手工艺品、农产品摊位',
        'festival': '美食、音乐和娱乐活动',
        'food': '多家餐厅的特色美食',
        'music': '音乐演出和表演',
        'art': '艺术作品展览',
        'fair': '主题展览和互动体验',
        'nightlife': '夜间娱乐活动',
        'sports': '运动和健身项目',
        'community': '社区交流活动',
        'free': '社区活动'
      };

      return typeDescriptions[type] || '本地社区活动';
    };

    return buildDescription();
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