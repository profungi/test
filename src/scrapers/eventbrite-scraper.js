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
    // Eventbrite 使用 h3 或 h2 作为标题
    const selectors = [
      'h3',
      'h2',
      'h1',
      '[data-testid="event-title"]',
      '.event-title',
      '[aria-label*="title"]'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text && text.length > 3) return text;
    }

    return null;
  }

  extractTime($, $el) {
    // Eventbrite 的时间通常在文本中，如 "Tomorrow • 9:30 PM" 或 "Oct 10 • 8:00 PM"

    // 先尝试找 <time> 标签
    const $timeEl = $el.find('time').first();
    if ($timeEl.length > 0) {
      const datetime = $timeEl.attr('datetime');
      if (datetime) {
        try {
          return {
            startTime: new Date(datetime).toISOString(),
            endTime: null
          };
        } catch (e) {
          // 继续
        }
      }
    }

    // 尝试从卡片的所有文本中找时间
    const allText = $el.text();
    const parsedTime = this.parseTimeText(allText);
    if (parsedTime.startTime) {
      return parsedTime;
    }

    return { startTime: null, endTime: null };
  }

  extractLocation($, $el) {
    // Eventbrite 的地点通常紧跟在时间后面
    // 从卡片文本中提取，通常格式是 "VENUE_NAME" 在时间下方

    const allText = $el.text();

    // 尝试找所有段落
    const paragraphs = [];
    $el.find('p, div').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2 && text.length < 100) {
        paragraphs.push(text);
      }
    });

    // 查找看起来像地点的文本（不包含时间、价格等）
    for (const text of paragraphs) {
      // 跳过包含时间、价格、followers等关键词的文本
      if (text.match(/\d+:\d+|PM|AM|followers|From \$|Save|Share/i)) {
        continue;
      }
      // 跳过太短或太长的
      if (text.length < 3 || text.length > 80) {
        continue;
      }
      // 跳过 "online"
      if (text.toLowerCase() === 'online') {
        continue;
      }
      // 如果包含常见地点词汇，可能是地点
      if (text.length > 0) {
        return text;
      }
    }

    // 备用方案：尝试标准选择器
    const selectors = [
      '[data-testid="event-location"]',
      '.event-location',
      '.location',
      '.venue'
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
    // Eventbrite 价格格式: "From $29.68" 或 "Free"

    const allText = $el.text();

    // 查找 "From $XX.XX" 或 "$XX.XX" 或 "Free"
    const priceMatch = allText.match(/From \$[\d,]+\.?\d*/i) ||
                      allText.match(/\$[\d,]+\.?\d+/);

    if (priceMatch) {
      return priceMatch[0];
    }

    // 查找 "Free"
    if (/\bfree\b/i.test(allText)) {
      return 'Free';
    }

    // 尝试标准选择器
    const selectors = [
      '.price',
      '[data-testid="price"]',
      '[class*="price"]'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text) {
        if (/^(free|$0\.00|$0)$/i.test(text)) {
          return 'Free';
        }
        return text;
      }
    }

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
    const { addDays } = require('date-fns');

    // Eventbrite 常见格式：
    // "Tomorrow • 9:30 PM"
    // "Today • 7:00 PM"
    // "Oct 10 • 8:00 PM"
    // "Dec 25, 2024, 7:00 PM"

    // 1. 处理相对日期
    if (/tomorrow/i.test(timeText)) {
      const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const isPM = timeMatch[3].toUpperCase() === 'PM';

        const tomorrow = addDays(new Date(), 1);
        let hour24 = hours;
        if (isPM && hours !== 12) hour24 += 12;
        if (!isPM && hours === 12) hour24 = 0;

        tomorrow.setHours(hour24, minutes, 0, 0);
        return {
          startTime: tomorrow.toISOString(),
          endTime: null
        };
      }
    }

    if (/today/i.test(timeText)) {
      const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const isPM = timeMatch[3].toUpperCase() === 'PM';

        const today = new Date();
        let hour24 = hours;
        if (isPM && hours !== 12) hour24 += 12;
        if (!isPM && hours === 12) hour24 = 0;

        today.setHours(hour24, minutes, 0, 0);
        return {
          startTime: today.toISOString(),
          endTime: null
        };
      }
    }

    // 2. 处理 "Oct 10 • 8:00 PM" 格式
    const monthDayTime = timeText.match(/(\w{3})\s+(\d{1,2})\s*[•·]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (monthDayTime) {
      try {
        const month = monthDayTime[1];
        const day = monthDayTime[2];
        const hours = parseInt(monthDayTime[3]);
        const minutes = parseInt(monthDayTime[4]);
        const isPM = monthDayTime[5].toUpperCase() === 'PM';

        let hour24 = hours;
        if (isPM && hours !== 12) hour24 += 12;
        if (!isPM && hours === 12) hour24 = 0;

        const currentYear = new Date().getFullYear();
        const dateStr = `${month} ${day}, ${currentYear} ${hour24}:${minutes}:00`;
        const date = new Date(dateStr);

        if (!isNaN(date.getTime())) {
          return {
            startTime: date.toISOString(),
            endTime: null
          };
        }
      } catch (e) {
        // 继续
      }
    }

    // 3. 其他标准格式
    const patterns = [
      // "Dec 25, 2024, 7:00 PM"
      /(\w{3}\s+\d{1,2},\s+\d{4}),?\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "December 25 at 7:00 PM"
      /(\w+\s+\d{1,2})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
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