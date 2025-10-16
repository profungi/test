const BaseScraper = require('./base-scraper');
const { parseISO, addDays } = require('date-fns');
const TimeHandler = require('../utils/time-handler');

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

          if (pageEvents.length > 0) {
            // 对每个事件，尝试访问详情页获取完整信息
            console.log(`  Fetching details for ${pageEvents.length} events...`);
            for (let i = 0; i < pageEvents.length && i < 20; i++) { // 限制每页最多20个
              const event = pageEvents[i];
              if (event.originalUrl && event.originalUrl.includes('sfstation.com')) {
                // 只访问 sfstation.com 的详情页，跳过外部链接
                try {
                  const detailedEvent = await this.fetchEventDetails(event);
                  events.push(detailedEvent);
                } catch (error) {
                  console.warn(`  Failed to fetch details for ${event.title}: ${error.message}`);
                  // 如果详情页失败，使用列表页的基本信息
                  events.push(event);
                }
              } else {
                // 外部链接：使用列表页信息
                events.push(event);
              }
            }
          }

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

  async fetchEventDetails(basicEvent) {
    try {
      console.log(`    Fetching detail page: ${basicEvent.originalUrl}`);
      const $ = await this.fetchPage(basicEvent.originalUrl);

      // 从详情页提取完整信息
      const fullAddress = this.extractFullAddress($);
      const timeInfo = this.extractDetailedTime($);
      const accuratePrice = this.extractDetailedPrice($);
      const fullTitle = this.extractFullTitle($);
      const detailedDescription = this.extractDetailedDescription($);

      return {
        ...basicEvent,
        title: fullTitle || basicEvent.title,
        location: fullAddress || basicEvent.location,
        startTime: timeInfo.startTime || basicEvent.startTime,
        endTime: timeInfo.endTime || basicEvent.endTime,
        price: accuratePrice !== null ? accuratePrice : basicEvent.price,
        description_detail: detailedDescription || basicEvent.description
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
      // 清理：移除时间信息和其他干扰文本
      locationText = locationText.replace(/\(\d{1,2}(?::\d{2})?\s*(?:am|pm|noon).*?\)/gi, '').trim();
      locationText = locationText.replace(/\d{1,2}(?::\d{2})?\s*(?:am|pm|noon).*/gi, '').trim();
      locationText = locationText.replace(/\s*\/\s*.*$/, '').trim();
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
      '.event_place',
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
    // 1. 优先使用 <time> 标签的 datetime 属性
    const $time = $('time[datetime]').first();
    if ($time.length > 0) {
      const datetime = $time.attr('datetime');
      const startTime = TimeHandler.normalize(datetime, { source: 'SFStation' });

      if (startTime) {
        // 查找结束时间
        const $endTime = $('time[datetime]').eq(1);
        let endTime = null;
        if ($endTime.length > 0) {
          const endDatetime = $endTime.attr('datetime');
          endTime = TimeHandler.normalize(endDatetime, { source: 'SFStation' });
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
      const startTime = TimeHandler.normalize(startDateAttr, { source: 'SFStation' });
      let endTime = null;

      if (endDateAttr) {
        endTime = TimeHandler.normalize(endDateAttr, { source: 'SFStation' });
      }

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

      // 过滤掉列表页URL（calendar页面）
      if (originalUrl.includes('/calendar') || originalUrl.includes('sfstation.com/?') || originalUrl.includes('sfstation.com?')) {
        console.log(`  Skipping list page URL: ${originalUrl}`);
        return null;
      }

      // 时间 - 使用TimeHandler规范化
      const startDateAttr = $el.find('[itemprop="startDate"]').attr('content');
      let startTime = null;

      if (startDateAttr) {
        // 尝试直接规范化
        startTime = TimeHandler.normalize(startDateAttr, { source: 'SFStation' });

        // 如果只有日期，尝试从文本中提取时间
        if (!startTime) {
          const dateStr = TimeHandler.extractDate(startDateAttr);
          const timeText = $el.find('.event-time').text().trim() ||
                          $el.find('.event_time').text().trim();

          if (dateStr && timeText) {
            startTime = TimeHandler.parseTimeText(dateStr, timeText);
          }
        }
      }

      // 如果 itemprop 没有或无效，尝试从 .event-date 提取
      if (!startTime) {
        const startDate = $el.find('.event-date').first().attr('content');
        const timeText = $el.find('.event-time').text().trim() ||
                        $el.find('.event_time').text().trim();

        if (startDate && timeText) {
          startTime = TimeHandler.parseTimeText(startDate, timeText);
        }
      }

      if (!startTime) {
        return null; // 没有有效时间信息，跳过
      }

      // 地点 - 改进提取逻辑
      let location = null;

      // 1. 尝试 itemprop="location" 的嵌套地址结构
      const $location = $el.find('[itemprop="location"]').first();
      if ($location.length > 0) {
        // 尝试获取结构化地址
        const $address = $location.find('[itemprop="address"]');
        if ($address.length > 0) {
          const street = $address.find('[itemprop="streetAddress"]').text().trim();
          const city = $address.find('[itemprop="addressLocality"]').text().trim();
          const state = $address.find('[itemprop="addressRegion"]').text().trim();
          const zip = $address.find('[itemprop="postalCode"]').text().trim();

          if (street) {
            const parts = [street, city, state, zip].filter(p => p);
            location = parts.join(', ');
          }
        }

        // 如果没有结构化地址，尝试 name 属性（场馆名）
        if (!location) {
          const venueName = $location.find('[itemprop="name"]').text().trim();
          if (venueName && venueName.length > 2) {
            location = venueName;
          }
        }

        // 最后尝试纯文本，但要清理
        if (!location) {
          let locationText = $location.text().trim();
          // 移除时间模式和多余信息
          locationText = locationText.replace(/\(\d{1,2}(?::\d{2})?\s*(?:am|pm|noon).*?\)/gi, '').trim();
          locationText = locationText.replace(/\d{1,2}(?::\d{2})?\s*(?:am|pm|noon).*/gi, '').trim();
          locationText = locationText.replace(/\s*\/\s*.*$/, '').trim();

          if (locationText && locationText.length > 2 && locationText.length < 200) {
            location = locationText;
          }
        }
      }

      // 2. 如果还没找到，尝试其他选择器
      if (!location) {
        const locationSelectors = ['.event_place', '.venue', '.location'];
        for (const sel of locationSelectors) {
          const loc = $el.find(sel).first().text().trim();
          if (loc && loc.length > 2 && loc.length < 200) {
            location = loc;
            break;
          }
        }
      }

      // 默认地点
      if (!location || location.length < 2) {
        location = 'San Francisco';
      }

      // 价格 - 改进提取逻辑
      let price = null;

      // 1. 尝试 itemprop="price"
      const priceContent = $el.find('[itemprop="price"]').attr('content');
      if (priceContent !== undefined && priceContent !== null) {
        if (priceContent === '0' || priceContent === '') {
          price = 'Free';
        } else {
          price = `$${priceContent}`;
        }
      }

      // 2. 尝试 itemprop="offers" 下的价格
      if (!price) {
        const $offers = $el.find('[itemprop="offers"]');
        if ($offers.length > 0) {
          const offerPrice = $offers.find('[itemprop="price"]').attr('content');
          if (offerPrice !== undefined) {
            if (offerPrice === '0' || offerPrice === '') {
              price = 'Free';
            } else {
              price = `$${offerPrice}`;
            }
          }

          // 检查 price validity
          const priceValid = $offers.find('[itemprop="priceCurrency"]').attr('content');
          if (priceValid === 'USD' && offerPrice) {
            price = offerPrice === '0' ? 'Free' : `$${offerPrice}`;
          }
        }
      }

      // 3. 在文本中查找 "Free" 关键词
      if (!price) {
        const allText = $el.text().toLowerCase();
        if (allText.includes('free admission') || allText.includes('free event') ||
            (allText.includes('free') && !allText.includes('free shipping'))) {
          price = 'Free';
        }
      }

      // 描述（避免提取到时间/地点等元数据）
      let description = $el.find('.event_description').text().trim() ||
                       $el.find('[itemprop="description"]').text().trim() ||
                       null;

      // 过滤掉无效内容
      if (description) {
        // 过滤条件：
        // 1. 太短（< 30字符）
        // 2. 主要是时间/日期格式
        // 3. 票务状态信息
        const hasDatePattern = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*\d{1,2}:\d{2}\s*(AM|PM)|^\d{1,2}:\d{2}\s*(AM|PM)|\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(description);
        const isTicketStatus = /almost full|sold out|only \d+ tickets|tickets? (left|remaining)/i.test(description);

        if (description.length < 30 || hasDatePattern || isTicketStatus) {
          description = null;
        }
      }

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

          // 解析时间 - 通用fallback不应该猜测时间，跳过没有明确时间的活动
          if (!timeText) return;

          // 尝试简单的日期解析，如果失败就跳过
          let startTime;
          try {
            const date = new Date(timeText);
            if (!isNaN(date.getTime())) {
              startTime = date.toISOString();
            } else {
              return; // 无效时间，跳过
            }
          } catch (e) {
            return; // 解析失败，跳过
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

    // 通用方法2：如果没有找到活动，不添加没有明确时间的活动
    // 遵循"时间必须精准"原则
    if (events.length === 0) {
      console.log('  No events found with standard methods, generic fallback would not provide accurate times');
    }

    return events.slice(0, 30);
  }

  // 从详情页提取详细描述
  extractDetailedDescription($) {
    // SF Station的活动描述通常在以下位置：
    // 1. [itemprop="description"]
    // 2. .event-description
    // 3. .description
    // 4. main article p

    const descriptionSelectors = [
      '[itemprop="description"]',
      '.event-description',
      '.event-detail-description',
      '.description',
      'article .description'
    ];

    for (const selector of descriptionSelectors) {
      const $desc = $(selector).first();
      if ($desc.length > 0) {
        let text = $desc.text().trim();

        // 清理文本
        text = text
          .replace(/\s+/g, ' ')  // 多个空格变成一个
          .replace(/\n+/g, '\n') // 多个换行变成一个
          .trim();

        // 如果描述足够长，返回
        if (text && text.length > 50) {
          return text.substring(0, 2000); // 限制在2000字符
        }
      }
    }

    // 如果找不到专门的描述区域，尝试从article提取段落
    const $article = $('article').first();
    if ($article.length > 0) {
      const paragraphs = [];
      $article.find('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 20) {
          paragraphs.push(text);
        }
      });

      if (paragraphs.length > 0) {
        return paragraphs.join('\n').substring(0, 2000);
      }
    }

    return null;
  }
}

module.exports = SFStationScraper;