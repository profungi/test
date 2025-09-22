const BaseScraper = require('./BaseScraper');
const cheerio = require('cheerio');
const DateUtils = require('../utils/dateUtils');

class EventbriteScraper extends BaseScraper {
  constructor() {
    super('eventbrite');
    this.baseUrl = 'https://www.eventbrite.com/d/ca--san-francisco/events/';
    this.searchParams = {
      q: 'market festival fair food music',
      location: 'San Francisco, CA',
      distance: '25mi'
    };
  }

  async scrape() {
    await this.initBrowser();
    
    try {
      // 构建搜索URL
      const searchUrl = this.buildSearchUrl();
      console.log(`Scraping Eventbrite: ${searchUrl}`);
      
      await this.page.goto(searchUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // 等待事件列表加载
      await this.page.waitForSelector('[data-testid="search-results-events"]', { timeout: 10000 });
      
      // 滚动加载更多内容
      await this.scrollToLoadMore();
      
      // 提取事件数据
      const events = await this.extractEvents();
      
      for (const rawEvent of events) {
        if (this.validateRawEvent(rawEvent)) {
          const event = this.createEventObject(rawEvent);
          if (event) {
            this.events.push(event);
          }
        }
      }
      
    } finally {
      await this.closeBrowser();
    }
  }

  buildSearchUrl() {
    const params = new URLSearchParams({
      q: this.searchParams.q,
      location: this.searchParams.location,
      distance: this.searchParams.distance,
      start_date: this.getNextWeekStartDate(),
      end_date: this.getNextWeekEndDate()
    });
    
    return `${this.baseUrl}?${params.toString()}`;
  }

  getNextWeekStartDate() {
    const { start } = DateUtils.getNextWeekRange();
    return start.toISOString().split('T')[0];
  }

  getNextWeekEndDate() {
    const { end } = DateUtils.getNextWeekRange();
    return end.toISOString().split('T')[0];
  }

  async scrollToLoadMore() {
    try {
      let previousHeight = 0;
      let currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
      
      while (previousHeight !== currentHeight) {
        previousHeight = currentHeight;
        
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        await this.delay(2000);
        currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
      }
    } catch (error) {
      console.log('Error while scrolling, continuing with current content');
    }
  }

  async extractEvents() {
    return await this.page.evaluate(() => {
      const events = [];
      const eventCards = document.querySelectorAll('[data-testid="search-results-events"] article');
      
      eventCards.forEach(card => {
        try {
          const titleElement = card.querySelector('h3 a, h2 a, [data-testid="event-title"]');
          const dateElement = card.querySelector('[data-testid="event-date"], .date-info, time');
          const locationElement = card.querySelector('[data-testid="event-location"], .location-info');
          const priceElement = card.querySelector('[data-testid="event-price"], .price-info, .pricing');
          const linkElement = card.querySelector('a[href*="/e/"]');
          const descriptionElement = card.querySelector('.event-description, .summary');
          
          if (!titleElement || !linkElement) return;
          
          const title = titleElement.textContent?.trim();
          const href = linkElement.href;
          const dateText = dateElement?.textContent?.trim() || '';
          const locationText = locationElement?.textContent?.trim() || '';
          const priceText = priceElement?.textContent?.trim() || 'Free';
          const descriptionText = descriptionElement?.textContent?.trim() || '';
          
          if (title && href) {
            events.push({
              title,
              dateText,
              location: locationText,
              price: priceText,
              originalUrl: href,
              description: descriptionText
            });
          }
        } catch (error) {
          console.log('Error extracting event:', error);
        }
      });
      
      return events;
    });
  }

  validateRawEvent(rawEvent) {
    if (!rawEvent.title || !rawEvent.originalUrl) {
      return false;
    }
    
    if (!rawEvent.dateText) {
      console.log(`Event missing date: ${rawEvent.title}`);
      return false;
    }
    
    return true;
  }

  createEventObject(rawEvent) {
    const startTime = this.parseEventbriteDate(rawEvent.dateText);
    
    if (!startTime) {
      console.log(`Could not parse date for event: ${rawEvent.title}`);
      return null;
    }
    
    return super.createEventObject({
      title: rawEvent.title,
      startTime: startTime.toISOString(),
      location: rawEvent.location || 'San Francisco Bay Area',
      price: rawEvent.price,
      description: rawEvent.description,
      originalUrl: rawEvent.originalUrl
    });
  }

  parseEventbriteDate(dateText) {
    try {
      // Eventbrite常见日期格式
      const formats = [
        // "Thu, Dec 7, 7:00 PM"
        /(\w{3}),\s+(\w{3})\s+(\d{1,2}),\s+(\d{1,2}:\d{2}\s+[AP]M)/i,
        // "December 7, 2023 at 7:00 PM"
        /(\w+)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}:\d{2}\s+[AP]M)/i,
        // "Dec 7"
        /(\w{3})\s+(\d{1,2})$/i
      ];
      
      const cleanDate = dateText.replace(/\s+/g, ' ').trim();
      
      // 尝试直接解析
      let parsedDate = new Date(cleanDate);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
      
      // 尝试各种格式
      for (const format of formats) {
        const match = cleanDate.match(format);
        if (match) {
          // 假设是当前年份或下一年
          const currentYear = new Date().getFullYear();
          const dateStr = `${match[0]} ${currentYear}`;
          
          parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
      }
      
      console.warn(`Could not parse Eventbrite date: ${dateText}`);
      return null;
      
    } catch (error) {
      console.error(`Error parsing Eventbrite date ${dateText}:`, error);
      return null;
    }
  }
}

module.exports = EventbriteScraper;