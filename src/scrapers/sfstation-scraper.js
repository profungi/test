const BaseScraper = require('./base-scraper');
const { parseISO, addDays } = require('date-fns');

class SFStationScraper extends BaseScraper {
  constructor() {
    super('sfstation');
  }

  async scrapeEvents(weekRange) {
    const events = [];
    const baseUrl = this.sourceConfig.baseUrl;
    
    try {
      // SF Station 可能有不同的分类页面
      const categories = ['', 'music/', 'food/', 'art/', 'festivals/'];
      
      for (const category of categories) {
        const url = baseUrl + category;
        const $ = await this.fetchPage(url);
        
        const categoryEvents = await this.parseSFStationPage($);
        events.push(...categoryEvents);
        
        if (events.length >= 80) {
          break;
        }
      }
      
    } catch (error) {
      console.error(`Error scraping SF Station: ${error.message}`);
    }

    return events;
  }

  async parseSFStationPage($) {
    const events = [];
    
    // SF Station 常见的事件选择器
    const eventSelectors = [
      '.event-item',
      '.event-listing',
      '.event',
      '[class*="event"]',
      '.listing-item',
      '.post'
    ];

    for (const selector of eventSelectors) {
      const eventElements = $(selector);
      
      if (eventElements.length > 0) {
        console.log(`Found ${eventElements.length} events with selector: ${selector}`);
        
        eventElements.each((i, element) => {
          try {
            const event = this.parseSFStationEvent($, element);
            if (event) {
              events.push(event);
            }
          } catch (error) {
            console.warn(`Failed to parse SF Station event ${i}:`, error.message);
          }
        });
        
        break;
      }
    }

    // 如果没有找到标准格式的事件，尝试通用解析
    if (events.length === 0) {
      events.push(...this.parseGenericSFEvents($));
    }

    return events;
  }

  parseSFStationEvent($, element) {
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

    // 价格和描述
    const price = this.extractPrice($, $el);
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
      'h2 a',
      'h3 a', 
      'h1 a',
      '.title a',
      '.event-title a',
      '.post-title a',
      'a[title]'
    ];

    for (const sel of selectors) {
      const $link = $el.find(sel).first();
      if ($link.length > 0) {
        const title = $link.text().trim() || $link.attr('title');
        if (title && title.length > 3) {
          return title;
        }
      }
    }

    // 尝试直接从元素中提取标题
    const directTitle = $el.find('h1, h2, h3, h4').first().text().trim();
    if (directTitle && directTitle.length > 3) {
      return directTitle;
    }

    return null;
  }

  extractTime($, $el) {
    const selectors = [
      '.date',
      '.time',
      '.event-date',
      '.event-time',
      '.datetime',
      '[class*="date"]',
      '[class*="time"]'
    ];

    for (const sel of selectors) {
      const $timeEl = $el.find(sel).first();
      if ($timeEl.length > 0) {
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
      '.venue',
      '.location',
      '.event-location',
      '.address',
      '[class*="venue"]',
      '[class*="location"]'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text && text.length > 3 && !text.toLowerCase().includes('online')) {
        return text;
      }
    }

    return null;
  }

  extractUrl($, $el) {
    // 查找事件链接
    const $link = $el.find('a').first();
    if ($link.length > 0) {
      let href = $link.attr('href');
      if (href) {
        if (href.startsWith('http')) {
          return href;
        } else if (href.startsWith('/')) {
          return `https://www.sfstation.com${href}`;
        }
      }
    }

    return null;
  }

  extractPrice($, $el) {
    const selectors = [
      '.price',
      '.cost',
      '.ticket-price',
      '[class*="price"]',
      '[class*="cost"]'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text) {
        return text;
      }
    }

    // 检查免费关键词
    const fullText = $el.text().toLowerCase();
    if (fullText.includes('free') || fullText.includes('no charge')) {
      return 'Free';
    }

    return null;
  }

  extractDescription($, $el) {
    const selectors = [
      '.description',
      '.summary',
      '.excerpt',
      'p',
      '.content'
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
    if (!timeText) return { startTime: null, endTime: null };

    // SF Station 常见的时间格式
    const patterns = [
      // "December 25, 2024 at 7:00 PM"
      /(\w+\s+\d{1,2},\s+\d{4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "Dec 25 • 7:00 PM"
      /(\w{3}\s+\d{1,2})\s*•\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "Monday, Dec 25 7:00 PM"
      /\w+,\s*(\w{3}\s+\d{1,2})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "25/12/2024 19:00"
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})/,
      // "2024-12-25 19:00"
      /(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/
    ];

    for (const pattern of patterns) {
      const match = timeText.match(pattern);
      if (match) {
        try {
          let dateTimeStr;
          
          if (pattern.source.includes('\\d{4}-\\d{2}-\\d{2}')) {
            // ISO format
            dateTimeStr = `${match[1]}T${match[2]}:00`;
          } else {
            // Other formats
            dateTimeStr = `${match[1]} ${match[2]}`;
          }
          
          const date = new Date(dateTimeStr);
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

    // 尝试解析相对日期（如"next Monday"）
    const relativeDateMatch = timeText.toLowerCase().match(/(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (relativeDateMatch) {
      try {
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDayIndex = dayOfWeek.indexOf(relativeDateMatch[2].toLowerCase());
        
        if (targetDayIndex !== -1) {
          const today = new Date();
          const currentDayIndex = today.getDay();
          const daysUntilTarget = (targetDayIndex - currentDayIndex + 7) % 7 || 7;
          const targetDate = addDays(today, daysUntilTarget);
          
          return {
            startTime: targetDate.toISOString(),
            endTime: null
          };
        }
      } catch (e) {
        // 忽略错误
      }
    }

    return { startTime: null, endTime: null };
  }

  parseGenericSFEvents($) {
    const events = [];
    
    // 通用方法：查找链接并尝试提取信息
    $('a').each((i, element) => {
      try {
        const $link = $(element);
        const href = $link.attr('href');
        const title = $link.text().trim();
        
        if (title && href && title.length > 10 && href.includes('/event')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.sfstation.com${href}`;
          
          // 尝试从周围元素提取更多信息
          const $container = $link.closest('div, li, article').first();
          
          events.push({
            title,
            startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            location: 'San Francisco',
            originalUrl: fullUrl,
            price: null,
            description: null
          });
        }
      } catch (e) {
        // 忽略解析错误
      }
    });

    return events.slice(0, 15);
  }
}

module.exports = SFStationScraper;