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
      // SF Station 的URL结构: /events/ 显示所有即将到来的活动
      // 尝试抓取主活动页面和分类页面
      const urls = [
        baseUrl,  // 主页面
        baseUrl + '?view=list',  // 列表视图
        baseUrl + 'this-weekend',  // 本周末
        baseUrl + 'next-7-days',  // 接下来7天
      ];

      for (const url of urls) {
        try {
          console.log(`Trying SF Station URL: ${url}`);
          const $ = await this.fetchPage(url);

          const pageEvents = await this.parseSFStationPage($);
          events.push(...pageEvents);

          if (events.length >= 60) {
            break;
          }
        } catch (error) {
          console.warn(`Failed to fetch ${url}: ${error.message}`);
          // 继续尝试下一个URL
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
      '.admission',
      '[class*="price"]',
      '[class*="cost"]'
    ];

    for (const sel of selectors) {
      const text = $el.find(sel).first().text().trim();
      if (text) {
        // 只有明确说Free才返回Free
        if (/^(free|$0\.00|$0|no charge)$/i.test(text)) {
          return 'Free';
        }
        return text;
      }
    }

    // 只在明确的上下文中检查免费关键词
    const priceContext = $el.find('.price, .cost, .admission, [class*="price"]').text().toLowerCase();
    if (priceContext && /\b(free admission|free entry|free event)\b/.test(priceContext)) {
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
    const seenUrls = new Set();

    // 通用方法1：查找所有包含活动链接的<a>标签
    $('a[href*="/event"], a[href*="/events/"]').each((i, element) => {
      try {
        const $link = $(element);
        const href = $link.attr('href');
        if (!href || seenUrls.has(href)) return;

        const title = $link.text().trim() || $link.attr('title') || '';

        if (title.length > 5 && title.length < 200) {
          seenUrls.add(href);
          const fullUrl = href.startsWith('http') ? href : `https://www.sfstation.com${href}`;

          // 尝试从周围元素提取更多信息
          const $container = $link.closest('div, li, article, [class*="event"], [class*="card"]').first();

          // 尝试提取时间和地点
          let location = 'San Francisco';
          let timeText = '';

          if ($container.length > 0) {
            // 查找地点信息
            const locationText = $container.find('.venue, .location, [class*="venue"], [class*="location"]').first().text().trim();
            if (locationText && locationText.length > 2) {
              location = locationText;
            }

            // 查找时间信息
            timeText = $container.find('.date, .time, [class*="date"], [class*="time"], time').first().text().trim();
          }

          // 解析时间或使用默认值
          let startTime;
          if (timeText) {
            const parsed = this.parseTimeText(timeText);
            startTime = parsed.startTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          } else {
            startTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          }

          events.push({
            title,
            startTime,
            location,
            originalUrl: fullUrl,
            price: null,
            description: null
          });
        }
      } catch (e) {
        // 忽略解析错误
      }
    });

    // 通用方法2：如果没有找到活动，尝试查找包含活动信息的结构化元素
    if (events.length === 0) {
      $('article, .post, [class*="event"], [class*="listing"]').each((i, element) => {
        try {
          const $el = $(element);
          const $link = $el.find('a').first();
          const href = $link.attr('href');

          if (href && !seenUrls.has(href) && (href.includes('event') || href.includes('listing'))) {
            seenUrls.add(href);
            const title = $link.text().trim() || $el.find('h1, h2, h3, h4').first().text().trim();

            if (title && title.length > 5) {
              const fullUrl = href.startsWith('http') ? href : `https://www.sfstation.com${href}`;

              events.push({
                title,
                startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                location: 'San Francisco',
                originalUrl: fullUrl,
                price: null,
                description: null
              });
            }
          }
        } catch (e) {
          // 忽略
        }
      });
    }

    return events.slice(0, 30);
  }
}

module.exports = SFStationScraper;