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

        // 对每个事件，访问详情页获取完整信息
        console.log(`  Fetching details for ${pageEvents.length} events...`);
        for (let i = 0; i < pageEvents.length && i < 20; i++) { // 限制每页最多20个，避免太慢
          const event = pageEvents[i];
          if (event.originalUrl) {
            try {
              const detailedEvent = await this.fetchEventDetails(event);
              events.push(detailedEvent);
            } catch (error) {
              console.warn(`  Failed to fetch details for ${event.title}: ${error.message}`);
              // 如果详情页失败，使用列表页的基本信息
              events.push(event);
            }
          }
        }

        // 如果当前页面没有事件，停止抓取
        if (pageEvents.length === 0) {
          break;
        }

        // 达到最大数量限制时停止
        if (events.length >= 50) {
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
    // Eventbrite 的地点有特定的 class: event-card__clamp-line--one

    const locationByClass = $el.find('[class*="event-card__clamp-line--one"]').first().text().trim();

    if (locationByClass && locationByClass.length > 2 && locationByClass.length < 100) {
      // 排除各种状态信息和无效地点
      const invalidPatterns = [
        /almost full/i,
        /sales end/i,
        /going fast/i,
        /moved to virtual/i,
        /online event/i,
        /virtual event/i,
        /check ticket/i,
        /save this/i,
        /share this/i
      ];

      const isInvalid = invalidPatterns.some(pattern => pattern.test(locationByClass));

      if (!isInvalid) {
        return locationByClass;
      }
    }

    // 备用方案：如果通过 class 找不到，尝试其他选择器
    const backupSelectors = [
      '[data-testid="event-location"]',
      '.event-location',
      '.location',
      '.venue'
    ];

    for (const sel of backupSelectors) {
      const text = $el.find(sel).first().text().trim();
      if (text && text.length > 2 && text.toLowerCase() !== 'online') {
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

  // 访问事件详情页获取完整信息
  async fetchEventDetails(basicEvent) {
    const $ = await this.fetchPage(basicEvent.originalUrl);

    // 提取完整地址
    const fullAddress = this.extractFullAddress($);

    // 提取精确时间
    const timeInfo = this.extractDetailedTime($);

    // 提取准确价格
    const accuratePrice = this.extractDetailedPrice($);

    return {
      ...basicEvent,
      location: fullAddress || basicEvent.location,
      startTime: timeInfo.startTime || basicEvent.startTime,
      endTime: timeInfo.endTime || basicEvent.endTime,
      price: accuratePrice || basicEvent.price
    };
  }

  // 从详情页提取完整地址
  extractFullAddress($) {
    // 地址通常在 [class*="address"] 中
    const $address = $('[class*="address"]').first();
    if ($address.length > 0) {
      let addressText = $address.text().trim();

      // 清理地址文本，提取 "场馆名 + 街道地址 + 城市, 州 邮编" 格式
      // 例如: "Thrive City 1 Warriors Way San Francisco, CA 94158"
      const match = addressText.match(/(.*?\d+\s+[^,]+,\s*[A-Z]{2}\s+\d{5})/);
      if (match) {
        return match[1].replace(/Get directions.*$/i, '').trim();
      }

      // 如果找不到完整格式，尝试提取包含街道地址的部分
      const streetMatch = addressText.match(/([^,]*\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Way|Lane|Ln)[^,]*,\s*[A-Z]{2}\s+\d{5})/i);
      if (streetMatch) {
        return streetMatch[1].trim();
      }
    }

    return null;
  }

  // 从详情页提取精确时间
  extractDetailedTime($) {
    const { parseISO } = require('date-fns');

    // 1. 查找 <time> 标签的 datetime 属性
    const $time = $('time[datetime]').first();
    if ($time.length > 0) {
      const datetime = $time.attr('datetime');
      if (datetime) {
        try {
          const startTime = parseISO(datetime);

          // 查找完整时间文本，如 "Sunday, October 26 · 12 - 5pm PDT"
          const timeText = $('[class*="time"], [class*="date"]').filter((i, el) => {
            return $(el).text().includes('·') && $(el).text().match(/\d+\s*-\s*\d+\s*[ap]m/i);
          }).first().text();

          if (timeText) {
            const timeRange = this.parseTimeRange(datetime, timeText);
            return timeRange;
          }

          return {
            startTime: startTime.toISOString(),
            endTime: null
          };
        } catch (e) {
          // 继续
        }
      }
    }

    return { startTime: null, endTime: null };
  }

  // 解析时间范围，如 "Sunday, October 26 · 12 - 5pm PDT"
  parseTimeRange(dateStr, timeText) {
    const { parseISO } = require('date-fns');

    // 提取时间范围: "12 - 5pm" 或 "2pm - 8pm"
    const rangeMatch = timeText.match(/(\d{1,2})\s*(?::(\d{2}))?\s*([ap]m)?\s*-\s*(\d{1,2})\s*(?::(\d{2}))?\s*([ap]m)/i);

    if (rangeMatch) {
      const startHour = parseInt(rangeMatch[1]);
      const startMin = rangeMatch[2] ? parseInt(rangeMatch[2]) : 0;
      const startPeriod = rangeMatch[3] || rangeMatch[6]; // 如果前面没有am/pm，用后面的
      const endHour = parseInt(rangeMatch[4]);
      const endMin = rangeMatch[5] ? parseInt(rangeMatch[5]) : 0;
      const endPeriod = rangeMatch[6];

      // 转换为24小时制
      let start24 = startHour;
      if (startPeriod && startPeriod.toLowerCase() === 'pm' && startHour !== 12) {
        start24 += 12;
      } else if (startPeriod && startPeriod.toLowerCase() === 'am' && startHour === 12) {
        start24 = 0;
      }

      let end24 = endHour;
      if (endPeriod.toLowerCase() === 'pm' && endHour !== 12) {
        end24 += 12;
      } else if (endPeriod.toLowerCase() === 'am' && endHour === 12) {
        end24 = 0;
      }

      try {
        const baseDate = parseISO(dateStr);
        const startTime = new Date(baseDate);
        startTime.setHours(start24, startMin, 0, 0);

        const endTime = new Date(baseDate);
        endTime.setHours(end24, endMin, 0, 0);

        return {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        };
      } catch (e) {
        // 继续
      }
    }

    return { startTime: null, endTime: null };
  }

  // 从详情页提取准确价格
  extractDetailedPrice($) {
    // 1. 查找包含 "Free" 的元素（精确匹配）
    let foundFree = false;
    $('*').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text === 'free' || text === 'free admission') {
        foundFree = true;
        return false; // 停止循环
      }
    });

    if (foundFree) {
      return 'Free';
    }

    // 2. 查找价格选择器
    const priceSelectors = [
      '[data-testid="ticket-price"]',
      '.conversion-bar__panel-price',
      '[class*="price"]',
      '.ticket-card__price'
    ];

    for (const sel of priceSelectors) {
      const $el = $(sel);
      if ($el.length > 0) {
        const text = $el.first().text().trim();
        if (text && text.match(/\$\d+/)) {
          return text;
        }
      }
    }

    // 3. 从页面文本中查找价格
    const pageText = $('body').text();
    const priceMatch = pageText.match(/From\s+\$[\d,]+\.?\d*/i) ||
                      pageText.match(/\$[\d,]+\.?\d+/);

    if (priceMatch) {
      return priceMatch[0];
    }

    return null;
  }
}

module.exports = EventbriteScraper;