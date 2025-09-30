const BaseScraper = require('./base-scraper');
const { parseISO, format } = require('date-fns');

class EventbriteScraper extends BaseScraper {
  constructor() {
    super('eventbrite');
  }

  async scrapeEvents(weekRange) {
    const events = [];
    const baseUrl = this.sourceConfig.baseUrl + this.sourceConfig.searchParams;
    
    try {
      // Eventbrite 通常需要多页抓取
      for (let page = 1; page <= 3; page++) {
        const url = `${baseUrl}&page=${page}`;
        const $ = await this.fetchPage(url);
        
        const pageEvents = await this.parseEventbritePage($);
        events.push(...pageEvents);
        
        // 如果当前页面没有事件，停止抓取
        if (pageEvents.length === 0) {
          break;
        }
        
        // 达到最大数量限制时停止
        if (events.length >= 100) {
          break;
        }
      }
      
    } catch (error) {
      console.error(`Error scraping Eventbrite: ${error.message}`);
    }

    return events;
  }

  async parseEventbritePage($) {
    const events = [];
    
    // Eventbrite 的事件通常在这些选择器中
    const eventSelectors = [
      '[data-testid="event-card"]',
      '.event-card',
      '.discover-search-desktop-card',
      '[data-event-id]',
      '.search-event-card'
    ];

    for (const selector of eventSelectors) {
      const eventElements = $(selector);
      
      if (eventElements.length > 0) {
        console.log(`Found ${eventElements.length} events with selector: ${selector}`);
        
        eventElements.each((i, element) => {
          try {
            const event = this.parseEventbriteEvent($, element);
            if (event) {
              events.push(event);
            }
          } catch (error) {
            console.warn(`Failed to parse event ${i}:`, error.message);
          }
        });
        
        break; // 找到事件后停止尝试其他选择器
      }
    }

    // 如果没有找到事件，尝试通用方法
    if (events.length === 0) {
      events.push(...this.parseGenericEvents($));
    }

    return events;
  }

  parseEventbriteEvent($, element) {
    const $el = $(element);
    
    // 标题
    const title = this.extractTitle($, $el);
    if (!title) return null;

    // 时间
    const timeInfo = this.extractTime($, $el);
    if (!timeInfo.startTime) return null;

    // 地点
    const location = this.extractLocation($, $el);
    if (!location) return null;

    // URL
    const originalUrl = this.extractUrl($, $el);
    if (!originalUrl) return null;

    // 价格
    const price = this.extractPrice($, $el);

    // 描述
    const description = this.extractDescription($, $el);

    return {
      title,
      startTime: timeInfo.startTime,
      endTime: timeInfo.endTime,
      location,
      price,
      description,
      originalUrl
    };
  }

  extractTitle($, $el) {
    const selectors = [
      '[data-testid="event-title"]',
      '.event-title',
      'h3 a',
      'h2 a',
      '.card-title',
      '[aria-label*="title"]'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text) return text;
    }

    return null;
  }

  extractTime($, $el) {
    const selectors = [
      '[data-testid="event-datetime"]',
      '.event-time',
      '.date-time',
      'time',
      '[datetime]'
    ];

    for (const sel of selectors) {
      const $timeEl = $el.find(sel).first();
      
      if ($timeEl.length > 0) {
        // 尝试从datetime属性获取
        const datetime = $timeEl.attr('datetime');
        if (datetime) {
          try {
            return {
              startTime: new Date(datetime).toISOString(),
              endTime: null
            };
          } catch (e) {
            // 继续尝试其他方法
          }
        }
        
        // 尝试解析文本内容
        const timeText = $timeEl.text().trim();
        const parsedTime = this.parseTimeText(timeText);
        if (parsedTime.startTime) {
          return parsedTime;
        }
      }
    }

    return { startTime: null, endTime: null };
  }

  extractLocation($, $el) {
    const selectors = [
      '[data-testid="event-location"]',
      '.event-location',
      '.location',
      '.venue',
      '[aria-label*="location"]'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text && text.toLowerCase() !== 'online') {
        return text;
      }
    }

    return null;
  }

  extractUrl($, $el) {
    // 尝试找到事件链接
    const link = $el.find('a').first().attr('href');
    if (link) {
      if (link.startsWith('http')) {
        return link;
      } else if (link.startsWith('/')) {
        return `https://www.eventbrite.com${link}`;
      }
    }

    return null;
  }

  extractPrice($, $el) {
    const selectors = [
      '.price',
      '.ticket-price',
      '[data-testid="price"]',
      '.cost',
      '[class*="price"]',
      '[class*="ticket"]'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text) {
        // 只有明确说Free才返回Free
        if (/^(free|$0\.00|$0)$/i.test(text)) {
          return 'Free';
        }
        return text;
      }
    }

    // 检查是否有免费标识 - 更严格
    const freeSelectors = ['.free', '[data-testid="free"]'];
    for (const sel of freeSelectors) {
      const $freeEl = $el.find(sel);
      if ($freeEl.length > 0) {
        const freeText = $freeEl.text().trim().toLowerCase();
        // 确保真的是说免费，而不是"free shipping"之类
        if (freeText === 'free' || freeText === 'free admission' || freeText === 'free entry') {
          return 'Free';
        }
      }
    }

    // 未找到价格信息
    return null;
  }

  extractDescription($, $el) {
    const selectors = [
      '.event-description',
      '.description',
      '.summary',
      'p'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text && text.length > 10) {
        return text.substring(0, 200);
      }
    }

    return null;
  }

  parseTimeText(timeText) {
    // 尝试解析各种时间格式
    const patterns = [
      // "Dec 25, 2024, 7:00 PM"
      /(\w{3}\s+\d{1,2},\s+\d{4}),?\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "December 25 at 7:00 PM"
      /(\w+\s+\d{1,2})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "Mon, Dec 25 • 7:00 PM"
      /\w+,\s*(\w{3}\s+\d{1,2})\s*•\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i
    ];

    for (const pattern of patterns) {
      const match = timeText.match(pattern);
      if (match) {
        try {
          const dateStr = `${match[1]} ${match[2]}`;
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return {
              startTime: date.toISOString(),
              endTime: null
            };
          }
        } catch (e) {
          // 继续尝试下一个模式
        }
      }
    }

    return { startTime: null, endTime: null };
  }

  parseGenericEvents($) {
    const events = [];
    
    // 通用方法：寻找包含链接的元素
    $('a[href*="/e/"]').each((i, element) => {
      try {
        const $link = $(element);
        const href = $link.attr('href');
        const title = $link.text().trim();
        
        if (title && href && title.length > 5) {
          const fullUrl = href.startsWith('http') ? href : `https://www.eventbrite.com${href}`;
          
          // 查找相关的时间和地点信息
          const $parent = $link.closest('[class*="event"], [class*="card"]');
          
          events.push({
            title,
            startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 临时时间
            location: 'San Francisco Bay Area', // 默认位置
            originalUrl: fullUrl,
            price: null,
            description: null
          });
        }
      } catch (e) {
        // 忽略解析错误
      }
    });

    return events.slice(0, 20); // 限制数量
  }
}

module.exports = EventbriteScraper;