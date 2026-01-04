/**
 * RestApiScraper - REST API 抓取器基类
 * 用于通过 REST API 获取事件数据
 */

const BaseScraper = require('./base-scraper');
const axios = require('axios');
const { format } = require('date-fns');

class RestApiScraper extends BaseScraper {
  constructor(sourceConfig) {
    // 创建一个临时的 source config 来满足 BaseScraper 的要求
    const tempSourceConfig = {
      name: sourceConfig.name,
      baseUrl: sourceConfig.baseUrl
    };

    // 如果 config 中没有这个 source，先添加一个临时的
    const config = require('../config');
    if (!config.eventSources.find(s => s.name === sourceConfig.name)) {
      config.eventSources.push(tempSourceConfig);
    }

    // 调用父类构造函数
    super(sourceConfig.name);
    this.config = sourceConfig;
  }

  /**
   * 主抓取方法
   */
  async scrapeEvents(weekRange) {
    console.log(`\n🔄 [${this.config.displayName}] Starting API scrape...`);
    console.log(`   API Type: ${this.config.apiType}`);
    console.log(`   Endpoint: ${this.config.baseUrl}${this.config.apiEndpoint}`);

    try {
      const events = await this.fetchEventsFromAPI(weekRange);
      console.log(`✅ [${this.config.displayName}] Found ${events.length} events`);
      return events;
    } catch (error) {
      console.error(`❌ [${this.config.displayName}] Error: ${error.message}`);
      return [];
    }
  }

  /**
   * 从 API 获取事件数据
   */
  async fetchEventsFromAPI(weekRange) {
    const url = this.config.baseUrl + this.config.apiEndpoint;
    const params = { ...this.config.apiParams };

    // 添加日期筛选参数
    if (this.config.supportsDateFiltering && weekRange) {
      const startDateParam = this.config.dateParams.start;
      const endDateParam = this.config.dateParams.end;

      params[startDateParam] = format(weekRange.start, 'yyyy-MM-dd');
      params[endDateParam] = format(weekRange.end, 'yyyy-MM-dd');

      console.log(`   Date range: ${params[startDateParam]} to ${params[endDateParam]}`);
    }

    console.log(`   Fetching from API...`);

    const response = await axios.get(url, {
      params,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BayAreaEventsScraper/1.0)'
      }
    });

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = response.data;

    // 根据 API 类型解析数据
    let rawEvents = [];
    if (this.config.apiType === 'wordpress_events_calendar') {
      rawEvents = this.parseWordPressEventsCalendarAPI(data);
    } else {
      throw new Error(`Unknown API type: ${this.config.apiType}`);
    }

    console.log(`   Fetched ${rawEvents.length} events from API`);

    // 转换为标准格式并添加 weekIdentifier
    const events = rawEvents.map(event => {
      const transformed = this.transformEvent(event);
      // 添加 weekIdentifier
      if (weekRange && weekRange.identifier) {
        transformed.weekIdentifier = weekRange.identifier;
      }
      return transformed;
    });

    // 过滤和验证
    const validEvents = events.filter(event => this.validateEvent(event));

    console.log(`   Valid events: ${validEvents.length}/${events.length}`);

    return validEvents;
  }

  /**
   * 解析 WordPress Events Calendar REST API 响应
   */
  parseWordPressEventsCalendarAPI(data) {
    if (data.events && Array.isArray(data.events)) {
      return data.events;
    } else if (Array.isArray(data)) {
      return data;
    } else {
      throw new Error('Unexpected API response format');
    }
  }

  /**
   * 将 API 事件数据转换为标准格式
   * 子类需要实现此方法
   */
  transformEvent(apiEvent) {
    throw new Error('transformEvent() must be implemented by subclass');
  }

  /**
   * 验证事件数据
   */
  validateEvent(event) {
    // 必须有标题
    if (!event.title || event.title.trim().length < 3) {
      return false;
    }

    // 必须有开始时间
    if (!event.startTime) {
      return false;
    }

    // 必须有链接
    if (!event.originalUrl) {
      return false;
    }

    return true;
  }

  /**
   * 格式化日期时间
   */
  formatDateTime(dateStr, timeStr) {
    if (!dateStr) return null;

    // 如果已经是完整的日期时间字符串
    if (dateStr.includes(':') && !timeStr) {
      return dateStr;
    }

    // 组合日期和时间
    if (timeStr) {
      return `${dateStr} ${timeStr}`;
    }

    return dateStr;
  }

  /**
   * 清理 HTML 标签
   */
  stripHtml(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();
  }

  /**
   * 截取描述到指定长度
   */
  truncateDescription(text, maxLength = 500) {
    if (!text) return '';
    const cleaned = this.stripHtml(text);
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength).trim() + '...';
  }
}

module.exports = RestApiScraper;
