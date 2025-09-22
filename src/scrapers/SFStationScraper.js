const BaseScraper = require('./BaseScraper');
const cheerio = require('cheerio');
const DateUtils = require('../utils/dateUtils');

class SFStationScraper extends BaseScraper {
  constructor() {
    super('sfstation');
    this.baseUrl = 'https://www.sfstation.com/events/';
  }

  async scrape() {
    try {
      console.log('Scraping SFStation events...');
      
      // 使用axios获取页面内容，避免复杂的JavaScript渲染
      const html = await this.fetchWithAxios(this.baseUrl);
      const $ = cheerio.load(html);
      
      // 提取事件
      const events = this.extractEventsFromHTML($);
      
      for (const rawEvent of events) {
        if (this.validateRawEvent(rawEvent)) {
          const event = this.createEventObject(rawEvent);
          if (event) {
            this.events.push(event);
          }
        }
      }
      
    } catch (error) {
      console.error('Error scraping SFStation:', error);
      
      // 如果axios失败，尝试使用Puppeteer
      try {
        await this.scrapeWithPuppeteer();
      } catch (puppeteerError) {
        console.error('Puppeteer fallback also failed:', puppeteerError);
        throw error;
      }
    }
  }

  extractEventsFromHTML($) {
    const events = [];
    
    // SFStation的事件通常在特定的CSS选择器中
    const selectors = [
      '.event-item',
      '.event-listing',
      '.event-card',
      'article[class*="event"]',
      '.listing-item'
    ];
    
    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} events with selector: ${selector}`);
        
        elements.each((index, element) => {
          const event = this.extractSingleEvent($, $(element));
          if (event) {
            events.push(event);
          }
        });
        
        if (events.length > 0) break; // 找到有效选择器后停止
      }
    }
    
    // 如果没有找到特定的事件选择器，尝试通用方法
    if (events.length === 0) {
      events.push(...this.extractWithGenericMethod($));
    }
    
    return events;
  }

  extractSingleEvent($, element) {
    try {
      // 尝试多种可能的选择器组合
      const titleSelectors = ['h2', 'h3', '.title', '.event-title', 'a[href*="event"]'];
      const dateSelectors = ['.date', '.event-date', '.when', 'time'];
      const locationSelectors = ['.location', '.venue', '.where', '.event-location'];
      const priceSelectors = ['.price', '.cost', '.admission', '.ticket-price'];
      const descriptionSelectors = ['.description', '.summary', '.excerpt', 'p'];
      
      let title, dateText, location, price, description, url;
      
      // 提取标题和链接
      for (const selector of titleSelectors) {
        const titleEl = element.find(selector).first();
        if (titleEl.length > 0) {
          title = titleEl.text().trim();
          const linkEl = titleEl.is('a') ? titleEl : titleEl.find('a');
          if (linkEl.length > 0) {
            url = linkEl.attr('href');
            if (url && !url.startsWith('http')) {
              url = new URL(url, 'https://www.sfstation.com').href;
            }
          }
          break;
        }
      }
      
      // 提取日期
      for (const selector of dateSelectors) {
        const dateEl = element.find(selector).first();
        if (dateEl.length > 0) {
          dateText = dateEl.text().trim();
          break;
        }
      }
      
      // 提取地点
      for (const selector of locationSelectors) {
        const locationEl = element.find(selector).first();
        if (locationEl.length > 0) {
          location = locationEl.text().trim();
          break;
        }
      }
      
      // 提取价格
      for (const selector of priceSelectors) {
        const priceEl = element.find(selector).first();
        if (priceEl.length > 0) {
          price = priceEl.text().trim();
          break;
        }
      }
      
      // 提取描述
      for (const selector of descriptionSelectors) {
        const descEl = element.find(selector).first();
        if (descEl.length > 0) {
          description = descEl.text().trim().substring(0, 200);
          break;
        }
      }
      
      if (title && (url || dateText)) {
        return {
          title,
          dateText: dateText || '',
          location: location || 'San Francisco',
          price: price || 'Free',
          description: description || '',
          originalUrl: url || 'https://www.sfstation.com/events/'
        };
      }
      
      return null;
    } catch (error) {
      console.log('Error extracting single SFStation event:', error);
      return null;
    }
  }

  extractWithGenericMethod($) {
    const events = [];
    
    // 查找所有包含日期和标题的链接
    $('a[href*="event"], a[href*="show"]').each((index, element) => {
      try {
        const $el = $(element);
        const title = $el.text().trim();
        const url = $el.attr('href');
        
        if (title && url && title.length > 5) {
          let fullUrl = url;
          if (!url.startsWith('http')) {
            fullUrl = new URL(url, 'https://www.sfstation.com').href;
          }
          
          events.push({
            title,
            dateText: '',
            location: 'San Francisco',
            price: 'Free',
            description: '',
            originalUrl: fullUrl
          });
        }
      } catch (error) {
        // 忽略单个提取错误
      }
    });
    
    return events.slice(0, 20); // 限制数量
  }

  async scrapeWithPuppeteer() {
    await this.initBrowser();
    
    try {
      await this.page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // 等待页面加载
      await this.delay(3000);
      
      const events = await this.page.evaluate(() => {
        const events = [];
        const selectors = [
          '.event-item',
          '.event-listing', 
          'article[class*="event"]',
          '.listing-item'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          
          elements.forEach(element => {
            const titleEl = element.querySelector('h2, h3, .title, a[href*="event"]');
            const dateEl = element.querySelector('.date, .when, time');
            const locationEl = element.querySelector('.location, .venue, .where');
            
            if (titleEl) {
              const title = titleEl.textContent?.trim();
              const url = titleEl.href || element.querySelector('a')?.href;
              const dateText = dateEl?.textContent?.trim() || '';
              const location = locationEl?.textContent?.trim() || 'San Francisco';
              
              if (title && url) {
                events.push({
                  title,
                  dateText,
                  location,
                  price: 'Free',
                  description: '',
                  originalUrl: url.startsWith('http') ? url : 'https://www.sfstation.com' + url
                });
              }
            }
          });
          
          if (events.length > 0) break;
        }
        
        return events;
      });
      
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

  validateRawEvent(rawEvent) {
    return rawEvent.title && rawEvent.originalUrl;
  }

  createEventObject(rawEvent) {
    // 如果没有具体日期，使用下周的开始日期作为占位符
    let startTime;
    
    if (rawEvent.dateText) {
      const parsedDate = DateUtils.parseEventDate(rawEvent.dateText);
      startTime = parsedDate ? parsedDate.toISOString() : DateUtils.getNextWeekRange().start.toISOString();
    } else {
      startTime = DateUtils.getNextWeekRange().start.toISOString();
    }
    
    return super.createEventObject({
      title: rawEvent.title,
      startTime,
      location: rawEvent.location || 'San Francisco',
      price: rawEvent.price || 'Free',
      description: rawEvent.description || '',
      originalUrl: rawEvent.originalUrl
    });
  }
}

module.exports = SFStationScraper;