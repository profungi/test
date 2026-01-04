/**
 * Configurable Scraper Manager
 * 管理所有配置驱动的爬虫
 */

const ConfigurableScraper = require('./configurable-scraper');
const SJDowntownApiScraper = require('./sjdowntown-api-scraper');
const sourcesConfig = require('../config/sources-config');

class ConfigurableScraperManager {
  constructor() {
    this.config = sourcesConfig;
  }

  /**
   * 获取所有启用的 REST API 源爬虫
   */
  getAPIScrapers() {
    if (!this.config.api_sources) {
      return [];
    }

    return this.config.api_sources
      .filter(source => source.enabled)
      .map(source => this.createApiScraper(source));
  }

  /**
   * 根据 API 类型创建相应的抓取器
   */
  createApiScraper(source) {
    switch (source.apiType) {
      case 'wordpress_events_calendar':
        return new SJDowntownApiScraper(source);
      default:
        throw new Error(`Unknown API type: ${source.apiType}`);
    }
  }

  /**
   * 获取所有启用的CSS源爬虫
   */
  getCSSScrapers() {
    if (!this.config.css_sources) {
      return [];
    }

    return this.config.css_sources
      .filter(source => source.enabled)
      .map(source => new ConfigurableScraper(source));
  }

  /**
   * 获取所有启用的AI源爬虫（考虑季节性）
   */
  getAIScrapers(currentMonth = null) {
    if (!this.config.ai_sources) {
      return [];
    }

    const month = currentMonth || new Date().getMonth() + 1; // 1-12

    return this.config.ai_sources
      .filter(source => source.enabled)
      .filter(source => ConfigurableScraper.shouldScrapeInMonth(source, month))
      .map(source => new ConfigurableScraper(source));
  }

  /**
   * 获取所有爬虫（API + CSS + AI，过滤季节性）
   */
  getAllScrapers(currentMonth = null) {
    const apiScrapers = this.getAPIScrapers();
    const cssScrapers = this.getCSSScrapers();
    const aiScrapers = this.getAIScrapers(currentMonth);

    console.log(`\n📋 Configured Scrapers:`);
    console.log(`   REST API sources: ${apiScrapers.length}`);
    console.log(`   CSS sources: ${cssScrapers.length}`);
    console.log(`   AI sources: ${aiScrapers.length} (filtered by month)`);

    return [...apiScrapers, ...cssScrapers, ...aiScrapers];
  }

  /**
   * 生成固定时间活动
   */
  generateRecurringEvents(weekRange) {
    const events = [];
    const { start, end } = weekRange;

    for (const config of this.config.recurring_events) {
      const weekEvents = this.generateEventsForWeek(config, start, end);
      events.push(...weekEvents);
    }

    console.log(`📅 Generated ${events.length} recurring events`);
    return events;
  }

  /**
   * 为某一周生成固定时间活动
   */
  generateEventsForWeek(eventConfig, weekStart, weekEnd) {
    const events = [];
    const currentMonth = weekStart.getMonth() + 1;

    // 检查是否在排除月份内
    if (eventConfig.excludeMonths && eventConfig.excludeMonths.includes(currentMonth)) {
      return events;
    }

    // 检查季节性限制
    if (eventConfig.startMonth && eventConfig.endMonth) {
      if (currentMonth < eventConfig.startMonth || currentMonth > eventConfig.endMonth) {
        return events;
      }
    }

    // 遍历这一周的每一天
    const current = new Date(weekStart);
    while (current <= weekEnd) {
      if (this.shouldGenerateEvent(eventConfig, current)) {
        events.push(this.createEventFromConfig(eventConfig, current));
      }
      current.setDate(current.getDate() + 1);
    }

    return events;
  }

  /**
   * 判断是否应该在某天生成活动
   */
  shouldGenerateEvent(config, date) {
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

    if (config.frequency === 'weekly') {
      // 每周固定星期几
      return dayOfWeek === config.dayOfWeek;
    }

    if (config.frequency === 'monthly') {
      // 每月第N个星期X
      if (dayOfWeek !== config.dayOfWeek) {
        return false;
      }

      // 计算是本月第几个这个星期几
      const weekOfMonth = Math.ceil(date.getDate() / 7);
      return weekOfMonth === config.weekOfMonth;
    }

    return false;
  }

  /**
   * 从配置创建活动对象
   */
  createEventFromConfig(config, date) {
    // 构建startTime
    const [hours, minutes] = (config.time || '00:00').split(':');
    const startTime = new Date(date);
    startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // 构建endTime（如果有duration）
    let endTime = null;
    if (config.duration) {
      endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + config.duration);
    }

    return {
      title: config.displayName,
      startTime: startTime.toISOString(),
      endTime: endTime ? endTime.toISOString() : null,
      location: config.location,
      price: config.price || 'Check event page',
      description: config.description || '',
      originalUrl: config.url,
      source: config.name,
      eventType: 'recurring',
      scraped_at: new Date().toISOString(),
      _is_recurring: true
    };
  }
}

module.exports = ConfigurableScraperManager;
