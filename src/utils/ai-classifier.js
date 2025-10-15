const AIService = require('./ai-service');
const config = require('../config');

class AIEventClassifier {
  constructor() {
    this.aiService = new AIService();
    
    // 检查是否有可用的AI提供商
    const available = this.aiService.getAvailableProviders();
    if (available.length === 0) {
      console.warn('⚠️ No AI provider is configured. Using fallback classification only.');
      console.warn('For better results, set up at least one: OPENAI_API_KEY, GEMINI_API_KEY, or CLAUDE_API_KEY');
      this.aiAvailable = false;
    } else {
      this.aiAvailable = true;
      console.log(`AI Classifier initialized with provider: ${this.aiService.provider}`);
      if (available.length > 1) {
        console.log(`Fallback providers available: ${available.filter(p => p !== this.aiService.provider).join(', ')}`);
      }
    }
  }

  async classifyEvents(events) {
    if (!this.aiAvailable) {
      console.log(`Classifying ${events.length} events using fallback method (no AI available)...`);
      return events.map(event => this.fallbackClassification(event));
    }

    console.log(`Classifying ${events.length} events with AI...`);
    
    const classifiedEvents = [];
    const batchSize = 5; // 每批处理5个事件，避免token超限
    
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      try {
        const batchResults = await this.classifyEventBatch(batch);
        classifiedEvents.push(...batchResults);
      } catch (error) {
        console.error(`Failed to classify batch ${i / batchSize + 1}:`, error.message);
        // 如果AI分类失败，使用fallback分类
        const fallbackResults = batch.map(event => this.fallbackClassification(event));
        classifiedEvents.push(...fallbackResults);
      }
    }
    
    return classifiedEvents;
  }

  async classifyEventBatch(events) {
    const eventsData = events.map((event, index) => ({
      id: index,
      title: event.title,
      description: event.description || '',
      location: event.location,
      price: event.price || ''
    }));

    const prompt = this.buildClassificationPrompt(eventsData);
    
    const messages = [
      {
        role: 'system',
        content: `You are an expert event classifier for Bay Area events.
        Classify events based on these priority categories (highest to lowest):
        1. market/fair/festival - Large community events (priority 10)
        2. free events - Any free admission events (priority 9)
        3. food events - Dining, tastings, food festivals (priority 6)
        4. art events - Galleries, exhibitions (priority 5)
        5. tech events - Tech meetups, conferences (priority 5)
        6. music events - Concerts, shows (priority 4)
        7. other events (priority 3)

        IMPORTANT: Prioritize large-scale public events (markets, fairs, festivals) and free events.
        Music concerts should generally be lower priority unless they are major festivals.

        Also identify if events are relevant to Chinese-speaking community in Bay Area.
        Return valid JSON only.`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await this.aiService.chatCompletion(messages, {
      temperature: 0.1,
      maxTokens: 1000
    });

    console.log(`Classification completed using ${response.provider} (${response.model})`);
    if (response.fallbackUsed) {
      console.log(`⚠️  Fallback provider used. Original: ${response.originalProvider}`);
    }

    const aiResult = JSON.parse(response.content);
    
    // 将AI分类结果映射回原始事件
    const classifiedEvents = events.map((event, index) => {
      const classification = aiResult.events.find(e => e.id === index);
      if (classification) {
        return {
          ...event,
          eventType: classification.category,
          priority: config.eventTypePriority[classification.category] || config.eventTypePriority.default,
          aiConfidence: classification.confidence || 0.5,
          chineseRelevant: classification.chineseRelevant || false,
          aiReasoning: classification.reasoning || ''
        };
      } else {
        return this.fallbackClassification(event);
      }
    });

    return classifiedEvents;
  }

  buildClassificationPrompt(eventsData) {
    return `
Please classify these Bay Area events and return a JSON response:

${eventsData.map(event => `
Event ${event.id}:
Title: ${event.title}
Description: ${event.description}
Location: ${event.location}
Price: ${event.price}
`).join('\n')}

Return JSON in this exact format:
{
  "events": [
    {
      "id": 0,
      "category": "market|fair|festival|food|music|free|art|tech|other",
      "confidence": 0.8,
      "chineseRelevant": true|false,
      "reasoning": "Brief explanation of classification"
    }
  ]
}

Classification rules (in priority order):
1. "market" (priority 10): farmers markets, artisan markets, craft fairs, vendor markets
2. "fair" (priority 10): trade fairs, expos, community fairs, outdoor fairs
3. "festival" (priority 10): cultural festivals, street festivals, celebration events, large public gatherings
4. "free" (priority 9): ANY event with free admission - this is HIGH priority!
5. "food" (priority 6): restaurant events, food tastings, wine/beer tastings, dining experiences
6. "art" (priority 5): gallery openings, art exhibitions, museum events
7. "tech" (priority 5): tech meetups, startup events, coding workshops
8. "music" (priority 4): concerts, live music, DJ shows, club events (lower priority)
9. "other" (priority 3): everything else

IMPORTANT NOTES:
- If an event is FREE, classify it as "free" regardless of other categories
- Large public events (markets/fairs/festivals) get highest priority
- Regular music concerts are LOWER priority unless part of a major festival
- Prioritize events with broad community appeal over niche performances

Mark "chineseRelevant: true" if the event would likely appeal to Chinese-speaking residents (cultural events, popular venues, family-friendly activities, food events, etc.)
`;
  }

  fallbackClassification(event) {
    // 基础分类逻辑作为AI失败时的后备
    const title = (event.title + ' ' + (event.description || '')).toLowerCase();

    let eventType = 'other';
    let priority = config.eventTypePriority.default;

    // 简单关键词匹配 - 按优先级顺序检查
    // 先检查是否免费（最高优先级之一）
    if (/free|complimentary|no cost/i.test(title) || (event.price && /free|$0/i.test(event.price))) {
      eventType = 'free';
      priority = config.eventTypePriority.free;
    }
    // 检查大型活动（最高优先级）
    else if (/market|farmer|artisan|craft|vendor/i.test(title)) {
      eventType = 'market';
      priority = config.eventTypePriority.market;
    } else if (/fair|expo/i.test(title)) {
      eventType = 'fair';
      priority = config.eventTypePriority.fair;
    } else if (/festival|fest|celebration|carnival/i.test(title)) {
      eventType = 'festival';
      priority = config.eventTypePriority.festival;
    }
    // 中等优先级
    else if (/food|dining|restaurant|culinary|taste|wine|beer/i.test(title)) {
      eventType = 'food';
      priority = config.eventTypePriority.food;
    } else if (/art|gallery|museum|exhibition/i.test(title)) {
      eventType = 'art';
      priority = config.eventTypePriority.art;
    } else if (/tech|startup|coding|developer|hackathon/i.test(title)) {
      eventType = 'tech';
      priority = config.eventTypePriority.tech;
    }
    // 音乐活动优先级较低
    else if (/music|concert|band|dj|performance|show/i.test(title)) {
      eventType = 'music';
      priority = config.eventTypePriority.music;
    }

    return {
      ...event,
      eventType,
      priority,
      aiConfidence: 0.3, // 低置信度表示这是fallback分类
      chineseRelevant: false,
      aiReasoning: 'Fallback keyword-based classification'
    };
  }

  // 根据用户偏好对事件进行排序
  sortEventsByPriority(events) {
    return events.sort((a, b) => {
      // 首先按优先级排序（高到低）
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // 相同优先级的情况下，中国社区相关的排前面
      if (a.chineseRelevant !== b.chineseRelevant) {
        return b.chineseRelevant ? 1 : -1;
      }
      
      // 最后按AI置信度排序
      return (b.aiConfidence || 0) - (a.aiConfidence || 0);
    });
  }

  // 选择最佳候选事件
  selectTopCandidates(events, maxCount = config.scraping.totalCandidatesForReview) {
    // 首先过滤掉music类型的活动
    const filteredEvents = events.filter(event => event.eventType !== 'music');

    console.log(`  Filtered out ${events.length - filteredEvents.length} music events`);
    console.log(`  Remaining events: ${filteredEvents.length}`);

    const sortedEvents = this.sortEventsByPriority(filteredEvents);

    // 确保类型多样性
    const selectedEvents = [];
    const typeCount = {};

    for (const event of sortedEvents) {
      if (selectedEvents.length >= maxCount) break;

      const eventType = event.eventType;
      const currentCount = typeCount[eventType] || 0;

      // 限制每种类型的最大数量，确保多样性
      const maxPerType = Math.max(2, Math.floor(maxCount / 4));

      if (currentCount < maxPerType || selectedEvents.length < maxCount * 0.8) {
        selectedEvents.push(event);
        typeCount[eventType] = currentCount + 1;
      }
    }

    // 如果还没达到目标数量，添加剩余的高优先级事件
    if (selectedEvents.length < maxCount) {
      for (const event of sortedEvents) {
        if (selectedEvents.length >= maxCount) break;
        if (!selectedEvents.includes(event)) {
          selectedEvents.push(event);
        }
      }
    }

    console.log(`  Selected ${selectedEvents.length} candidates (excluding music)`);

    return selectedEvents.slice(0, maxCount);
  }

  // 生成分类报告
  generateClassificationReport(events) {
    const typeCount = {};
    const priorityCount = {};
    let chineseRelevantCount = 0;
    
    events.forEach(event => {
      typeCount[event.eventType] = (typeCount[event.eventType] || 0) + 1;
      priorityCount[event.priority] = (priorityCount[event.priority] || 0) + 1;
      if (event.chineseRelevant) chineseRelevantCount++;
    });
    
    return {
      totalEvents: events.length,
      eventTypes: typeCount,
      priorityLevels: priorityCount,
      chineseRelevant: chineseRelevantCount,
      topPriorityEvents: events.filter(e => e.priority >= 7).length
    };
  }
}

module.exports = AIEventClassifier;