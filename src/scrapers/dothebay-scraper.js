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
      // DoTheBay 支持相对日期路径
      // 抓取接下来7天的活动
      const relativeDates = this.getRelativeDates(weekRange);

      console.log(`Scraping DoTheBay for next ${relativeDates.length} days`);

      for (const dateInfo of relativeDates) {
        try {
          const url = `${baseUrl}/${dateInfo.path}`;
          console.log(`Trying DoTheBay URL: ${url} (${dateInfo.label})`);
          const $ = await this.fetchPage(url);
          const pageEvents = await this.parseDoTheBayPage($);

          if (pageEvents.length > 0) {
            console.log(`Found ${pageEvents.length} events from ${url}`);

            // 对每个事件，访问详情页获取完整信息
            console.log(`  Fetching details for ${pageEvents.length} events...`);
            for (let i = 0; i < pageEvents.length && i < 20; i++) { // 限制每页最多20个
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
          }

          if (events.length >= 60) {
            break;
          }
        } catch (error) {
          console.warn(`Failed to fetch ${dateInfo.path}: ${error.message}`);
          // 继续尝试下一个日期
        }
      }

    } catch (error) {
      console.error(`Error scraping DoTheBay: ${error.message}`);
    }

    return events;
  }

  getRelativeDates(weekRange) {
    // DoTheBay 支持 /events/YYYY/M/D 格式的日期路径
    const { addDays, format } = require('date-fns');
    const startDate = new Date(weekRange.start);
    const endDate = new Date(weekRange.end);

    const dates = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const year = format(currentDate, 'yyyy');
      const month = format(currentDate, 'M');
      const day = format(currentDate, 'd');

      dates.push({
        path: `${year}/${month}/${day}`,
        label: format(currentDate, 'yyyy-MM-dd'),
        date: new Date(currentDate)
      });

      currentDate = addDays(currentDate, 1);
    }

    return dates;
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

    // DoTheBay 使用 ds-listing 和 event-card 类名
    const eventSelectors = [
      '.ds-listing.event-card',
      '.ds-listing',
      '[itemprop="event"]'
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
      console.log('No events found with standard selectors, trying generic parsing...');
      events.push(...this.parseGenericDoTheBayEvents($));
    }

    return events;
  }

  async fetchEventDetails(basicEvent) {
    try {
      console.log(`    Fetching detail page: ${basicEvent.originalUrl}`);
      const $ = await this.fetchPage(basicEvent.originalUrl);

      // 从详情页提取完整信息
      const fullAddress = this.extractFullAddress($);
      const timeInfo = this.extractDetailedTime($);
      const accuratePrice = this.extractDetailedPrice($);
      const fullTitle = this.extractFullTitle($);

      return {
        ...basicEvent,
        title: fullTitle || basicEvent.title,
        location: fullAddress || basicEvent.location,
        startTime: timeInfo.startTime || basicEvent.startTime,
        endTime: timeInfo.endTime || basicEvent.endTime,
        price: accuratePrice !== null ? accuratePrice : basicEvent.price
      };
    } catch (error) {
      console.warn(`    Error fetching detail page: ${error.message}`);
      return basicEvent;
    }
  }

  extractFullTitle($) {
    // 详情页的标题通常更完整
    const titleSelectors = [
      'h1[itemprop="name"]',
      'h1.event-title',
      'h1',
      '[itemprop="name"]'
    ];

    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      if (title && title.length > 3) {
        return title;
      }
    }
    return null;
  }

  extractFullAddress($) {
    // 尝试多种方式提取完整地址
    // 1. 查找 itemprop="location" 的详细地址
    const $location = $('[itemprop="location"]').first();
    if ($location.length > 0) {
      // 尝试获取完整地址（街道 + 城市 + 州 + 邮编）
      const $address = $location.find('[itemprop="address"]').first();
      if ($address.length > 0) {
        const street = $address.find('[itemprop="streetAddress"]').text().trim();
        const city = $address.find('[itemprop="addressLocality"]').text().trim();
        const state = $address.find('[itemprop="addressRegion"]').text().trim();
        const zip = $address.find('[itemprop="postalCode"]').text().trim();

        if (street || city) {
          const parts = [street, city, state, zip].filter(p => p);
          return parts.join(', ');
        }
      }

      // 如果没有结构化地址，尝试获取纯文本
      let locationText = $location.text().trim();
      // 清理：移除 "Get directions" 等文本
      locationText = locationText.replace(/Get directions?/gi, '').trim();
      locationText = locationText.replace(/View map/gi, '').trim();

      if (locationText && locationText.length > 5 && locationText.length < 200) {
        return locationText;
      }
    }

    // 2. 查找 .venue-address 或类似的类
    const addressSelectors = [
      '.venue-address',
      '.event-venue-address',
      '.address',
      '[class*="address"]'
    ];

    for (const selector of addressSelectors) {
      const address = $(selector).first().text().trim();
      if (address && address.length > 5 && address.length < 200) {
        return address.replace(/Get directions?/gi, '').trim();
      }
    }

    return null;
  }

  extractDetailedTime($) {
    // 辅助函数：规范化时间格式
    const normalizeTime = (timeStr) => {
      if (!timeStr) return null;

      // 移除时区信息
      let normalized = timeStr.replace(/([+-]\d{2}:\d{2}|Z)$/, '');

      // 验证并规范化格式
      if (normalized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
        return normalized; // 格式正确
      } else if (normalized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        return `${normalized}:00`; // 补充秒
      } else {
        console.warn(`  Invalid time format in DoTheBay: "${timeStr}" -> "${normalized}"`);
        return null;
      }
    };

    // 1. 优先使用 <time> 标签的 datetime 属性（使用本地时间）
    const $time = $('time[datetime]').first();
    if ($time.length > 0) {
      const datetime = $time.attr('datetime');
      const startTime = normalizeTime(datetime);

      if (startTime) {
        // 查找结束时间
        const $endTime = $('time[datetime]').eq(1);
        let endTime = null;
        if ($endTime.length > 0) {
          const endDatetime = $endTime.attr('datetime');
          endTime = normalizeTime(endDatetime);
        }

        return { startTime, endTime };
      }
    }

    // 2. 查找 itemprop="startDate" 和 itemprop="endDate"
    const startDateAttr = $('[itemprop="startDate"]').attr('content') ||
                         $('[itemprop="startDate"]').attr('datetime');
    const endDateAttr = $('[itemprop="endDate"]').attr('content') ||
                       $('[itemprop="endDate"]').attr('datetime');

    if (startDateAttr) {
      const startTime = normalizeTime(startDateAttr);
      const endTime = endDateAttr ? normalizeTime(endDateAttr) : null;

      if (startTime) {
        return { startTime, endTime };
      }
    }

    return { startTime: null, endTime: null };
  }

  extractDetailedPrice($) {
    // 1. 查找明确的 "Free" 文本
    const pageText = $('body').text().toLowerCase();

    // 查找价格相关的元素
    const priceSelectors = [
      '[itemprop="price"]',
      '.price',
      '.event-price',
      '.ticket-price',
      '[class*="price"]'
    ];

    for (const selector of priceSelectors) {
      const $priceEl = $(selector).first();
      if ($priceEl.length > 0) {
        const priceText = $priceEl.text().trim().toLowerCase();

        // 检查是否免费
        if (priceText === 'free' || priceText === '$0' || priceText === 'free admission') {
          return 'Free';
        }

        // 查找价格数字
        const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) {
          return priceMatch[0];
        }

        // 查找 content 属性
        const priceContent = $priceEl.attr('content');
        if (priceContent) {
          if (priceContent === '0') {
            return 'Free';
          }
          return `$${priceContent}`;
        }
      }
    }

    // 2. 在整个页面中搜索免费指示
    if (pageText.includes('free admission') ||
        pageText.includes('free event') ||
        pageText.includes('no charge')) {
      return 'Free';
    }

    return null;
  }

  parseDoTheBayEvent($, element) {
    const $el = $(element);

    try {
      // DoTheBay 使用 schema.org 和自定义类
      // 标题 - 从 itemprop="name" 或 .ds-listing-event-title-text 获取
      const title = $el.find('[itemprop="name"]').text().trim() ||
                    $el.find('.ds-listing-event-title-text').text().trim() ||
                    $el.find('.ds-listing-event-title').text().trim();
      if (!title || title.length < 3) return null;

      // URL - 从 itemprop="url" 或第一个链接获取
      let originalUrl = $el.find('a[itemprop="url"]').attr('href') ||
                        $el.find('.ds-listing-event-title').attr('href') ||
                        $el.find('a').first().attr('href');
      if (!originalUrl) return null;

      // 确保 URL 是完整的
      if (originalUrl.startsWith('/')) {
        originalUrl = `https://dothebay.com${originalUrl}`;
      }

      // 时间 - 直接使用本地时间（旧金山时间），不做时区转换
      const startDateAttr = $el.find('[itemprop="startDate"]').attr('content');
      let startTime = null;

      if (startDateAttr) {
        // 移除时区信息，直接使用本地时间
        // 输入如: "2025-10-06T18:00:00-07:00"
        // 输出: "2025-10-06T18:00:00"
        const localTime = startDateAttr.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
        const parsedDate = new Date(localTime);
        if (!isNaN(parsedDate.getTime())) {
          startTime = localTime;
        }
      }

      // 如果 itemprop 没有或无效，尝试解析文本
      if (!startTime) {
        const timeText = $el.find('.ds-event-time').text().trim() ||
                        $el.find('.ds-listing-event-time').text().trim();
        if (timeText) {
          const parsed = this.parseTimeText(timeText);
          startTime = parsed.startTime;
        }
      }

      if (!startTime) return null;

      // 地点 - 从 itemprop="location" 或 .ds-listing-venue 获取
      // 首先尝试 content 属性
      const contentAttr = $el.find('[itemprop="location"]').attr('content');
      let location;
      if (contentAttr && contentAttr.length > 3) {
        location = this.cleanLocationText(contentAttr);
      } else {
        const locationSelectors = ['[itemprop="location"]', '.ds-listing-venue', '.ds-venue-name', '.location', '.venue'];
        location = this.extractCleanLocation($, $el, locationSelectors, 'San Francisco Bay Area');
      }

      // 价格 - 从 .ds-event-price 或相关元素获取
      let price = null;
      const priceEl = $el.find('.ds-event-price').text().trim();
      if (priceEl) {
        if (priceEl.toLowerCase().includes('free') || priceEl === '$0') {
          price = 'Free';
        } else {
          price = priceEl;
        }
      }

      // 描述
      const description = $el.find('.ds-listing-event-description').text().trim() ||
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
      console.warn('Error parsing DoTheBay event:', error.message);
      return null;
    }
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
    const seenUrls = new Set();

    // 通用方法1：查找所有活动链接
    $('a[href*="/event"], a[href*="/listing"], a[href*="events/"]').each((i, element) => {
      try {
        const $link = $(element);
        const href = $link.attr('href');
        if (!href || seenUrls.has(href)) return;

        const title = $link.text().trim() || $link.attr('title') || $link.attr('aria-label') || '';

        if (title.length > 5 && title.length < 250) {
          seenUrls.add(href);
          const fullUrl = href.startsWith('http') ? href : `https://dothebay.com${href}`;

          // 尝试从周围元素提取信息
          const $container = $link.closest('div, li, article, section, [class*="event"], [class*="card"], [class*="item"]').first();

          let location = 'San Francisco Bay Area';
          let timeText = '';
          let priceText = null;

          if ($container.length > 0) {
            // 地点
            const locationEl = $container.find('.venue, .location, .where, [class*="venue"], [class*="location"]').first().text().trim();
            if (locationEl && locationEl.length > 2 && !locationEl.toLowerCase().includes('online')) {
              location = locationEl;
            }

            // 时间
            timeText = $container.find('.date, .time, .datetime, .when, [class*="date"], [class*="time"], time').first().text().trim();

            // 价格
            priceText = $container.find('.price, .cost, [class*="price"], [class*="cost"]').first().text().trim();
            if (!priceText && $container.text().toLowerCase().includes('free')) {
              priceText = 'Free';
            }
          }

          // 解析时间
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
            price: priceText,
            description: null
          });
        }
      } catch (e) {
        // 忽略解析错误
      }
    });

    // 通用方法2：结构化元素查找
    if (events.length === 0) {
      $('article, .post, [class*="event"], [class*="listing"], [class*="card"]').each((i, element) => {
        try {
          const $el = $(element);
          const $link = $el.find('a').first();
          const href = $link.attr('href');

          if (href && !seenUrls.has(href)) {
            seenUrls.add(href);
            const title = $link.text().trim() || $el.find('h1, h2, h3, h4, .title, [class*="title"]').first().text().trim();

            if (title && title.length > 5) {
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
          }
        } catch (e) {
          // 忽略
        }
      });
    }

    return events.slice(0, 30);
  }
}

module.exports = DoTheBayScraper;