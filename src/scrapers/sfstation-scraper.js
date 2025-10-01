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
      // SF Station 使用日期参数来显示特定日期的活动
      // 生成下周每一天的日期
      const dates = this.getWeekDates(weekRange);

      console.log(`Scraping SF Station for dates: ${dates.join(', ')}`);

      for (const dateStr of dates) {
        try {
          const url = `${baseUrl}?date=${dateStr}`;
          console.log(`Trying SF Station URL: ${url}`);
          const $ = await this.fetchPage(url);

          const pageEvents = await this.parseSFStationPage($);
          console.log(`Found ${pageEvents.length} events for ${dateStr}`);
          events.push(...pageEvents);

          if (events.length >= 60) {
            break;
          }
        } catch (error) {
          console.warn(`Failed to fetch ${dateStr}: ${error.message}`);
          // 继续尝试下一个日期
        }
      }

    } catch (error) {
      console.error(`Error scraping SF Station: ${error.message}`);
    }

    return events;
  }

  getWeekDates(weekRange) {
    const dates = [];
    const { addDays, format } = require('date-fns');
    let current = new Date(weekRange.start);
    const end = new Date(weekRange.end);

    while (current <= end) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }

    return dates;
  }

  async parseSFStationPage($) {
    const events = [];

    // SF Station 使用 event-wrapper 类名
    const eventSelectors = [
      '.event-wrapper',
      '.events_cont .event-wrapper'
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
      console.log('No events found with standard selectors, trying generic parsing...');
      events.push(...this.parseGenericSFEvents($));
    }

    return events;
  }

  parseSFStationEvent($, element) {
    const $el = $(element);

    try {
      // SF Station 使用 schema.org 结构
      // 标题 - 从 itemprop="name" 或链接中获取
      const title = $el.find('[itemprop="name"]').text().trim() ||
                    $el.find('a[itemprop="url"]').attr('title') ||
                    $el.find('.event_title a').text().trim();
      if (!title || title.length < 3) return null;

      // URL - 从 itemprop="url" 或第一个链接获取
      let originalUrl = $el.find('a[itemprop="url"]').attr('href') ||
                        $el.find('a').first().attr('href');
      if (!originalUrl) return null;

      // 确保 URL 是完整的
      if (originalUrl.startsWith('/')) {
        originalUrl = `https://www.sfstation.com${originalUrl}`;
      } else if (!originalUrl.startsWith('http')) {
        // 某些链接可能是外部的（如 eventbrite）
        originalUrl = originalUrl.startsWith('http') ? originalUrl : `https://www.sfstation.com${originalUrl}`;
      }

      // 时间 - 从 itemprop="startDate" 和 .event-time 获取
      const startDate = $el.find('[itemprop="startDate"]').attr('content') ||
                       $el.find('.event-date').first().attr('content');
      const timeText = $el.find('.event-time').text().trim() ||
                      $el.find('.event_time').text().trim();

      let startTime;
      if (startDate) {
        // 如果有时间文本，合并日期和时间
        if (timeText) {
          startTime = this.parseDateTime(startDate, timeText);
        } else {
          // 只有日期，使用中午12点作为默认时间
          startTime = new Date(`${startDate}T12:00:00`).toISOString();
        }
      } else {
        return null; // 没有日期信息，跳过
      }

      // 地点 - 从 itemprop="location" 或 .event_place 获取
      const location = $el.find('[itemprop="location"]').text().trim() ||
                      $el.find('.event_place').text().trim() ||
                      $el.find('.location').text().trim() ||
                      'San Francisco';

      // 价格 - 从 itemprop="price" 获取
      const priceContent = $el.find('[itemprop="price"]').attr('content');
      let price = null;
      if (priceContent) {
        if (priceContent === '0' || priceContent === '') {
          price = 'Free';
        } else {
          price = `$${priceContent}`;
        }
      }

      // 描述
      const description = $el.find('.event_description').text().trim() ||
                         $el.find('[itemprop="description"]').text().trim() ||
                         null;

      return {
        title,
        startTime,
        endTime: null,
        location,
        price,
        description,
        originalUrl
      };
    } catch (error) {
      console.warn('Error parsing SF Station event:', error.message);
      return null;
    }
  }

  parseDateTime(dateStr, timeStr) {
    try {
      // dateStr 格式: "2025-10-01"
      // timeStr 格式: "7:30pm" 或 "12noon - 5pm" 等

      // 提取第一个时间
      const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|noon)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const period = timeMatch[3] ? timeMatch[3].toLowerCase() : '';

        if (period === 'pm' && hours !== 12) {
          hours += 12;
        } else if (period === 'am' && hours === 12) {
          hours = 0;
        } else if (period === 'noon') {
          hours = 12;
        }

        const dateTime = new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
        return dateTime.toISOString();
      }

      // 如果无法解析时间，使用中午12点
      return new Date(`${dateStr}T12:00:00`).toISOString();
    } catch (error) {
      return new Date(`${dateStr}T12:00:00`).toISOString();
    }
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