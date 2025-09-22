const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const DateUtils = require('../utils/dateUtils');
const config = require('../config');

class BaseScraper {
  constructor(sourceName) {
    this.sourceName = sourceName;
    this.browser = null;
    this.page = null;
    this.events = [];
  }

  async initBrowser() {
    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
      
      this.page = await this.browser.newPage();
      
      await this.page.setUserAgent(process.env.USER_AGENT || 
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      );
      
      await this.page.setViewport({ width: 1200, height: 800 });
      
      console.log(`Browser initialized for ${this.sourceName}`);
    } catch (error) {
      console.error(`Error initializing browser for ${this.sourceName}:`, error);
      throw error;
    }
  }

  async closeBrowser() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      console.log(`Browser closed for ${this.sourceName}`);
    } catch (error) {
      console.error(`Error closing browser for ${this.sourceName}:`, error);
    }
  }

  async fetchWithAxios(url, options = {}) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': process.env.USER_AGENT || 
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        ...options
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error.message);
      throw error;
    }
  }

  parsePrice(priceText) {
    if (!priceText || priceText.trim().toLowerCase().includes('free')) {
      return 'Free';
    }
    
    // 提取价格数字
    const priceMatch = priceText.match(/\$?(\d+(?:\.\d{2})?)/);
    if (priceMatch) {
      return `$${priceMatch[1]}`;
    }
    
    return priceText.trim();
  }

  detectEventType(title, description = '') {
    const text = `${title} ${description}`.toLowerCase();
    
    const typeKeywords = {
      market: ['market', 'farmers market', 'flea market', 'night market'],
      fair: ['fair', 'craft fair', 'art fair', 'book fair', 'job fair'],
      festival: ['festival', 'fest', 'celebration', 'parade'],
      food: ['food', 'restaurant', 'cooking', 'culinary', 'dining', 'taste', 'wine', 'beer'],
      music: ['music', 'concert', 'band', 'singer', 'jazz', 'rock', 'classical'],
      free: ['free', 'no charge', 'complimentary']
    };
    
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return type;
        }
      }
    }
    
    return 'other';
  }

  calculateEventPriority(eventType, hasPrice = true) {
    const basePriority = config.eventTypePriority[eventType] || config.eventTypePriority.default;
    
    // 免费活动优先级稍低
    if (!hasPrice || eventType === 'free') {
      return basePriority - 1;
    }
    
    return basePriority;
  }

  isRelevantLocation(location) {
    if (!location) return false;
    
    const locationLower = location.toLowerCase();
    
    // 检查主要地区
    for (const primaryLoc of config.locations.primary) {
      if (locationLower.includes(primaryLoc.toLowerCase())) {
        return true;
      }
    }
    
    // 检查次要地区
    for (const secondaryLoc of config.locations.secondary) {
      if (locationLower.includes(secondaryLoc.toLowerCase())) {
        return true;
      }
    }
    
    // 检查关键词
    for (const keyword of config.locations.keywords) {
      if (locationLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }

  validateEvent(event) {
    // 检查必需字段
    if (!event.title || !event.startTime || !event.location || !event.originalUrl) {
      return false;
    }
    
    // 检查地理位置相关性
    if (!this.isRelevantLocation(event.location)) {
      return false;
    }
    
    // 检查时间有效性
    const eventDate = DateUtils.parseEventDate(event.startTime);
    if (!eventDate) {
      return false;
    }
    
    // 检查是否是过期活动
    if (DateUtils.isEventStale(eventDate)) {
      console.log(`Skipping stale event: ${event.title}`);
      return false;
    }
    
    // 检查是否在下周范围内
    if (!DateUtils.isEventInNextWeek(eventDate)) {
      return false;
    }
    
    return true;
  }

  createEventObject(rawEvent) {
    const eventType = this.detectEventType(rawEvent.title, rawEvent.description);
    const hasPrice = rawEvent.price && !rawEvent.price.toLowerCase().includes('free');
    const priority = this.calculateEventPriority(eventType, hasPrice);
    const { identifier: weekIdentifier } = DateUtils.getNextWeekRange();
    
    return {
      title: rawEvent.title.trim(),
      startTime: rawEvent.startTime,
      endTime: rawEvent.endTime || null,
      location: rawEvent.location.trim(),
      price: this.parsePrice(rawEvent.price) || 'Free',
      description: rawEvent.description ? rawEvent.description.trim() : '',
      originalUrl: rawEvent.originalUrl,
      source: this.sourceName,
      eventType,
      priority,
      weekIdentifier
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 抽象方法，子类必须实现
  async scrape() {
    throw new Error('scrape() method must be implemented by subclass');
  }

  async getEvents() {
    try {
      console.log(`Starting scrape for ${this.sourceName}...`);
      await this.scrape();
      
      // 验证和清理事件
      const validEvents = this.events.filter(event => this.validateEvent(event));
      
      console.log(`${this.sourceName}: Found ${this.events.length} events, ${validEvents.length} valid`);
      return validEvents;
      
    } catch (error) {
      console.error(`Error scraping ${this.sourceName}:`, error);
      throw error;
    }
  }
}

module.exports = BaseScraper;