const BaseScraper = require('./base-scraper');
const { parseISO, addDays, format } = require('date-fns');

class DoTheBayScraper extends BaseScraper {
  constructor() {
    super('dothebay');
  }

  async scrapeEvents(weekRange) {
    const events = [];
    const baseUrl = this.sourceConfig.baseUrl;
    
    try {
      // DoTheBay 可能有日期特定的页面
      const $ = await this.fetchPage(baseUrl);
      const mainEvents = await this.parseDoTheBayPage($);
      events.push(...mainEvents);

      // 尝试抓取特定日期的页面
      const weekDates = this.getWeekDates(weekRange);
      for (const dateStr of weekDates.slice(0, 3)) { // 只检查前3天避免过多请求
        try {
          const dateUrl = `${baseUrl}/${dateStr}`;
          const $date = await this.fetchPage(dateUrl);
          const dateEvents = await this.parseDoTheBayPage($date);
          events.push(...dateEvents);
        } catch (e) {
          // 忽略日期特定页面的错误
          console.log(`Date-specific page not available: ${dateStr}`);
        }
      }
      
    } catch (error) {
      console.error(`Error scraping DoTheBay: ${error.message}`);
    }

    return events;
  }

  getWeekDates(weekRange) {
    const dates = [];
    let current = new Date(weekRange.start);
    const end = new Date(weekRange.end);
    
    while (current <= end) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
    
    return dates;
  }

  async parseDoTheBayPage($) {
    const events = [];
    
    // DoTheBay 常见的事件选择器
    const eventSelectors = [
      '.event',
      '.event-item',
      '.event-card',
      '.listing',
      '[data-event-id]',
      '.calendar-event',
      '[class*="event"]'
    ];

    for (const selector of eventSelectors) {
      const eventElements = $(selector);
      
      if (eventElements.length > 0) {
        console.log(`Found ${eventElements.length} events with selector: ${selector}`);
        
        eventElements.each((i, element) => {
          try {
            const event = this.parseDoTheBayEvent($, element);
            if (event) {
              events.push(event);
            }
          } catch (error) {
            console.warn(`Failed to parse DoTheBay event ${i}:`, error.message);
          }
        });
        
        break;
      }
    }

    // 如果没有找到标准格式，尝试通用解析
    if (events.length === 0) {
      events.push(...this.parseGenericDoTheBayEvents($));
    }

    return events;
  }

  parseDoTheBayEvent($, element) {
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
      '.title',
      '.event-title',
      '.name',
      '[class*="title"] a',
      'a[title]'
    ];

    for (const sel of selectors) {
      const $titleEl = $el.find(sel).first();
      if ($titleEl.length > 0) {
        const title = $titleEl.text().trim() || $titleEl.attr('title');
        if (title && title.length > 3) {
          return title;
        }
      }
    }

    // 尝试从主要链接中提取标题
    const mainLink = $el.find('a').first();
    if (mainLink.length > 0) {
      const linkText = mainLink.text().trim();
      if (linkText && linkText.length > 5) {
        return linkText;
      }
    }

    return null;
  }

  extractTime($, $el) {
    const selectors = [
      '.date',
      '.time',
      '.datetime',
      '.event-date',
      '.event-time',
      '.when',
      '[class*="date"]',
      '[class*="time"]',
      '[datetime]'
    ];

    for (const sel of selectors) {
      const $timeEl = $el.find(sel).first();
      if ($timeEl.length > 0) {
        // 先尝试datetime属性
        const datetime = $timeEl.attr('datetime');
        if (datetime) {
          try {
            return {
              startTime: new Date(datetime).toISOString(),
              endTime: null
            };
          } catch (e) {
            // 继续尝试文本解析
          }
        }

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
      '.location',
      '.venue',
      '.where',
      '.address',
      '.event-location',
      '[class*="location"]',
      '[class*="venue"]'
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
    // 查找主要事件链接
    const $mainLink = $el.find('a').first();
    if ($mainLink.length > 0) {
      let href = $mainLink.attr('href');
      if (href) {
        if (href.startsWith('http')) {
          return href;
        } else if (href.startsWith('/')) {
          return `https://dothebay.com${href}`;
        }
      }
    }

    return null;
  }

  extractPrice($, $el) {
    const selectors = [
      '.price',
      '.cost',
      '.fee',
      '.admission',
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
    if (fullText.includes('free') || 
        fullText.includes('no cost') || 
        fullText.includes('complimentary') ||
        fullText.includes('$0')) {
      return 'Free';
    }

    return null;
  }

  extractDescription($, $el) {
    const selectors = [
      '.description',
      '.summary',
      '.details',
      '.content',
      'p',
      '.excerpt'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text && text.length > 15) {
        return text.substring(0, 200);
      }
    }

    return null;
  }

  parseTimeText(timeText) {
    if (!timeText) return { startTime: null, endTime: null };

    // DoTheBay 常见的时间格式
    const patterns = [
      // "Saturday, December 25th at 7:00 PM"
      /(\w+,\s*\w+\s+\d{1,2}(?:st|nd|rd|th)?)\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "Dec 25, 2024 • 7:00 PM"
      /(\w{3}\s+\d{1,2},\s+\d{4})\s*[•·]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "December 25 • 7:00 PM"
      /(\w+\s+\d{1,2})\s*[•·]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "Mon 12/25 7:00 PM"
      /\w{3}\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
      // "2024-12-25 19:00"
      /(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/,
      // "Dec 25 7PM"
      /(\w{3}\s+\d{1,2})\s+(\d{1,2}(?:AM|PM))/i
    ];

    for (const pattern of patterns) {
      const match = timeText.match(pattern);
      if (match) {
        try {
          let dateTimeStr;
          const currentYear = new Date().getFullYear();
          
          if (pattern.source.includes('\\d{4}-\\d{2}-\\d{2}')) {
            // ISO format
            dateTimeStr = `${match[1]}T${match[2]}:00`;
          } else if (match[1].includes('/')) {
            // MM/DD format - add current year
            const [month, day] = match[1].split('/');
            dateTimeStr = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${this.convertTo24Hour(match[2])}:00`;
          } else {
            // Text format
            dateTimeStr = `${match[1]} ${currentYear} ${match[2]}`;
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

    // 尝试解析时间范围（如 "7:00 PM - 9:00 PM"）
    const rangeMatch = timeText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (rangeMatch) {
      try {
        const today = addDays(new Date(), 7); // 假设是下周
        const startTime = new Date(`${format(today, 'yyyy-MM-dd')} ${rangeMatch[1]}`);
        const endTime = new Date(`${format(today, 'yyyy-MM-dd')} ${rangeMatch[2]}`);
        
        if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
          return {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString()
          };
        }
      } catch (e) {
        // 忽略错误
      }
    }

    return { startTime: null, endTime: null };
  }

  convertTo24Hour(time12h) {
    const [time, modifier] = time12h.split(/\s*(AM|PM)/i);
    let [hours, minutes] = time.split(':');
    
    if (!minutes) minutes = '00';
    
    if (hours === '12') {
      hours = '00';
    }
    
    if (modifier && modifier.toUpperCase() === 'PM') {
      hours = parseInt(hours, 10) + 12;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  parseGenericDoTheBayEvents($) {
    const events = [];
    
    // 通用方法：查找事件链接
    $('a').each((i, element) => {
      try {
        const $link = $(element);
        const href = $link.attr('href');
        const title = $link.text().trim();
        
        if (title && href && title.length > 8 && 
            (href.includes('/event') || href.includes('/listing'))) {
          
          const fullUrl = href.startsWith('http') ? href : `https://dothebay.com${href}`;
          
          events.push({
            title,
            startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            location: 'San Francisco Bay Area',
            originalUrl: fullUrl,
            price: null,
            description: null
          });
        }
      } catch (e) {
        // 忽略解析错误
      }
    });

    return events.slice(0, 10);
  }
}

module.exports = DoTheBayScraper;