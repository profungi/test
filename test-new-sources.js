#!/usr/bin/env node

/**
 * Test script for validating new event sources
 * Tests: San José Made, Santa Clara County Parks, 365 Night Market, San Jose Downtown
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class SourceTester {
  constructor() {
    this.browser = null;
  }

  async init() {
    console.log('🚀 Launching browser...\n');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async fetchPage(url) {
    const page = await this.browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待动态内容加载
      const html = await page.content();
      return cheerio.load(html);
    } finally {
      await page.close();
    }
  }

  /**
   * 测试 San José Made
   */
  async testSanJoseMade() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Testing: San José Made');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const url = 'https://www.sanjosemade.com/pages/events';
    console.log(`URL: ${url}\n`);

    try {
      const $ = await this.fetchPage(url);

      // 尝试多种选择器
      const events = [];

      // 策略1: 查找包含日期的section
      $('section, div[class*="event"], div[class*="Event"]').each((i, elem) => {
        const $elem = $(elem);
        const text = $elem.text();

        // 查找日期模式 (November 28–29, 2025)
        const dateMatch = text.match(/([A-Z][a-z]+\s+\d{1,2}[–-]\d{1,2},\s+\d{4})/);
        const timeMatch = text.match(/(\d{1,2}[ap]m[–-]\d{1,2}[ap]m)/i);

        if (dateMatch) {
          // 尝试提取标题
          const $heading = $elem.find('h2, h3, strong').first();
          const title = $heading.text().trim();

          // 尝试提取地点
          const locationMatch = text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Center|Park|Hall|Market|Convention))/);

          if (title) {
            events.push({
              title,
              date: dateMatch[1],
              time: timeMatch ? timeMatch[1] : null,
              location: locationMatch ? locationMatch[1] : null,
              rawText: text.substring(0, 200)
            });
          }
        }
      });

      // 输出结果
      console.log(`✅ Found ${events.length} events\n`);

      events.slice(0, 3).forEach((event, idx) => {
        console.log(`Event ${idx + 1}:`);
        console.log(`  Title: ${event.title}`);
        console.log(`  Date: ${event.date}`);
        console.log(`  Time: ${event.time || 'Not found'}`);
        console.log(`  Location: ${event.location || 'Not found'}`);
        console.log('');
      });

      // 分析HTML结构
      console.log('📊 HTML Structure Analysis:');
      console.log(`  - Total sections: ${$('section').length}`);
      console.log(`  - H2 headings: ${$('h2').length}`);
      console.log(`  - H3 headings: ${$('h3').length}`);
      console.log(`  - Time elements: ${$('time').length}`);
      console.log(`  - Has event dates: ${!!$('body').text().match(/\d{4}/)}`);

      // 输出一些sample HTML
      console.log('\n📝 Sample HTML snippet:');
      const firstSection = $('section').first().html();
      if (firstSection) {
        console.log(firstSection.substring(0, 300) + '...\n');
      }

      return {
        source: 'San José Made',
        success: events.length > 0,
        eventCount: events.length,
        sampleEvents: events.slice(0, 2),
        structureComplexity: 'low', // 看起来结构简单
        recommendation: events.length > 0 ? 'Use CSS selectors' : 'Use AI extraction'
      };

    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
      return {
        source: 'San José Made',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 测试 Santa Clara County Parks
   */
  async testSCCountyParks() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Testing: Santa Clara County Parks');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 尝试多个可能的URL
    const urls = [
      'https://parks.sccgov.org/events',
      'https://www.sccgov.org/sites/parks/events',
      'https://parks.santaclaracounty.gov/events'
    ];

    for (const url of urls) {
      console.log(`Trying URL: ${url}`);

      try {
        const $ = await this.fetchPage(url);

        // 检查是否加载成功
        const bodyText = $('body').text();
        if (bodyText.includes('404') || bodyText.includes('Not Found')) {
          console.log('  ❌ 404 Not Found\n');
          continue;
        }

        // 查找事件列表
        const events = [];

        // 策略1: 标准事件列表
        $('.event-item, .event, article[class*="event"]').each((i, elem) => {
          const $elem = $(elem);
          const title = $elem.find('h2, h3, .title, .event-title').first().text().trim();
          const date = $elem.find('.date, .event-date, time').first().text().trim();
          const location = $elem.find('.location, .venue').first().text().trim();

          if (title) {
            events.push({ title, date, location });
          }
        });

        console.log(`  ✅ Found ${events.length} events\n`);

        if (events.length > 0) {
          events.slice(0, 2).forEach((event, idx) => {
            console.log(`Event ${idx + 1}:`);
            console.log(`  Title: ${event.title}`);
            console.log(`  Date: ${event.date}`);
            console.log(`  Location: ${event.location}`);
            console.log('');
          });
        }

        // 分析HTML结构
        console.log('📊 HTML Structure Analysis:');
        console.log(`  - Event containers: ${$('.event-item, .event, article').length}`);
        console.log(`  - Headings: ${$('h1, h2, h3').length}`);
        console.log(`  - Time elements: ${$('time').length}`);
        console.log('');

        return {
          source: 'SC County Parks',
          url,
          success: events.length > 0,
          eventCount: events.length,
          sampleEvents: events.slice(0, 2),
          recommendation: events.length > 0 ? 'Use CSS selectors' : 'Try different URL or use AI'
        };

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}\n`);
      }
    }

    return {
      source: 'SC County Parks',
      success: false,
      error: 'All URLs failed - may need correct URL or API access'
    };
  }

  /**
   * 测试 365 Night Market
   */
  async test365NightMarket() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Testing: 365 Night Market');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const url = 'https://www.365nightmarket.com/events';
    console.log(`URL: ${url}\n`);

    try {
      const $ = await this.fetchPage(url);

      // 365 Night Market 使用 Wix，需要等待JS渲染
      const events = [];

      // Wix通常使用特定的class名
      $('[class*="event"], [data-id*="event"], .gallery-item, .event-item').each((i, elem) => {
        const $elem = $(elem);
        const text = $elem.text();

        // 查找日期
        const dateMatch = text.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/);
        const title = $elem.find('h2, h3, h4, [class*="title"]').first().text().trim();

        if (title && dateMatch) {
          events.push({
            title,
            date: dateMatch[1],
            rawHtml: $elem.html().substring(0, 200)
          });
        }
      });

      console.log(`✅ Found ${events.length} events (Wix-rendered)\n`);

      if (events.length > 0) {
        events.slice(0, 2).forEach((event, idx) => {
          console.log(`Event ${idx + 1}:`);
          console.log(`  Title: ${event.title}`);
          console.log(`  Date: ${event.date}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No events found with CSS selectors');
        console.log('   Wix sites often require more wait time or API access\n');
      }

      // 检查是否有Wix-specific结构
      const hasWix = $('body').html().includes('wix') || $('body').html().includes('Wix');
      console.log('📊 Structure Analysis:');
      console.log(`  - Is Wix site: ${hasWix}`);
      console.log(`  - Gallery items: ${$('.gallery-item').length}`);
      console.log(`  - Has React: ${$('[data-reactid], [data-react-root]').length > 0}`);
      console.log('');

      return {
        source: '365 Night Market',
        success: events.length > 0,
        eventCount: events.length,
        sampleEvents: events.slice(0, 2),
        structureComplexity: 'high',
        recommendation: events.length > 0 ? 'Use CSS with longer wait time' : 'Use AI extraction or API'
      };

    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
      return {
        source: '365 Night Market',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 测试 San Jose Downtown
   */
  async testSJDowntown() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Testing: San Jose Downtown');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const url = 'https://sjdowntown.com/dtsj-events';
    console.log(`URL: ${url}\n`);

    try {
      const $ = await this.fetchPage(url);

      const events = [];

      // WordPress事件通常使用article或特定class
      $('article, .event-card, .event-item, [class*="event-"]').each((i, elem) => {
        const $elem = $(elem);
        const title = $elem.find('h1, h2, h3, .entry-title, .event-title').first().text().trim();
        const date = $elem.find('.event-date, .date, time').first().text().trim();
        const location = $elem.find('.location, .venue').first().text().trim();
        const link = $elem.find('a').first().attr('href');

        if (title && title.length > 5) {
          events.push({ title, date, location, link });
        }
      });

      console.log(`✅ Found ${events.length} events\n`);

      if (events.length > 0) {
        events.slice(0, 3).forEach((event, idx) => {
          console.log(`Event ${idx + 1}:`);
          console.log(`  Title: ${event.title}`);
          console.log(`  Date: ${event.date || 'Not found'}`);
          console.log(`  Location: ${event.location || 'Not found'}`);
          console.log(`  Link: ${event.link || 'Not found'}`);
          console.log('');
        });
      }

      // 分析结构
      console.log('📊 HTML Structure Analysis:');
      console.log(`  - Articles: ${$('article').length}`);
      console.log(`  - Event cards: ${$('.event-card, .event-item').length}`);
      console.log(`  - Has WordPress: ${$('body').attr('class')?.includes('wordpress') || false}`);
      console.log(`  - Pagination: ${$('.pagination, .nav-links').length > 0}`);
      console.log('');

      return {
        source: 'San Jose Downtown',
        success: events.length > 0,
        eventCount: events.length,
        sampleEvents: events.slice(0, 2),
        structureComplexity: 'medium',
        recommendation: events.length > 0 ? 'Use CSS selectors' : 'Check calendar/filter options'
      };

    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
      return {
        source: 'San Jose Downtown',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    await this.init();

    const results = [];

    try {
      results.push(await this.testSanJoseMade());
      results.push(await this.testSCCountyParks());
      results.push(await this.test365NightMarket());
      results.push(await this.testSJDowntown());

      // 总结
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 SUMMARY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      results.forEach(result => {
        console.log(`${result.source}:`);
        console.log(`  Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
        if (result.success) {
          console.log(`  Events found: ${result.eventCount}`);
          console.log(`  Recommendation: ${result.recommendation}`);
        } else {
          console.log(`  Error: ${result.error || 'Unknown'}`);
        }
        console.log('');
      });

      // 给出实施建议
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 IMPLEMENTATION RECOMMENDATION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const successfulSources = results.filter(r => r.success);
      const failedSources = results.filter(r => !r.success);

      if (successfulSources.length > 0) {
        console.log(`✅ ${successfulSources.length} sources ready for CSS-based scraping:`);
        successfulSources.forEach(s => {
          console.log(`   - ${s.source} (${s.eventCount} events, ${s.structureComplexity || 'unknown'} complexity)`);
        });
        console.log('');
      }

      if (failedSources.length > 0) {
        console.log(`⚠️  ${failedSources.length} sources need alternative approach:`);
        failedSources.forEach(s => {
          console.log(`   - ${s.source} (Consider: AI extraction, API access, or URL verification)`);
        });
        console.log('');
      }

      console.log('Next steps:');
      console.log('1. For successful sources: Create config-driven scrapers');
      console.log('2. For failed sources: Try AI extraction as fallback');
      console.log('3. Consider implementing a hybrid approach (config + AI)');
      console.log('');

    } finally {
      await this.close();
    }
  }
}

// 运行测试
(async () => {
  const tester = new SourceTester();
  await tester.runAllTests();
})().catch(console.error);
