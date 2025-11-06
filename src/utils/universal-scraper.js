/**
 * Universal Scraper - 统一的URL抓取接口
 * 支持:
 * 1. Eventbrite, Funcheap, SFStation (使用特定scraper)
 * 2. 其他任意网站 (使用AI提取)
 */

const EventbriteScraper = require('../scrapers/eventbrite-scraper');
const FuncheapScraper = require('../scrapers/funcheap-weekend-scraper');
const SFStationScraper = require('../scrapers/sfstation-scraper');
const ContentTranslator = require('../formatters/translator');
const cheerio = require('cheerio');
const axios = require('axios');

class UniversalScraper {
  constructor() {
    this.eventbriteScraper = new EventbriteScraper();
    this.funcheapScraper = new FuncheapScraper();
    this.sfstationScraper = new SFStationScraper();
    this.translator = new ContentTranslator();
  }

  /**
   * 检测URL来源
   * @param {string} url - 活动URL
   * @returns {string} - 'eventbrite' | 'funcheap' | 'sfstation' | 'ai_extraction'
   */
  detectSource(url) {
    if (url.includes('eventbrite.com')) return 'eventbrite';
    if (url.includes('funcheap.com')) return 'funcheap';
    if (url.includes('sfstation.com')) return 'sfstation';
    return 'ai_extraction'; // 未知网站，使用AI提取
  }

  /**
   * 从任意URL抓取活动信息
   * @param {string} url - 活动URL
   * @returns {Promise<Object>} - 标准格式的活动对象
   */
  async scrapeEventFromUrl(url) {
    const source = this.detectSource(url);

    console.log(`🔍 Detected source: ${source}`);
    console.log(`📥 Fetching event details from: ${url}`);

    try {
      switch (source) {
        case 'eventbrite':
          return await this.scrapeEventbriteEvent(url);

        case 'funcheap':
          return await this.scrapeFuncheapEvent(url);

        case 'sfstation':
          return await this.scrapeSFStationEvent(url);

        case 'ai_extraction':
          return await this.scrapeWithAI(url);

        default:
          throw new Error(`Unknown source: ${source}`);
      }
    } catch (error) {
      console.error(`❌ Failed to scrape event: ${error.message}`);
      throw error;
    }
  }

  /**
   * 抓取Eventbrite活动
   */
  async scrapeEventbriteEvent(url) {
    try {
      // 使用 fetchEventDetails 方法，需要提供一个基本的 event 对象
      const basicEvent = {
        title: 'Loading...',
        originalUrl: url,
        startTime: null,
        location: null,
        price: null,
        description: null
      };

      const event = await this.eventbriteScraper.fetchEventDetails(basicEvent);

      // 添加手动添加标记
      return {
        ...event,
        _source_website: url,
        _manually_added: true
      };
    } catch (error) {
      throw new Error(`Failed to scrape Eventbrite event: ${error.message}`);
    }
  }

  /**
   * 抓取Funcheap活动
   */
  async scrapeFuncheapEvent(url) {
    try {
      // Funcheap使用 fetchPage 和解析逻辑
      const $ = await this.funcheapScraper.fetchPage(url);

      // 从详情页提取信息
      const title = this.extractFuncheapTitle($);
      const timeInfo = this.extractFuncheapTime($);
      const location = this.extractFuncheapLocation($);
      const price = this.extractFuncheapPrice($);
      const description = this.extractFuncheapDescription($);

      if (!title || !timeInfo.startTime || !location) {
        throw new Error('Failed to extract required event fields');
      }

      return {
        title,
        startTime: timeInfo.startTime,
        endTime: timeInfo.endTime,
        location,
        price: price || 'Free',
        description,
        originalUrl: url,
        _source_website: url,
        _manually_added: true
      };
    } catch (error) {
      throw new Error(`Failed to scrape Funcheap event: ${error.message}`);
    }
  }

  /**
   * 抓取SFStation活动
   */
  async scrapeSFStationEvent(url) {
    try {
      // 使用 fetchEventDetails 方法
      const basicEvent = {
        title: 'Loading...',
        originalUrl: url,
        startTime: null,
        location: null,
        price: null,
        description: null
      };

      const event = await this.sfstationScraper.fetchEventDetails(basicEvent);

      return {
        ...event,
        _source_website: url,
        _manually_added: true
      };
    } catch (error) {
      throw new Error(`Failed to scrape SFStation event: ${error.message}`);
    }
  }

  /**
   * 使用AI从任意网站提取活动信息
   */
  async scrapeWithAI(url) {
    try {
      console.log('🤖 Using AI to extract event information...');

      // 1. 获取网页HTML
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // 2. 清理HTML，只保留主要内容
      // 移除script, style, nav, footer等无关元素
      $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();

      // 获取body的文本内容（限制长度以节省token）
      const bodyText = $('body').text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 4000); // 限制在4000字符

      // 3. 使用AI提取结构化信息
      const prompt = `Extract event information from this web page content.

Web page URL: ${url}

Web page content:
${bodyText}

Please extract and return ONLY a JSON object with this exact format (no markdown, no explanation):
{
  "title": "Event title",
  "startTime": "2025-11-15T10:00:00.000Z",
  "endTime": "2025-11-15T18:00:00.000Z",
  "location": "Full address or venue name with city",
  "price": "Free" or "$20" or null,
  "description": "Brief description of the event (1-2 sentences)"
}

Important:
- startTime and endTime must be in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.000Z)
- If you cannot determine endTime, set it to null
- If the event is free, use "Free" for price
- If price is not mentioned, set it to null
- Location should include city name
- Keep description concise`;

      // 使用 ContentTranslator 的 AI provider
      const result = await this.translator.translateWithAI(prompt);

      // 解析AI返回的JSON
      let eventData;
      try {
        // 尝试直接解析
        eventData = JSON.parse(result);
      } catch (e) {
        // 如果失败，尝试提取JSON部分
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          eventData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse AI response as JSON');
        }
      }

      // 验证必需字段
      if (!eventData.title || !eventData.startTime || !eventData.location) {
        throw new Error('AI extraction missing required fields');
      }

      // 返回标准格式
      return {
        title: eventData.title,
        startTime: eventData.startTime,
        endTime: eventData.endTime || null,
        location: eventData.location,
        price: eventData.price || null,
        description: eventData.description || null,
        originalUrl: url,
        _source_website: url,
        _manually_added: true,
        _extraction_method: 'ai'
      };

    } catch (error) {
      throw new Error(`AI extraction failed: ${error.message}`);
    }
  }

  /**
   * Funcheap 辅助提取方法
   */
  extractFuncheapTitle($) {
    const selectors = [
      'h1',
      '.event-title',
      '[class*="title"]',
      'article h1',
      'main h1'
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 3) return text;
    }

    return null;
  }

  extractFuncheapTime($) {
    // 查找时间标签
    const $time = $('time[datetime]').first();
    if ($time.length > 0) {
      const datetime = $time.attr('datetime');
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

    // 查找包含日期的文本
    const dateSelectors = [
      '.event-date',
      '.date',
      '[class*="date"]',
      '[class*="time"]'
    ];

    for (const selector of dateSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        // 尝试解析日期
        const date = new Date(text);
        if (!isNaN(date.getTime())) {
          return {
            startTime: date.toISOString(),
            endTime: null
          };
        }
      }
    }

    return { startTime: null, endTime: null };
  }

  extractFuncheapLocation($) {
    const selectors = [
      '.event-location',
      '.location',
      '.venue',
      '[class*="location"]',
      '[class*="venue"]'
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 2) return text;
    }

    return null;
  }

  extractFuncheapPrice($) {
    const text = $('body').text();

    if (/\bfree\b/i.test(text)) {
      return 'Free';
    }

    const priceMatch = text.match(/\$[\d,]+\.?\d*/);
    if (priceMatch) {
      return priceMatch[0];
    }

    return null;
  }

  extractFuncheapDescription($) {
    const selectors = [
      '.event-description',
      '.description',
      '[class*="description"]',
      'article p',
      'main p'
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 50) {
        return text.substring(0, 500); // 限制长度
      }
    }

    return null;
  }
}

module.exports = UniversalScraper;
