const BaseScraper = require('./base-scraper');
const { parseISO, format } = require('date-fns');
const TimeHandler = require('../utils/time-handler');

class EventbriteScraper extends BaseScraper {
  constructor() {
    super('eventbrite');
  }

  async scrapeEvents(weekRange) {
    const events = [];
    const seenUrls = new Set(); // 用于去重

    try {
      // 1. 抓取旧金山的"下周活动"页面
      console.log('  Scraping San Francisco next week events...');
      const sfEvents = await this.scrapeEventsFromUrl(
        this.sourceConfig.baseUrl + this.sourceConfig.searchParams,
        weekRange,
        seenUrls,
        10 // 旧金山10个
      );
      events.push(...sfEvents);

      // 2. 抓取湾区其他城市的活动
      const additionalCities = this.sourceConfig.additionalCities || [];
      if (additionalCities.length > 0) {
        console.log(`  Scraping other Bay Area cities...`);

        for (const city of additionalCities) {
          if (events.length >= 80) break; // 总数限制增加到80

          try {
            const cityUrl = `${city.url}?start_date_keyword=next_week`;
            const maxEvents = city.maxEvents || 8; // 使用配置的数量，默认8个
            console.log(`    Scraping ${city.name} (max ${maxEvents})...`);

            const cityEvents = await this.scrapeEventsFromUrl(
              cityUrl,
              weekRange,
              seenUrls,
              maxEvents
            );

            if (cityEvents.length > 0) {
              console.log(`    Found ${cityEvents.length} events in ${city.name}`);
              events.push(...cityEvents);
            }
          } catch (error) {
            console.warn(`    Failed to scrape ${city.name}: ${error.message}`);
          }
        }
      }

      // 3. 【新增】第二层：类型定向抓取（food-and-drink, festivals-fairs, holiday）
      const categorySearches = this.sourceConfig.categorySearches || [];
      if (categorySearches.length > 0) {
        console.log(`\n  🎯 Layer 2: Category-targeted scraping (${categorySearches.length} categories)...`);

        // 只对小城市进行类型搜索（maxEvents <= 5 的城市）
        // 大城市（SF, San Jose, Palo Alto）第一层已经抓了足够多，跳过
        const smallCities = additionalCities.filter(city => city.maxEvents <= 5);

        console.log(`  📍 Targeting small cities only (${smallCities.length} cities): ${smallCities.map(c => c.name).join(', ')}`);
        console.log(`  ⏭️  Skipping large cities (already covered in Layer 1)\n`);

        const citiesToSearch = smallCities.map(city => ({
          name: city.name,
          baseUrl: city.url.replace('/events/', '').replace(/\/$/, '')
        }));

        for (const city of citiesToSearch) {
          if (events.length >= 150) break; // 总数限制

          for (const category of categorySearches) {
            if (!category.enabled) continue;

            try {
              // 构建类型搜索URL: /d/ca--saratoga/food-and-drink--events/?start_date_keyword=next_week
              const categoryUrl = `${city.baseUrl}/${category.name}--events/?start_date_keyword=next_week`;
              console.log(`    ${city.name} > ${category.displayName} (max ${category.maxPerCity})...`);

              const categoryEvents = await this.scrapeEventsFromUrl(
                categoryUrl,
                weekRange,
                seenUrls,
                category.maxPerCity
              );

              if (categoryEvents.length > 0) {
                console.log(`      ✅ Found ${categoryEvents.length} events`);
                // 标记来源
                categoryEvents.forEach(e => {
                  e.scrapeSource = `category:${category.name}`;
                  e.scrapeCity = city.name;
                });
                events.push(...categoryEvents);
              } else {
                console.log(`      (no events found)`);
              }
            } catch (error) {
              console.warn(`      ❌ Failed: ${error.message}`);
            }
          }
        }

        console.log(`  🎯 Layer 2 complete. Total events now: ${events.length}\n`);
      }

      // 4. 抓取特定关键词的活动（festival, fair, market等）
      // 优化：只在没有足够活动时才进行关键词搜索，节省时间
      const additionalSearches = this.sourceConfig.additionalSearches || [];
      const keywordSearchThreshold = 50; // 如果已有超过50个事件，跳过关键词搜索

      if (additionalSearches.length > 0 && events.length < keywordSearchThreshold) {
        console.log(`  📊 Current events: ${events.length}/${keywordSearchThreshold} (keyword search threshold)`);
        console.log(`  Scraping additional searches: ${additionalSearches.join(', ')}`);

        for (const keyword of additionalSearches) {
          if (events.length >= 150) break; // 总数限制增加到150

          try {
            const searchUrl = `${this.sourceConfig.baseUrl}?q=${encodeURIComponent(keyword)}&start_date_keyword=next_week`;
            console.log(`    Searching for: ${keyword}`);

            const keywordEvents = await this.scrapeEventsFromUrl(
              searchUrl,
              weekRange,
              seenUrls,
              8 // 每个关键词最多8个
            );

            if (keywordEvents.length > 0) {
              console.log(`    Found ${keywordEvents.length} ${keyword} events`);
              events.push(...keywordEvents);
            }
          } catch (error) {
            console.warn(`    Failed to search ${keyword}: ${error.message}`);
          }
        }
      } else if (events.length >= keywordSearchThreshold) {
        console.log(`  ⏭️  Skipping keyword searches (already have ${events.length} events, threshold: ${keywordSearchThreshold})`);
      }

    } catch (error) {
      console.error(`Error scraping Eventbrite: ${error.message}`);
    }

    console.log(`  Total Eventbrite events: ${events.length}`);
    return events;
  }

  // 从单个URL抓取活动
  async scrapeEventsFromUrl(url, weekRange, seenUrls, maxEvents = 20) {
    const events = [];

    try {
      // 只抓取第一页，避免太慢
      const $ = await this.fetchPage(url);
      const pageEvents = await this.parseEventbritePage($);

      // 对每个事件，访问详情页获取完整信息
      for (let i = 0; i < pageEvents.length && events.length < maxEvents; i++) {
        const event = pageEvents[i];

        // 检查URL去重
        if (seenUrls.has(event.originalUrl)) {
          continue;
        }
        seenUrls.add(event.originalUrl);

        if (event.originalUrl) {
          try {
            const detailedEvent = await this.fetchEventDetails(event);
            events.push(detailedEvent);
          } catch (error) {
            console.warn(`    Failed to fetch details: ${error.message}`);
            // 如果详情页失败，使用列表页的基本信息
            events.push(event);
          }
        }
      }

    } catch (error) {
      console.warn(`Error scraping URL ${url}: ${error.message}`);
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
    // 注意：Eventbrite 列表页通常没有真正的活动描述
    // 只有票务状态（Almost full）、时间等元数据
    // 我们直接跳过列表页的description提取，完全依赖详情页的 description_detail

    // 如果将来需要从列表页提取，可以使用以下选择器：
    // '[class*="event-card__description"]'
    // '[class*="event-description"]'
    // '[data-testid="event-summary"]'

    // 但需要严格过滤掉：
    // - 票务状态：Almost full, Sold out, Only X tickets left
    // - 时间信息：包含时间格式的文本
    // - 地点信息：地址格式的文本

    // 目前策略：列表页返回null，只使用详情页的 description_detail
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
    // 注意：这是最后的fallback方法
    // 这些事件的时间信息不准确，但会在fetchEventDetails中获取准确时间
    // 如果详情页也无法获取时间，这些事件会被过滤掉
    console.log('  Using generic fallback - events will need detail page validation');

    const events = [];

    // 通用方法：寻找包含链接的元素
    $('a[href*="/e/"]').each((i, element) => {
      try {
        const $link = $(element);
        const href = $link.attr('href');
        const title = $link.text().trim();

        if (title && href && title.length > 5) {
          const fullUrl = href.startsWith('http') ? href : `https://www.eventbrite.com${href}`;

          // 注意：这里使用临时时间，必须通过详情页获取准确时间
          events.push({
            title,
            startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 临时 - 需要详情页验证
            location: 'San Francisco Bay Area', // 默认 - 需要详情页验证
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

    // 提取页面分类（Eventbrite原生分类）
    const pageCategory = this.extractCategory($);

    // 提取详细描述
    const detailedDescription = this.extractDetailedDescription($);

    return {
      ...basicEvent,
      location: fullAddress || basicEvent.location,
      startTime: timeInfo.startTime || basicEvent.startTime,
      endTime: timeInfo.endTime || basicEvent.endTime,
      price: accuratePrice || basicEvent.price,
      pageCategory: pageCategory,
      description: detailedDescription || basicEvent.description, // 使用详情页描述替换列表页的错误内容
      description_detail: detailedDescription // 详细描述
    };
  }

  // 从详情页提取完整地址
  extractFullAddress($) {
    // 🔧 方案 A：分别提取地址的各个部分，然后用正确的分隔符组合
    // Eventbrite 的地址结构（在不同的子元素中）：
    // - 元素1：场馆名称 (Venue Name)
    // - 元素2：街道地址 (Street Address)
    // - 元素3：城市, 州 邮编 (City, State ZIP)
    //
    // 组合规则：所有部分都用 ", " 分隔
    // 元素1 + ", " + 元素2 + ", " + 元素3
    // 例如：Thrive City, 1 Warriors Way, San Francisco, CA 94158

    const $address = $('[class*="address"]').first();
    if ($address.length > 0) {
      // 方法1：尝试获取所有直接子元素
      const children = $address.children();

      if (children.length >= 2) {
        const parts = [];

        children.each((i, elem) => {
          const text = $(elem).text().trim();
          // 过滤掉 "Get directions" 等非地址文本
          if (text && !text.match(/get directions|view map|map/i) && text.length > 1) {
            parts.push(text);
          }
        });

        // 如果成功提取到2-3个部分
        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];

          // 检查最后一部分是否包含州和邮编
          if (lastPart.match(/,?\s*[A-Z]{2}\s+\d{5}/)) {
            if (parts.length === 2) {
              // 两部分：街道地址 + 城市州邮编
              return `${parts[0]}, ${parts[1]}`;
            } else if (parts.length === 3) {
              // 三部分：场馆名 + 街道地址 + 城市州邮编 - 都用逗号分隔
              return `${parts[0]}, ${parts[1]}, ${parts[2]}`;
            } else if (parts.length > 3) {
              // 超过三部分：所有部分都用 ", " 连接
              return parts.join(', ');
            }
          }
        }
      }

      // 方法2：如果直接子元素提取失败，尝试查找所有可能的地址元素
      // 寻找包含地址信息的 div/span/p 标签
      const addressElements = $address.find('div, span, p').filter((i, elem) => {
        const $elem = $(elem);
        const text = $elem.text().trim();

        // 过滤条件：
        // 1. 有文本内容
        // 2. 不是 "Get directions" 等
        // 3. 不是父元素（避免重复）
        const hasChildren = $elem.children().length > 0;
        const isValidText = text &&
                           !text.match(/get directions|view map|^map$/i) &&
                           text.length > 1 &&
                           text.length < 200; // 避免包含整个页面的元素

        return isValidText && !hasChildren;
      });

      if (addressElements.length >= 2) {
        const parts = [];
        const seenTexts = new Set();

        addressElements.each((i, elem) => {
          const text = $(elem).text().trim();
          // 避免重复（子元素可能包含父元素的文本）
          if (!seenTexts.has(text) && !Array.from(seenTexts).some(seen => seen.includes(text) || text.includes(seen))) {
            parts.push(text);
            seenTexts.add(text);
          }
        });

        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];

          if (lastPart.match(/,?\s*[A-Z]{2}\s+\d{5}/)) {
            if (parts.length === 2) {
              return `${parts[0]}, ${parts[1]}`;
            } else if (parts.length >= 3) {
              // 所有部分都用 ", " 连接
              return parts.join(', ');
            }
          }
        }
      }

      // 方法3：后备方案 - 如果前两种方法都失败，返回基本清理后的文本
      let addressText = $address.text().trim();
      addressText = addressText.replace(/Get directions.*$/i, '').trim();

      if (addressText) {
        return addressText;
      }
    }

    return null;
  }

  // 从详情页提取精确时间（使用旧金山本地时间）
  extractDetailedTime($) {
    // 1. 查找 <time> 标签的 datetime 属性
    const $time = $('time[datetime]').first();

    if ($time.length > 0) {
      const datetime = $time.attr('datetime');

      if (datetime) {
        // 1a. 尝试从页面文本提取时间范围（优先）
        const timeText = $('[class*="time"], [class*="date"]').filter((i, el) => {
          const text = $(el).text();
          return text.includes('·') && text.match(/\d+\s*[-–]\s*\d+\s*[ap]m/i);
        }).first().text();

        if (timeText) {
          const dateStr = TimeHandler.extractDate(datetime);
          if (dateStr) {
            const timeRange = TimeHandler.parseTimeRange(dateStr, timeText);
            if (timeRange) {
              return timeRange;
            }
          }
        }

        // 1b. 使用datetime属性
        const startTime = TimeHandler.normalize(datetime, {
          source: 'Eventbrite',
          allowTextParsing: false
        });

        if (startTime) {
          return { startTime, endTime: null };
        }
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

  // 从详情页提取Eventbrite的原生分类
  extractCategory($) {
    // Eventbrite的分类通常在以下位置：
    // 1. Schema.org标记: <meta property="event:category" content="Music">
    // 2. 面包屑导航: <a>Music</a>
    // 3. 类别标签: <span class="category">Music</span>

    // 尝试1: meta标签
    const metaCategory = $('meta[property="event:category"]').attr('content') ||
                        $('meta[name="category"]').attr('content');
    if (metaCategory) {
      return metaCategory.trim();
    }

    // 尝试2: 查找包含"Category"的文本附近的内容
    const categorySelectors = [
      '[class*="category"]',
      '[data-testid*="category"]',
      'a[href*="/d/"][href*="/events"]', // Eventbrite分类链接格式
    ];

    for (const selector of categorySelectors) {
      const $el = $(selector).first();
      if ($el.length > 0) {
        const text = $el.text().trim();
        // 过滤掉明显不是分类的文本（如太长、包含数字等）
        if (text && text.length < 30 && !text.match(/\d{2,}/)) {
          return text;
        }
      }
    }

    // 尝试3: 从URL中提取分类（如果有的话）
    // Eventbrite URL格式: /e/category-name-tickets-xxxxx
    const url = $('link[rel="canonical"]').attr('href') || '';
    const urlMatch = url.match(/\/([^\/]+)-tickets-\d+/);
    if (urlMatch) {
      // 将URL中的连字符转换为空格，并转为标题格式
      const category = urlMatch[1].split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      return category;
    }

    return null;
  }

  // 从详情页提取详细描述
  extractDetailedDescription($) {
    // Eventbrite的活动描述通常在以下位置：
    // 1. <div class="structured-content-rich-text">
    // 2. [data-testid="description"]
    // 3. .event-details__main
    // 4. [class*="description"]

    const descriptionSelectors = [
      '[class*="structured-content"]',
      '[data-testid="description"]',
      '[class*="event-details__main"]',
      '[class*="description-content"]',
      '[class*="event-description"]',
      '.event-details'
    ];

    // 🔧 FIX: 改进的选择器遍历逻辑
    // 不仅检查元素是否存在，还要找到真正有内容的元素
    for (const selector of descriptionSelectors) {
      // 查找所有匹配的元素，不仅仅是第一个
      const elements = $(selector);

      for (let i = 0; i < elements.length; i++) {
        const $desc = $(elements[i]);
        let text = $desc.text().trim();

        // 清理文本
        text = text
          .replace(/\s+/g, ' ')  // 多个空格变成一个
          .replace(/\n+/g, '\n') // 多个换行变成一个
          .trim();

        // 修复：去掉开头的 "Overview"（不区分大小写）
        text = text.replace(/^overview\s*/i, '');

        // 如果描述足够长，返回（不限制长度，让AI处理）
        if (text && text.length > 50) {
          return text;
        }
      }
    }

    // 如果找不到专门的描述区域，尝试从main content提取
    const $main = $('main').first();
    if ($main.length > 0) {
      // 查找所有段落
      const paragraphs = [];
      $main.find('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 20) {
          paragraphs.push(text);
        }
      });

      if (paragraphs.length > 0) {
        let result = paragraphs.join('\n').substring(0, 2000); // 限制在2000字符
        // 修复：去掉开头的 "Overview"（不区分大小写）
        result = result.replace(/^overview\s*/i, '');
        return result;
      }
    }

    return null;
  }
}

module.exports = EventbriteScraper;