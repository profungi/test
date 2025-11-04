const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { addDays, startOfWeek, endOfWeek, format, parseISO, isWithinInterval } = require('date-fns');
const config = require('../config');

class BaseScraper {
  constructor(sourceName) {
    this.sourceName = sourceName;
    this.sourceConfig = config.eventSources.find(s => s.name === sourceName);
    if (!this.sourceConfig) {
      throw new Error(`No configuration found for source: ${sourceName}`);
    }

    this.axiosInstance = axios.create({
      timeout: config.scraping.timeout,
      headers: {
        'User-Agent': config.scraping.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    // Puppeteer browser instance (共享实例以提高性能)
    this.browser = null;

    // Puppeteer 并发控制 - 限制同时打开的页面数量
    this.activePagesCount = 0;
    this.maxConcurrentPages = 3; // 最多同时3个页面，避免连接过多
    this.pageQueue = [];
  }

  // 获取下周的时间范围 (周一到周日)
  // 基准时间为当前抓取时间
  getNextWeekRange() {
    const today = new Date();
    console.log(`[Time Range] Today is: ${format(today, 'yyyy-MM-dd (EEEE)')}`);

    // 找到本周的周一
    const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
    console.log(`[Time Range] This week Monday: ${format(thisWeekMonday, 'yyyy-MM-dd')}`);

    // 加7天得到下周一
    const nextMonday = addDays(thisWeekMonday, 7);
    const nextSunday = endOfWeek(nextMonday, { weekStartsOn: 1 });

    console.log(`[Time Range] Next week range: ${format(nextMonday, 'yyyy-MM-dd')} to ${format(nextSunday, 'yyyy-MM-dd')}`);

    return {
      start: nextMonday,
      end: nextSunday,
      identifier: format(nextMonday, 'yyyy-MM-dd') + '_to_' + format(nextSunday, 'yyyy-MM-dd')
    };
  }

  // 验证事件时间是否在下周范围内
  isValidEventTime(eventTime, weekRange) {
    try {
      if (!eventTime) return false;

      // 处理本地时间字符串（不含时区）
      // 输入格式: "2025-10-06T18:00:00" 或 "2025-10-06T18:00:00.000Z"
      let eventDate;

      if (typeof eventTime === 'string') {
        // 如果是本地时间格式（不含Z或时区偏移），直接解析
        if (!eventTime.includes('Z') && !eventTime.match(/[+-]\d{2}:\d{2}$/)) {
          // 本地时间，直接创建Date对象（会使用本地时区）
          eventDate = new Date(eventTime);
        } else {
          // ISO格式（含时区），使用parseISO
          eventDate = parseISO(eventTime);
        }
      } else {
        eventDate = eventTime;
      }

      // 验证日期是否有效
      if (isNaN(eventDate.getTime())) {
        console.warn(`Invalid event time format: ${eventTime}`);
        return false;
      }

      // 比较日期（只比较日期部分，不考虑具体时间）
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const rangeStartOnly = new Date(weekRange.start.getFullYear(), weekRange.start.getMonth(), weekRange.start.getDate());
      const rangeEndOnly = new Date(weekRange.end.getFullYear(), weekRange.end.getMonth(), weekRange.end.getDate());

      const isValid = eventDateOnly >= rangeStartOnly && eventDateOnly <= rangeEndOnly;

      // 调试：对于 11-13 到 11-16 的活动，输出详细信息
      if (eventTime.startsWith('2025-11-1')) {
        console.log(`\n🔍 Date validation debug for: ${eventTime}`);
        console.log(`   Event date object: ${eventDate.toISOString()}`);
        console.log(`   Event date only: ${eventDateOnly.toISOString().split('T')[0]}`);
        console.log(`   Range start: ${rangeStartOnly.toISOString().split('T')[0]}`);
        console.log(`   Range end: ${rangeEndOnly.toISOString().split('T')[0]}`);
        console.log(`   Is valid: ${isValid}`);
        console.log(`   Comparison: ${eventDateOnly.getTime()} >= ${rangeStartOnly.getTime()} && ${eventDateOnly.getTime()} <= ${rangeEndOnly.getTime()}`);
      }

      return isValid;
    } catch (error) {
      console.warn(`Error validating event time: ${eventTime} - ${error.message}`);
      return false;
    }
  }

  // 规范化活动数据
  normalizeEvent(rawEvent, weekRange) {
    // 清理 location，移除 URL 和时间信息
    let cleanedLocation = this.cleanText(rawEvent.location);
    cleanedLocation = this.cleanLocationText(cleanedLocation);

    const normalized = {
      title: this.cleanText(rawEvent.title),
      startTime: rawEvent.startTime,
      endTime: rawEvent.endTime || null,
      location: cleanedLocation,
      price: this.normalizePrice(rawEvent.price, rawEvent.title, rawEvent.description),
      description: this.cleanText(rawEvent.description) || '',
      description_detail: rawEvent.description_detail || null, // ✨ 保留详细描述
      originalUrl: rawEvent.originalUrl,
      source: this.sourceName,
      eventType: this.detectEventType(rawEvent.title, rawEvent.description),
      scraped_at: new Date().toISOString(),
      weekIdentifier: weekRange.identifier
    };

    // 验证必填字段
    if (!normalized.title || !normalized.startTime || !normalized.location || !normalized.originalUrl) {
      return null;
    }

    // 过滤无效的标题（网站UI元素）
    if (this.isInvalidTitle(normalized.title)) {
      return null;
    }

    // 验证时间范围
    if (!this.isValidEventTime(normalized.startTime, weekRange)) {
      console.log(`  ⏰ [${this.sourceName}] Event filtered by date: "${normalized.title}" (${normalized.startTime} not in ${weekRange.identifier})`);
      return null;
    }

    return normalized;
  }

  // 检查是否是无效的标题（网站UI元素，而非真正的活动）
  isInvalidTitle(title) {
    const invalidPatterns = [
      /^(buy tickets?|get tickets?|tickets?)$/i,
      /^(add event|add to calendar|my events?)$/i,
      /^(login|sign in|sign up|register)$/i,
      /^(share|follow|subscribe)$/i,
      /^(search|filter|view all|see all)$/i,
      /^(home|about|contact|help)$/i,
      /^(menu|navigation)$/i,
      /^[a-z\s]{1,3}$/i,  // 太短的标题（1-3个字符）
      /^\s*$/,  // 空白
    ];

    // 特定网站的UI元素
    const siteSpecificPatterns = [
      /oakland arena tix/i,
      /^(all|music|art|food|sports|comedy|theater)$/i,  // 分类标签
    ];

    // 工作、职业和会议相关的活动（不感兴趣）
    const workRelatedPatterns = [
      /\b(job|jobs|career|careers|hiring|recruitment|recruiter)\b/i,
      /\b(conference|summit|workshop|seminar|webinar|training)\b/i,
      /\b(networking event|business|corporate|professional)\b/i,
      /\b(interview|resume|cv|portfolio review)\b/i,
    ];

    const allPatterns = [...invalidPatterns, ...siteSpecificPatterns, ...workRelatedPatterns];

    return allPatterns.some(pattern => pattern.test(title));
  }

  // 规范化价格信息 - 更严格的判断
  normalizePrice(price, title, description) {
    // 如果有明确的价格信息
    if (price) {
      const priceText = this.cleanText(price).toLowerCase();

      // 明确的免费标识
      if (/^(free|$0|no charge|complimentary|free admission|free entry)$/i.test(priceText)) {
        return 'Free';
      }

      // 包含价格数字
      if (/\$\d+|\d+\s*usd|price|ticket|admission/i.test(priceText)) {
        return this.cleanText(price);
      }

      // 其他情况返回原始价格信息
      return this.cleanText(price);
    }

    // 没有价格信息时，从标题和描述中推断
    const combinedText = ((title || '') + ' ' + (description || '')).toLowerCase();

    // 明确提到免费
    if (/\bfree\s+(admission|entry|event|show|concert)\b/i.test(combinedText)) {
      return 'Free';
    }

    // 明确提到价格或票
    if (/ticket|admission|price|\$\d+|\d+\s*usd|pay|cost|donation/i.test(combinedText)) {
      return 'See event page';  // 不确定价格，让用户查看活动页面
    }

    // 默认情况：价格未知
    return 'Check event page';
  }

  // 清理文本内容
  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' ')
      .trim()
      .substring(0, 500); // 防止过长
  }

  // 清理 location 文本，移除 URL 和时间信息
  cleanLocationText(location) {
    if (!location) return '';

    // 移除 URL（http:// 或 https:// 开头的链接）
    location = location.replace(/https?:\/\/[^\s]+/gi, '');

    // 移除括号中的时间信息（如 "(8:30pm)" 或 "(7:00 PM - 10:00 PM)"）
    location = location.replace(/\([^)]*\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)[^)]*\)/gi, '');

    // 移除开头的 "at " 或 "At "
    location = location.replace(/^at\s+/i, '');

    // 移除多余的空格
    location = location.replace(/\s+/g, ' ').trim();

    return location;
  }

  // 从元素中提取干净的 location，移除嵌套的链接和时间元素
  extractCleanLocation($, $el, selectors, defaultLocation) {
    for (const selector of selectors) {
      const $locationEl = $el.find(selector).first();
      if ($locationEl.length > 0) {
        // 如果是属性，直接返回
        if (selector.includes('attr:')) {
          const attrName = selector.split(':')[1];
          const attrValue = $locationEl.attr(attrName);
          if (attrValue && attrValue.length > 3) {
            return this.cleanLocationText(attrValue);
          }
          continue;
        }

        // Clone 元素以避免修改原始 DOM
        const $clone = $locationEl.clone();

        // 移除所有链接元素（<a> 标签）
        $clone.find('a').remove();

        // 移除时间相关的元素
        $clone.find('.time, .event-time, .ds-event-time, [class*="time"]').remove();

        // 获取清理后的文本
        let location = $clone.text().trim();

        if (location && location.length > 3) {
          // 进一步清理
          location = this.cleanLocationText(location);

          if (location && location.length > 3) {
            return location;
          }
        }
      }
    }

    return defaultLocation || 'San Francisco';
  }

  // 检测活动类型
  detectEventType(title, description) {
    const text = (title + ' ' + (description || '')).toLowerCase();
    
    const patterns = {
      market: /market|farmer|artisan|craft|vendor/i,
      fair: /fair|expo|bazaar|festival/i,
      festival: /festival|fest|celebration|carnival/i,
      food: /food|dining|restaurant|culinary|wine|beer|taste/i,
      music: /music|concert|band|dj|performance|show/i,
      art: /art|gallery|museum|exhibition|design/i,
      tech: /tech|startup|coding|developer|innovation/i,
      free: /free|no cost|complimentary/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return type;
      }
    }

    return 'other';
  }

  // 检查地理位置是否相关
  isRelevantLocation(location) {
    if (!location) return false;
    
    const locationText = location.toLowerCase();
    const allLocations = [
      ...config.locations.primary,
      ...config.locations.secondary,
      ...config.locations.keywords
    ];

    return allLocations.some(loc => 
      locationText.includes(loc.toLowerCase())
    );
  }

  // 添加延迟以避免过于频繁的请求
  async delay(ms = config.scraping.requestDelay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 等待页面任务槽位变可用
  async waitForPageSlot() {
    while (this.activePagesCount >= this.maxConcurrentPages) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // 初始化 Puppeteer browser（如果还没有）
  async initBrowser() {
    if (!this.browser) {
      console.log('Launching Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
      console.log('Browser launched successfully');
    }
    return this.browser;
  }

  // 关闭 Puppeteer browser
  async closeBrowser() {
    if (this.browser) {
      console.log('Closing Puppeteer browser...');
      await this.browser.close();
      this.browser = null;
    }
  }

  // 使用 Puppeteer 抓取页面（可以看到 JavaScript 渲染后的内容）
  async fetchPage(url, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let page = null;
      let pageSlotAcquired = false;

      try {
        await this.delay();

        // 等待可用的页面槽位
        await this.waitForPageSlot();
        pageSlotAcquired = true;
        this.activePagesCount++;

        console.log(`Fetching with Puppeteer: ${url} (attempt ${attempt}/${maxRetries}, active: ${this.activePagesCount}/${this.maxConcurrentPages})`);

        const browser = await this.initBrowser();
        page = await browser.newPage();

        // 设置 User-Agent
        await page.setUserAgent(config.scraping.userAgent);

        // 设置视口大小
        await page.setViewport({ width: 1920, height: 1080 });

        // 设置更短的超时时间，防止卡住
        page.setDefaultTimeout(20000);
        page.setDefaultNavigationTimeout(20000);

        // 导航到URL，使用更激进的超时策略
        let response = null;
        try {
          response = await page.goto(url, {
            waitUntil: 'domcontentloaded', // 改为只等待 DOM 加载，不等待所有网络请求
            timeout: 15000
          });
        } catch (navigationError) {
          // 即使导航超时，也尝试继续获取已加载的内容
          console.warn(`Navigation timeout, proceeding with current content: ${navigationError.message}`);
        }

        // 检查HTTP状态码
        if (response) {
          const statusCode = response.status();
          if (statusCode === 404) {
            // 关闭页面
            await page.close();
            page = null;
            this.activePagesCount--;

            // 返回特殊标记表示404
            const $ = cheerio.load('<html><body>__404_PAGE__</body></html>');
            $.is404 = true; // 添加404标记
            return $;
          }

          // 其他非200状态码也记录日志
          if (statusCode !== 200) {
            console.warn(`HTTP ${statusCode} for ${url}`);
          }
        }

        // 等待一会儿让动态内容加载（更短的等待时间）
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 获取渲染后的HTML
        const html = await page.content();

        // 关闭页面
        await page.close();
        page = null;
        this.activePagesCount--;

        // 用 cheerio 解析 HTML
        const $ = cheerio.load(html);
        $.is404 = false; // 明确标记不是404
        return $;

      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed for ${url}: ${error.message}`);

        // 确保页面被关闭
        if (page) {
          try {
            await page.close();
          } catch (e) {
            // 忽略关闭错误
          }
        }

        // 只在成功获取槽位时才递减计数器
        if (pageSlotAcquired) {
          this.activePagesCount--;
        }

        if (attempt < maxRetries) {
          const backoffDelay = config.scraping.requestDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${backoffDelay}ms...`);
          await this.delay(backoffDelay);
        }
      }
    }

    console.error(`Failed to fetch ${url} after ${maxRetries} attempts`);
    throw lastError;
  }

  // 主要的抓取方法，子类需要实现
  async scrapeEvents() {
    throw new Error('scrapeEvents method must be implemented by subclass');
  }

  // 公共的抓取入口
  async scrape() {
    console.log(`Starting to scrape ${this.sourceName}...`);

    try {
      const weekRange = this.getNextWeekRange();
      console.log(`Target week: ${weekRange.identifier}`);

      const rawEvents = await this.scrapeEvents(weekRange);
      const normalizedEvents = [];

      for (const rawEvent of rawEvents) {
        const normalized = this.normalizeEvent(rawEvent, weekRange);
        if (normalized) {
          if (this.isRelevantLocation(normalized.location)) {
            normalizedEvents.push(normalized);
          } else {
            console.log(`  📍 [${this.sourceName}] Event filtered by location: "${normalized.title}" (location: "${normalized.location}")`);
          }
        }
      }

      console.log(`${this.sourceName}: Found ${normalizedEvents.length} valid events`);
      return normalizedEvents.slice(0, config.scraping.maxEventsPerSource);

    } catch (error) {
      console.error(`Error scraping ${this.sourceName}:`, error.message);
      return [];
    } finally {
      // 确保关闭浏览器
      await this.closeBrowser();
    }
  }
}

module.exports = BaseScraper;