/**
 * ConfigurableScraper - 配置驱动的通用爬虫
 * 支持CSS选择器和AI提取两种方式
 */

const BaseScraper = require('./base-scraper');
const UniversalScraper = require('../utils/universal-scraper');
const { format, parseISO } = require('date-fns');

class ConfigurableScraper extends BaseScraper {
  constructor(sourceConfig) {
    // 创建一个临时的source config来满足BaseScraper的要求
    const tempSourceConfig = {
      name: sourceConfig.name,
      baseUrl: sourceConfig.listUrl || sourceConfig.url
    };

    // 如果config中没有这个source，先添加一个临时的
    const config = require('../config');
    if (!config.eventSources.find(s => s.name === sourceConfig.name)) {
      config.eventSources.push(tempSourceConfig);
    }

    // 调用父类构造函数
    super(sourceConfig.name);
    this.config = sourceConfig;
    this.universalScraper = new UniversalScraper();
  }

  /**
   * 主抓取方法 - 根据配置选择CSS或AI方式
   */
  async scrapeEvents(weekRange) {
    console.log(`\n🔄 [${this.config.displayName}] Starting scrape...`);
    console.log(`   Method: ${this.config.extractionType ? 'AI' : 'CSS'}`);
    console.log(`   URL: ${this.config.listUrl || this.config.url}`);

    try {
      let events = [];

      // 判断使用CSS还是AI
      if (this.config.extractionType) {
        // AI抓取
        events = await this.scrapeWithAI(weekRange);
      } else {
        // CSS抓取
        events = await this.scrapeWithCSS(weekRange);
      }

      console.log(`✅ [${this.config.displayName}] Found ${events.length} events`);
      return events;

    } catch (error) {
      console.error(`❌ [${this.config.displayName}] Error: ${error.message}`);
      return [];
    }
  }

  /**
   * CSS方式抓取
   */
  async scrapeWithCSS(weekRange) {
    const url = this.config.listUrl;
    const events = [];

    console.log(`   Loading page (wait: ${this.config.waitTime || 2000}ms)...`);

    // 加载页面
    const $ = await this.fetchPage(url);

    // 额外等待时间（如果配置了）
    if (this.config.waitTime && this.config.waitTime > 2000) {
      await this.delay(this.config.waitTime - 2000);
    }

    const containers = $(this.config.selectors.container);
    console.log(`   Found ${containers.length} event containers`);

    // 提取每个事件
    for (let i = 0; i < containers.length; i++) {
      const $container = containers.eq(i);

      try {
        const rawEvent = this.extractEventFromContainer($, $container);

        // 应用过滤器
        if (this.shouldSkipEvent(rawEvent)) {
          continue;
        }

        // 如果需要访问详情页
        if (this.config.needsDetailPage && rawEvent.originalUrl) {
          const detailEvent = await this.fetchEventDetails(rawEvent);
          if (detailEvent) {
            events.push(detailEvent);
          }
        } else {
          events.push(rawEvent);
        }

      } catch (error) {
        console.warn(`   ⚠️  Error extracting event ${i}: ${error.message}`);
      }
    }

    // 时间过滤和规范化（使用BaseScraper的方法，与其他scrapers保持一致）
    const validEvents = [];
    for (const event of events) {
      // 1. 时间验证
      if (!this.isValidEventTime(event.startTime, weekRange)) {
        console.log(`   ⏰ 跳过（时间不在范围）: ${event.title} (${event.startTime || 'no date'})`);
        continue;
      }

      // 2. 规范化事件数据（清理location等）
      const normalizedEvent = this.normalizeEvent(event, weekRange);
      validEvents.push(normalizedEvent);
    }

    console.log(`   ⏰ 时间过滤: ${events.length} → ${validEvents.length} 个活动`);
    return validEvents;
  }

  /**
   * 从容器中提取事件信息
   */
  extractEventFromContainer($, $container) {
    const selectors = this.config.selectors;

    // 提取标题
    let title = '';
    if (selectors.title) {
      title = $container.find(selectors.title).first().text().trim();
    }

    // 提取链接
    let originalUrl = '';
    if (selectors.link) {
      const link = $container.find(selectors.link).first().attr('href');
      if (link) {
        // 处理相对路径
        if (link.startsWith('http')) {
          originalUrl = link;
        } else if (link.startsWith('/')) {
          const baseUrl = new URL(this.config.listUrl);
          originalUrl = `${baseUrl.protocol}//${baseUrl.host}${link}`;
        } else {
          const baseUrl = new URL(this.config.listUrl);
          originalUrl = `${baseUrl.protocol}//${baseUrl.host}/${link}`;
        }
      }
    }

    // 提取日期
    let startTime = null;
    if (selectors.date) {
      const dateText = $container.find(selectors.date).first().text().trim();
      const dateAttr = $container.find(selectors.date).first().attr('datetime');

      if (dateAttr) {
        try {
          startTime = new Date(dateAttr).toISOString();
        } catch (e) {
          // 继续尝试解析文本
        }
      }

      if (!startTime && dateText) {
        try {
          startTime = new Date(dateText).toISOString();
        } catch (e) {
          // 日期解析失败，在详情页再试
        }
      }
    }

    // 提取地点（不使用fallback，找不到就留空，让BaseScraper的normalizeEvent处理）
    let location = '';
    if (selectors.location) {
      location = this.extractCleanLocation($, $container, [selectors.location], '');
    }

    // 提取描述
    let description = '';
    if (selectors.description) {
      description = $container.find(selectors.description).first().text().trim();
    }

    return {
      title,
      startTime,
      endTime: null,
      location,
      price: null,
      description,
      originalUrl
    };
  }

  /**
   * 获取详情页信息
   */
  async fetchEventDetails(rawEvent) {
    try {
      console.log(`   📄 Fetching details: ${rawEvent.originalUrl}`);

      const $ = await this.fetchPage(rawEvent.originalUrl);

      // 使用详情页选择器
      const detailSelectors = this.config.detailSelectors || this.config.selectors;

      const detailEvent = {
        ...rawEvent
      };

      // 更新标题（如果详情页有更好的）
      if (detailSelectors.title) {
        const detailTitle = $(detailSelectors.title).first().text().trim();
        if (detailTitle && detailTitle.length > rawEvent.title.length) {
          detailEvent.title = detailTitle;
        }
      }

      // 更新日期
      if (detailSelectors.date && !rawEvent.startTime) {
        const dateText = $(detailSelectors.date).first().text().trim();
        const dateAttr = $(detailSelectors.date).first().attr('datetime');

        if (dateAttr) {
          try {
            detailEvent.startTime = new Date(dateAttr).toISOString();
          } catch (e) {}
        } else if (dateText) {
          try {
            detailEvent.startTime = new Date(dateText).toISOString();
          } catch (e) {}
        }
      }

      // 更新地点（不使用fallback）
      if (detailSelectors.location && !rawEvent.location) {
        detailEvent.location = this.extractCleanLocation($, $('body'), [detailSelectors.location], '');
      }

      // 提取价格
      if (detailSelectors.price) {
        const priceText = $(detailSelectors.price).first().text().trim();
        detailEvent.price = this.normalizePrice(priceText, detailEvent.title, detailEvent.description);
      }

      // 更新描述
      if (detailSelectors.description) {
        const detailDesc = $(detailSelectors.description).first().text().trim();
        if (detailDesc && detailDesc.length > (rawEvent.description || '').length) {
          detailEvent.description = detailDesc;
        }
      }

      return detailEvent;

    } catch (error) {
      console.warn(`   ⚠️  Failed to fetch details: ${error.message}`);
      return rawEvent; // 返回基本信息
    }
  }

  /**
   * AI方式抓取
   */
  async scrapeWithAI(weekRange) {
    const url = this.config.url;
    const events = [];

    console.log(`   Using AI extraction (type: ${this.config.extractionType})...`);

    try {
      if (this.config.extractionType === 'list') {
        // 一次性提取多个活动
        const extractedEvents = await this.universalScraper.scrapeListPageWithAI(url);
        events.push(...extractedEvents);
      } else {
        // 提取单个活动
        const event = await this.universalScraper.scrapeWithAI(url);
        if (event) {
          events.push(event);
        }
      }

      console.log(`   AI extracted ${events.length} events`);
      return events;

    } catch (error) {
      console.error(`   ❌ AI extraction failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 判断是否应该跳过这个事件
   */
  shouldSkipEvent(event) {
    const titleLower = (event.title || '').toLowerCase().trim();

    // 通用验证规则（适用于所有源）
    // 1. 过滤无效标题（导航、UI元素等）
    const invalidTitles = [
      'make your plans',
      'upcoming events',
      'calendar',
      'subscribe',
      'contact us',
      'more events',
      'view all',
      'load more',
      'show more',
      'event calendar',
      'all events'
    ];

    if (invalidTitles.some(invalid => titleLower === invalid || titleLower.includes(invalid))) {
      console.log(`   ⚠️  跳过（无效标题）: ${event.title}`);
      return true;
    }

    // 2. 标题太短（可能是UI元素）
    if (titleLower.length < 5) {
      console.log(`   ⚠️  跳过（标题太短）: ${event.title}`);
      return true;
    }

    // 3. 必须有URL（没有URL可能是占位符）
    if (!event.originalUrl || event.originalUrl.trim().length === 0) {
      console.log(`   ⚠️  跳过（无URL）: ${event.title}`);
      return true;
    }

    // 配置化的过滤规则（可选）
    if (this.config.filters) {
      const filters = this.config.filters;

      // 检查标题长度
      if (filters.minTitleLength && event.title.length < filters.minTitleLength) {
        return true;
      }

      // 检查是否在跳过列表中
      if (filters.skipTitles) {
        for (const skipTitle of filters.skipTitles) {
          if (event.title.toLowerCase().includes(skipTitle.toLowerCase())) {
            console.log(`   ⏭️  跳过（配置过滤）: "${event.title}" (matches: "${skipTitle}")`);
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 检查是否应该在当前月份抓取此源
   */
  static shouldScrapeInMonth(sourceConfig, currentMonth) {
    // 如果没有activeMonths限制，总是抓取
    if (!sourceConfig.activeMonths) {
      return true;
    }

    // 检查当前月份是否在activeMonths中
    return sourceConfig.activeMonths.includes(currentMonth);
  }
}

module.exports = ConfigurableScraper;
