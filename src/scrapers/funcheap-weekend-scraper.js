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
          console.log(`Fetching: ${urlInfo.url} (${urlInfo.category})`);
          const $ = await this.fetchPage(urlInfo.url);
          const pageEvents = await this.parseFuncheapPage($, urlInfo.dateFilter);

          console.log(`  Found ${pageEvents.length} events`);
          events.push(...pageEvents);

          // 尝试获取下一页
          const nextPageUrl = this.getNextPageUrl($, urlInfo.url);
          if (nextPageUrl && events.length < 50) { // 防止无限循环
            console.log(`  Found next page: ${nextPageUrl}`);
            try {
              const $next = await this.fetchPage(nextPageUrl);
              const nextPageEvents = await this.parseFuncheapPage($next, urlInfo.dateFilter);
              console.log(`  Found ${nextPageEvents.length} events on next page`);
              events.push(...nextPageEvents);
            } catch (error) {
              console.warn(`  Failed to fetch next page: ${error.message}`);
            }
          }

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
   * Funcheap 的日期 URL 过滤可能不稳定，所以我们抓取基础分类页面
   * 然后在代码中根据事件的实际时间过滤周末事件
   */
  buildUrls(weekendDates, categories) {
    const urls = [];

    // 只构建基础分类 URL，不添加日期过滤
    for (const category of categories) {
      const url = `https://sf.funcheap.com/category/event/event-types/${category}/`;

      urls.push({
        url,
        category,
        dateFilter: weekendDates  // 在解析时使用这些日期进行过滤
      });
    }

    return urls;
  }

  /**
   * 解析 Funcheap 页面
   * Funcheap 使用 div.tanbox 作为事件容器（有 id="post-{ID}" 属性）
   */
  async parseFuncheapPage($, dateFilter = null) {
    const events = [];

    // 使用 CSS 选择器找到所有事件
    // div.tanbox[id^="post-"] 会排除广告和其他非事件元素
    const eventSelectors = [
      'div.tanbox[id^="post-"]',  // 最精确的选择器（只返回真实事件）
      'div.tanbox'                // 备选选择器（可能包含一些非事件元素）
    ];

    let eventElements = $();

    for (const selector of eventSelectors) {
      eventElements = $(selector);
      if (eventElements.length > 0) {
        console.log(`  Found ${eventElements.length} total events with selector: ${selector}`);
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
          // 如果提供了 dateFilter，则只保留符合日期的事件
          if (dateFilter && !this.isEventOnWeekend(event.startTime, dateFilter)) {
            return; // 跳过不符合日期的事件
          }
          events.push(event);
        }
      } catch (error) {
        console.warn(`  Failed to parse event ${i}: ${error.message}`);
      }
    });

    console.log(`  After date filtering: ${events.length} events`);
    return events;
  }

  /**
   * 检查事件是否在指定的周末日期
   */
  isEventOnWeekend(eventStartTime, weekendDates) {
    if (!eventStartTime || !weekendDates || weekendDates.length === 0) {
      return true; // 如果无法判断，保留事件
    }

    try {
      // eventStartTime 格式: "2025-10-24T10:00:00" 或类似
      const eventDateStr = eventStartTime.split('T')[0]; // 提取 YYYY-MM-DD 部分

      // 检查事件日期是否在周末日期列表中
      return weekendDates.includes(eventDateStr);
    } catch (error) {
      console.warn(`Error checking event date: ${error.message}`);
      return true; // 出错时保留事件
    }
  }

  /**
   * 获取下一页 URL
   * Funcheap 使用分页，下一页 URL 通常在 a.next-posts-link 或类似的地方
   */
  getNextPageUrl($, currentUrl) {
    // 寻找"下一页"链接
    const nextLink = $('a.next-posts-link, a[rel="next"], .pagination a.next, a[title*="next" i]').attr('href');
    if (nextLink) {
      return nextLink;
    }

    // 如果没有找到"下一页"链接，尝试生成下一页 URL
    // 支持两种方式：?paged=2 或 /page/2/
    if (currentUrl.includes('?')) {
      // URL 已有参数，用 & 添加分页参数
      return `${currentUrl}&paged=2`;
    } else if (currentUrl.endsWith('/')) {
      // URL 以 / 结尾，用 page/2/ 添加
      return `${currentUrl}page/2/`;
    } else {
      // 尝试添加分页参数
      return `${currentUrl}?paged=2`;
    }
  }

  /**
   * 解析单个 Funcheap 事件
   * HTML 结构:
   * div.tanbox
   *   span.title.entry-title > a[href] → 标题和链接
   *   div.meta.archive-meta.date-time[data-event-date][data-event-date-end]
   *     span.cost → "Cost: $9" 或 "Cost: FREE"
   *     span (no class) → 地点
   *   div.thumbnail-wrapper
   *   text node → 描述
   */
  parseFuncheapEvent($, $article) {
    try {
      // 标题 - 从 span.title.entry-title > a 获取
      const titleLink = $article.find('span.title.entry-title a');
      const title = titleLink.text().trim();
      if (!title || title.length < 3) return null;

      // URL - 从 a href 获取
      const originalUrl = titleLink.attr('href');
      if (!originalUrl) return null;

      // 时间信息 - 从 div.meta data-event-date 属性获取
      let startTime = null;
      let endTime = null;

      const metaEl = $article.find('div.meta.archive-meta.date-time');
      if (metaEl.length > 0) {
        const eventDate = metaEl.attr('data-event-date');
        const eventDateEnd = metaEl.attr('data-event-date-end');

        if (eventDate) {
          // eventDate 格式: "2025-10-24 10:00"（用空格而不是 T）
          // 需要转换为 TimeHandler 期望的格式: "2025-10-24T10:00"
          const isoFormatDate = eventDate.replace(' ', 'T');
          startTime = TimeHandler.normalize(isoFormatDate, { source: 'Funcheap' });
        }
        if (eventDateEnd) {
          // 同样处理结束时间
          const isoFormatDateEnd = eventDateEnd.replace(' ', 'T');
          endTime = TimeHandler.normalize(isoFormatDateEnd, { source: 'Funcheap' });
        }
      }

      if (!startTime) return null;

      // 地点 - 从 div.meta 中获取，在所有 span 之后
      let location = null;

      // 获取 meta 元素的所有文本，然后找到最后的地点信息
      // 地点通常在最后一个 span.cost 或其他 span 之后的文本
      const metaText = metaEl.text();

      // 尝试从最后一个没有 class 的 span 获取
      const allMetaSpans = metaEl.find('span');
      if (allMetaSpans.length > 0) {
        // 遍历所有 span，找到最后一个没有特定 class 的（通常是地点）
        for (let i = allMetaSpans.length - 1; i >= 0; i--) {
          const span = $(allMetaSpans[i]);
          const spanClass = span.attr('class');
          // 跳过时间和成本相关的 span
          if (!spanClass || (!spanClass.includes('fc-event') && !spanClass.includes('cost'))) {
            location = span.text().trim();
            if (location && location.length > 0) {
              break;
            }
          }
        }
      }

      if (!location) {
        location = 'San Francisco Bay Area';
      }

      // 价格 - 从 div.meta 的文本内容中提取 "Cost: XXX" 部分
      let price = null;

      // 方法1：尝试从 span.cost 后面的文本获取价格
      const costMatch = metaText.match(/Cost:\s*([^\|]*)/i);
      if (costMatch) {
        price = costMatch[1].trim();

        // 清理价格字符串（移除 RSVP 等额外信息）
        price = price.split('\n')[0].trim(); // 只取第一行

        // 规范化为 'Free'
        if (price.toLowerCase().includes('free')) {
          price = 'Free';
        } else if (!price || price.length === 0) {
          price = null;
        }
      }

      if (!price) {
        price = null; // 如果没有找到价格，保留为 null
      }

      // 描述 - 从 div.thumbnail-wrapper 后的文本获取
      let description = null;
      const thumbnailWrapper = $article.find('div.thumbnail-wrapper');
      if (thumbnailWrapper.length > 0) {
        // 获取 thumbnail-wrapper 之后的所有文本内容
        // 包括文本节点和可能的 HTML 元素（如 <p> 标签）
        let text = '';
        let node = thumbnailWrapper[0].nextSibling;

        while (node) {
          if (node.nodeType === 3) {
            // 文本节点
            const nodeText = node.textContent.trim();
            if (nodeText) {
              text += nodeText + ' ';
            }
          } else if (node.nodeType === 1) {
            // 元素节点 - 获取其文本内容
            const $node = $(node);
            const nodeText = $node.text().trim();
            if (nodeText && nodeText.length > 0) {
              text += nodeText + ' ';
            }
          }
          node = node.nextSibling;
        }

        description = text.trim();
      }

      // 清理描述 - 移除重复的空格和过长的字符串
      if (description && description.length > 0) {
        // 移除过多的空格
        description = description.replace(/\s+/g, ' ');

        // 限制描述长度 - 允许更长的描述（500字符）
        if (description.length > 500) {
          // 尝试在词边界处截断
          const truncated = description.substring(0, 500);
          const lastSpace = truncated.lastIndexOf(' ');
          if (lastSpace > 300) {
            description = truncated.substring(0, lastSpace) + '...';
          } else {
            description = truncated + '...';
          }
        }
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
