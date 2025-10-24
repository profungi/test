const BaseScraper = require('./base-scraper');
const { parseISO, addDays, format, startOfWeek } = require('date-fns');
const TimeHandler = require('../utils/time-handler');

class FuncheapWeekendScraper extends BaseScraper {
  constructor() {
    super('funcheap');
  }

  async scrapeEvents(weekRange) {
    const events = [];

    try {
      // 获取下周的周五、周六、周日
      const weekendDates = this.getNextWeekendDates(weekRange);

      console.log(`Scraping Funcheap weekend events for dates: ${weekendDates.join(', ')}`);

      // 定义要抓取的分类
      const categories = [
        'fairs-festivals',
        'free-stuff'
      ];

      // 构建所有 URL
      const urls = this.buildUrls(weekendDates, categories);

      console.log(`Total URLs to fetch: ${urls.length}`);

      // 逐个抓取
      for (const urlInfo of urls) {
        try {
          console.log(`Fetching: ${urlInfo.url} (${urlInfo.category} - ${urlInfo.date})`);
          const $ = await this.fetchPage(urlInfo.url);
          const pageEvents = await this.parseFuncheapPage($);

          console.log(`  Found ${pageEvents.length} events`);
          events.push(...pageEvents);

        } catch (error) {
          console.warn(`Failed to fetch ${urlInfo.url}: ${error.message}`);
          // 继续尝试下一个URL
        }
      }

      console.log(`Total raw events collected: ${events.length}`);

      // URL 去重
      const uniqueEvents = this.deduplicateByUrl(events);
      console.log(`After deduplication: ${uniqueEvents.length} unique events`);

      return uniqueEvents;

    } catch (error) {
      console.error(`Error scraping Funcheap: ${error.message}`);
    }

    return events;
  }

  /**
   * 获取下周的周五、周六、周日
   * 当前周定义为 周一-周日，weekRange.start 是下周一
   * 所以下周的周五 = weekRange.start + 4天
   * 下周的周六 = weekRange.start + 5天
   * 下周的周日 = weekRange.start + 6天
   */
  getNextWeekendDates(weekRange) {
    const nextMonday = new Date(weekRange.start);

    const friday = addDays(nextMonday, 4);
    const saturday = addDays(nextMonday, 5);
    const sunday = addDays(nextMonday, 6);

    const dates = [
      format(friday, 'yyyy-MM-dd'),
      format(saturday, 'yyyy-MM-dd'),
      format(sunday, 'yyyy-MM-dd')
    ];

    console.log(`Weekend dates: ${dates.join(', ')}`);

    return dates;
  }

  /**
   * 构建所有要抓取的 URL
   * URL 格式: /category/event/event-types/{category}/YYYY/MM/DD/
   */
  buildUrls(weekendDates, categories) {
    const urls = [];

    for (const date of weekendDates) {
      const [year, month, day] = date.split('-');

      for (const category of categories) {
        const url = `https://sf.funcheap.com/category/event/event-types/${category}/${year}/${month}/${day}/`;

        urls.push({
          url,
          category,
          date
        });
      }
    }

    return urls;
  }

  /**
   * 解析 Funcheap 页面
   * Funcheap 使用 article.tanbox 作为事件容器
   */
  async parseFuncheapPage($) {
    const events = [];

    // 使用 CSS 选择器找到所有事件
    const eventSelectors = [
      'article.tanbox',
      'article.post'
    ];

    let eventElements = $();

    for (const selector of eventSelectors) {
      eventElements = $(selector);
      if (eventElements.length > 0) {
        console.log(`  Found ${eventElements.length} events with selector: ${selector}`);
        break;
      }
    }

    if (eventElements.length === 0) {
      console.log('  No events found with standard selectors');
      return events;
    }

    // 解析每个事件
    eventElements.each((i, element) => {
      try {
        const event = this.parseFuncheapEvent($, $(element));
        if (event) {
          events.push(event);
        }
      } catch (error) {
        console.warn(`  Failed to parse event ${i}: ${error.message}`);
      }
    });

    return events;
  }

  /**
   * 解析单个 Funcheap 事件
   */
  parseFuncheapEvent($, $article) {
    try {
      // 标题 - 从 h2 a 获取
      const title = $article.find('h2 a').text().trim();
      if (!title || title.length < 3) return null;

      // URL - 从 h2 a href 获取
      const originalUrl = $article.find('h2 a').attr('href');
      if (!originalUrl) return null;

      // 时间信息 - 从 .date-time 或 .meta 获取
      let startTime = null;
      let endTime = null;

      // 尝试从 data-event-date 属性获取
      const metaEl = $article.find('.meta.archive-meta.date-time');
      if (metaEl.length > 0) {
        const eventDate = metaEl.attr('data-event-date');
        const eventDateEnd = metaEl.attr('data-event-date-end');

        if (eventDate) {
          startTime = TimeHandler.normalize(eventDate, { source: 'Funcheap' });
        }
        if (eventDateEnd) {
          endTime = TimeHandler.normalize(eventDateEnd, { source: 'Funcheap' });
        }
      }

      // 如果没有从属性获取，尝试从文本获取
      if (!startTime) {
        const timeText = $article.find('.date-time, .fc-event-start-time').text().trim();
        if (timeText) {
          // 从文本中提取时间
          // 例如: "Saturday, October 25 – 5:00 pm"
          startTime = this.parseTimeText(timeText);
        }
      }

      if (!startTime) return null;

      // 地点
      let location = $article.find('.location').text().trim();
      if (!location) {
        location = 'San Francisco Bay Area';
      }

      // 价格 - 从 .cost_details 获取
      let price = null;
      const costText = $article.find('.cost_details').text().trim();
      if (costText) {
        // 移除 "Cost: " 前缀
        price = costText.replace(/^Cost:\s*/i, '').trim();

        // 如果是 "Free" 或类似
        if (price.toLowerCase() === 'free' || price === '$0') {
          price = 'Free';
        }
      }

      // 描述 - 从 .entry 获取
      let description = $article.find('.entry').text().trim();

      // 限制描述长度和清理
      if (description && description.length > 30) {
        description = description.substring(0, 500);
      } else {
        description = null;
      }

      return {
        title,
        startTime,
        endTime,
        location,
        price,
        description,
        originalUrl
      };

    } catch (error) {
      console.warn('Error parsing Funcheap event:', error.message);
      return null;
    }
  }

  /**
   * 从文本中解析时间
   * 例如: "Saturday, October 25 – 5:00 pm" 或 "Saturday, October 25 – 5:00 pm - Ends at 9:00 pm"
   */
  parseTimeText(timeText) {
    // 这是一个简化的解析，可能需要更复杂的逻辑
    // 对于 Funcheap，时间通常在页面的 meta 属性中，这是备选方案

    try {
      // 查找时间模式 HH:MM (am|pm)
      const timePattern = /(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)/i;
      const match = timeText.match(timePattern);

      if (match) {
        // 时间找到了，但我们需要日期
        // 由于我们已经知道是特定的日期（从URL），这里返回 null，
        // 让 normalizeEvent 使用 meta 属性中的日期
        return null;
      }
    } catch (error) {
      console.warn('Error parsing time text:', error.message);
    }

    return null;
  }

  /**
   * URL 去重
   */
  deduplicateByUrl(events) {
    const seen = new Map();

    return events.filter(event => {
      const url = event.originalUrl;

      if (seen.has(url)) {
        return false;
      }

      seen.set(url, true);
      return true;
    });
  }
}

module.exports = FuncheapWeekendScraper;
