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
2. 描述：这是最重要的部分！必须精心打造每一条描述：

   【描述创作要求】
   - 字数：15-25字（可适当突破18字限制以确保质量）
   - 内容来源：仔细阅读活动的标题和描述，提取真实、具体的信息
   - 必须包含：至少1-2个活动的具体特色、亮点或独特之处
   - 语言风格：小红书风格，热情、真实、有感染力，像朋友推荐
   - 使用技巧：善用感叹号、适当的网络用语（绝了/yyds/拉满等）

   【优秀示例】
   ✅ "金银岛海景BBQ派对！现场live band演出氛围绝了"（提取了地点特色、活动形式、音乐元素）
   ✅ "米其林大厨坐镇！20+美食摊位，吃货天堂来了"（突出主厨背景、规模、目标人群）
   ✅ "日落时分开启！湾区最美观景台配美酒美食"（时间特色、地点优势、体验感受）
   ✅ "免费入场！手工艺品+农场鲜货，周末遛娃首选"（价格优势、活动内容、适合人群）

   【避免的写法】
   ❌ "探索旧金山，发现城市新趣事！"（太空泛，没有具体信息）
   ❌ "免费咖啡，高效办公，氛围拉满！"（太笼统，缺乏独特性）
   ❌ "精彩活动不容错过"（毫无信息量）
   ❌ "有趣的周末活动"（模板化，不够吸引人）

   【创作流程】
   第一步：仔细阅读活动的英文标题和描述
   第二步：找出3-5个关键信息点（如：特色、亮点、场地、时间、价格、适合人群等）
   第三步：选取最吸引人的2-3个点组合成描述
   第四步：用小红书语言风格润色，增强感染力

3. 地点：原样保留，不要翻译
4. 时间格式：mm/dd(DayAbbr),HH:MMAM/PM （注意星期括号后有逗号）
   示例："10/10(Fri),6:30PM"
5. 价格：免费写"免费"，有具体价格保留原价格，无信息写"查看链接"

语言风格: 热情、真实、有感染力，像朋友在真诚推荐一个他觉得很棒的活动

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

    return `处理以下湾区活动信息为小红书格式。每个活动的描述必须独特、具体、有吸引力。

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
- 必须仔细阅读每个活动的标题和详细描述
- 提取具体信息：如活动特色、亮点、规模、嘉宾、场地优势、适合人群等
- 不要使用模板化的通用描述
- 每个活动的描述必须不同，反映其独特之处
- 描述应该让读者马上想去参加

返回JSON格式（不要markdown）:
{
  "events": [
    {
      "id": 0,
      "title_cn": "English Title + 中文翻译",
      "description_cn": "具体、吸引人的小红书风格描述",
      "location_cn": "原地点不翻译",
      "time_cn": "mm/dd(DayAbbr),HH:MMAM/PM",
      "price_cn": "价格或免费或查看链接"
    }
  ]
}

格式要求:
1. title_cn - 格式："emoji + English Title + 中文"
   示例："🥩 Meat Carnival 肉食嘉年华"
2. description_cn - 15-25字，基于活动实际内容，必须具体且有吸引力
   创作技巧：
   a) 找出活动最吸引人的2-3个点（如：明星嘉宾、独特体验、场地优势、价格优势等）
   b) 用小红书语言风格表达，增强感染力
   c) 善用感叹号和网络用语（绝了/yyds/拉满等）

   好的示例：
   - "米其林大厨现场烹饪！30+美食摊位吃货天堂"（具体数字+特色+目标人群）
   - "金门大桥脚下！日落瑜伽+冥想放松身心"（地点特色+活动内容+体验感受）
   - "免费品酒会！纳帕谷20款精选红酒等你来"（价格+产地+品种数量）

   避免的写法：
   - "探索旧金山，发现城市新趣事！"（空泛无物）
   - "精彩活动不容错过"（模板化）
   - "有趣的周末活动"（无信息量）

3. location_cn - 原样保留地点，不翻译
   示例："Treasure Island, San Francisco, CA"
4. time_cn - 格式：mm/dd(DayAbbr),HH:MMAM/PM （星期括号后有逗号）
   示例："10/10(Fri),6:30PM"
5. price_cn - 免费写"免费"，有价格就写，无信息写"查看链接"
   示例："$25-50" 或 "免费" 或 "查看链接"

完整示例:
输入活动:
  标题: "Treasure Island BBQ & Music Festival"
  描述: "Annual barbecue festival featuring local BBQ vendors, live bands, and stunning bay views. Over 20 food trucks and craft beer selection."
  地点: "Treasure Island, San Francisco, CA"

输出:
  title_cn: "🥩 Treasure Island BBQ & Music Festival 金银岛烧烤音乐节"
  description_cn: "20+美食卡车集结！现场乐队+海景BBQ派对"
  location_cn: "Treasure Island, San Francisco, CA"
  time_cn: "10/10(Fri),6:30PM"
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
    // 改进的小红书风格描述 - 更细致地提取具体信息
    const title = (event.title || '').toLowerCase();
    const description = (event.description || event.description_preview || '').toLowerCase();
    const location = (event.location || '').toLowerCase();
    const price = (event.price || '').toLowerCase();
    const type = event.event_type;

    // 提取数量信息（如"20+ vendors", "50 artists"等）
    const numberMatch = description.match(/(\d+)\+?\s*(vendors|artists|food trucks|booths|performers|bands)/i);
    const hasNumber = numberMatch ? `${numberMatch[1]}+${this.translateWord(numberMatch[2])}` : '';

    // 提取关键词及其组合
    let features = [];
    let venue = '';
    let priceFeature = '';

    // 价格优势
    if (price.includes('free') || price === '$0') {
      priceFeature = '免费入场';
    }

    // 场地特色
    if (location.includes('treasure island') || location.includes('island')) venue = '海岛美景';
    else if (location.includes('park')) venue = '公园户外';
    else if (location.includes('beach')) venue = '海滩';
    else if (location.includes('rooftop')) venue = '天台';
    else if (location.includes('downtown')) venue = '市中心';

    // 活动特色（更具体的匹配）
    if (title.includes('bbq') || description.includes('barbecue')) features.push('烧烤盛宴');
    else if (title.includes('food') || description.includes('dining') || description.includes('culinary')) features.push('美食');

    if (title.includes('music') || description.includes('live music') || description.includes('band')) features.push('现场音乐');
    if (title.includes('wine') || description.includes('wine tasting')) features.push('品酒');
    else if (title.includes('beer') || description.includes('craft beer')) features.push('精酿啤酒');

    if (title.includes('art') || description.includes('exhibition') || description.includes('gallery')) features.push('艺术展');
    if (description.includes('sunset') || description.includes('evening')) features.push('日落时分');
    if (description.includes('family') || description.includes('kids')) features.push('适合全家');
    if (description.includes('outdoor')) features.push('户外');
    if (title.includes('yoga') || title.includes('meditation')) features.push('瑜伽冥想');
    if (title.includes('market')) features.push('市集');
    if (title.includes('carnival') || title.includes('festival')) features.push('嘉年华');
    if (description.includes('dance') || description.includes('dancing')) features.push('舞蹈');

    // 活动亮点组合（优先级从高到低）
    const buildDescription = () => {
      // 优先：数量 + 特色 + 场地
      if (hasNumber && features.length > 0 && venue) {
        return `${hasNumber}集结！${features[0]}+${venue}享受`;
      }

      // 数量 + 特色
      if (hasNumber && features.length > 0) {
        return `${hasNumber}${features[0]}摊位！${features[1] || '吃喝玩乐'}一站式`;
      }

      // 价格 + 特色 + 场地
      if (priceFeature && features.length > 0 && venue) {
        return `${priceFeature}！${venue}${features[0]}体验`;
      }

      // 价格 + 特色组合
      if (priceFeature && features.length >= 2) {
        return `${priceFeature}！${features[0]}+${features[1]}双重享受`;
      }

      // 场地 + 特色组合
      if (venue && features.length >= 2) {
        return `${venue}${features[0]}！还有${features[1]}超赞`;
      }

      // 场地 + 单特色
      if (venue && features.length > 0) {
        return `${venue}${features[0]}！氛围感拉满`;
      }

      // 双特色组合
      if (features.length >= 2) {
        return `${features[0]}+${features[1]}！湾区周末新选择`;
      }

      // 单特色加强版
      if (features.length > 0) {
        const feature = features[0];
        if (feature.includes('音乐')) return '现场乐队演出！音乐氛围绝绝子';
        if (feature.includes('美食')) return '美食摊位超多！吃货天堂来了';
        if (feature.includes('烧烤')) return '户外BBQ派对！肉食爱好者必来';
        if (feature.includes('品酒')) return '精选佳酿品鉴！微醺周末时光';
        if (feature.includes('艺术')) return '艺术作品展览！文艺青年打卡地';
        if (feature.includes('市集')) return '创意市集淘宝！周末遛弯好去处';
        return `${feature}活动！值得一去`;
      }

      // 仅价格优势
      if (priceFeature) {
        return `${priceFeature}！这么好的机会别错过`;
      }

      // 基于类型的描述（最后备选）
      const typeDescriptions = {
        'market': '创意手工市集！周末淘宝好去处',
        'festival': '社区嘉年华！美食音乐娱乐全有',
        'food': '美食节来袭！各种美味等你品尝',
        'music': '音乐现场！感受live音乐魅力',
        'free': '免费活动！周末出门好选择',
        'art': '艺术展览！提升审美拍照打卡',
        'fair': '主题博览会！有趣又涨知识',
        'nightlife': '夜生活开启！氛围感直接拉满',
        'sports': '运动健身活动！活力满满',
        'community': '社区聚会！认识新朋友好机会'
      };

      return typeDescriptions[type] || '湾区特色活动！周末可以安排';
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