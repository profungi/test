#!/usr/bin/env node

/**
 * Test CSS extraction for potential configurable sources
 * Tests: DoTheBay, Santa Clara Parks, Visit Silicon Valley, SF Rec & Parks
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class CSSSourceTester {
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
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      const html = await page.content();
      return cheerio.load(html);
    } finally {
      await page.close();
    }
  }

  /**
   * 测试 DoTheBay
   */
  async testDoTheBay() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Testing: DoTheBay');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const url = 'https://dothebay.com/events';
    console.log(`URL: ${url}\n`);

    try {
      const $ = await this.fetchPage(url);
      const events = [];

      // 尝试多种选择器策略
      const strategies = [
        {
          name: 'Strategy 1: .event-card',
          container: '.event-card, .event-item, [class*="event-"]',
          title: 'h2, h3, .title, .event-title',
          date: '.date, .event-date, time',
          location: '.location, .venue, .place',
          link: 'a'
        },
        {
          name: 'Strategy 2: article',
          container: 'article',
          title: 'h1, h2, h3',
          date: '.date, time, [class*="date"]',
          location: '.location, .venue',
          link: 'a'
        },
        {
          name: 'Strategy 3: li items',
          container: 'li[class*="event"], li.event, ul > li',
          title: 'h2, h3, .title',
          date: '.date, time',
          location: '.location',
          link: 'a'
        }
      ];

      for (const strategy of strategies) {
        console.log(`\n🔍 ${strategy.name}:`);
        const strategyEvents = [];

        $(strategy.container).each((i, elem) => {
          if (i >= 5) return; // 只看前5个

          const $elem = $(elem);
          const title = $elem.find(strategy.title).first().text().trim();
          const date = $elem.find(strategy.date).first().text().trim();
          const location = $elem.find(strategy.location).first().text().trim();
          const link = $elem.find(strategy.link).first().attr('href');

          if (title && title.length > 5) {
            strategyEvents.push({ title, date, location, link });
          }
        });

        console.log(`   Found: ${strategyEvents.length} events`);

        if (strategyEvents.length > 0) {
          console.log(`   Sample event:`);
          console.log(`     Title: ${strategyEvents[0].title.substring(0, 60)}...`);
          console.log(`     Date: ${strategyEvents[0].date || 'N/A'}`);
          console.log(`     Location: ${strategyEvents[0].location || 'N/A'}`);
        }

        if (strategyEvents.length > events.length) {
          events.length = 0;
          events.push(...strategyEvents);
        }
      }

      // 分析HTML结构
      console.log('\n📊 HTML Structure Analysis:');
      console.log(`  - Body classes: ${$('body').attr('class') || 'none'}`);
      console.log(`  - Articles: ${$('article').length}`);
      console.log(`  - Event-related divs: ${$('[class*="event"]').length}`);
      console.log(`  - List items: ${$('li').length}`);
      console.log(`  - Time elements: ${$('time').length}`);

      // 输出部分HTML用于调试
      console.log('\n📝 Sample HTML (first event container):');
      const firstContainer = $('article, [class*="event"], li').first();
      if (firstContainer.length) {
        console.log(firstContainer.html().substring(0, 400) + '...\n');
      }

      return {
        source: 'DoTheBay',
        url,
        success: events.length > 0,
        eventCount: events.length,
        sampleEvents: events.slice(0, 2),
        recommendation: events.length > 0 ? 'CSS-configurable' : 'Needs investigation'
      };

    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
      return {
        source: 'DoTheBay',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 测试 Santa Clara County Parks (尝试多个URL)
   */
  async testSCCountyParks() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Testing: Santa Clara County Parks');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const urls = [
      'https://parks.sccgov.org/events',
      'https://www.sccgov.org/sites/parks/Pages/events.aspx',
      'https://parks.sccgov.org/activities-events',
    ];

    for (const url of urls) {
      console.log(`\n🔗 Trying: ${url}`);

      try {
        const $ = await this.fetchPage(url);

        // 检查是否是404或错误页
        const bodyText = $('body').text().toLowerCase();
        if (bodyText.includes('404') || bodyText.includes('not found') || bodyText.includes('page cannot be found')) {
          console.log('  ❌ Page not found or error\n');
          continue;
        }

        // 检查是否被拦截
        if (bodyText.includes('access denied') || bodyText.includes('forbidden')) {
          console.log('  ⚠️  Access denied/forbidden\n');
          continue;
        }

        const events = [];

        // 尝试常见的事件列表结构
        $('.event, .event-item, article, [class*="calendar"]').each((i, elem) => {
          if (i >= 5) return;

          const $elem = $(elem);
          const title = $elem.find('h1, h2, h3, h4, .title, .event-title').first().text().trim();
          const date = $elem.find('.date, time, [class*="date"]').first().text().trim();
          const location = $elem.find('.location, .venue, .place').first().text().trim();

          if (title && title.length > 3) {
            events.push({ title, date, location });
          }
        });

        console.log(`  ✅ Found ${events.length} events`);

        if (events.length > 0) {
          console.log(`  Sample:`);
          console.log(`    - ${events[0].title}`);
          console.log(`    - ${events[0].date || 'No date'}`);
          console.log('');

          return {
            source: 'SC County Parks',
            url,
            success: true,
            eventCount: events.length,
            sampleEvents: events.slice(0, 2),
            recommendation: 'CSS-configurable'
          };
        } else {
          console.log(`  ⚠️  Page loaded but no events found\n`);
          console.log(`  Page title: ${$('title').text()}`);
          console.log(`  H1s: ${$('h1').length}, H2s: ${$('h2').length}`);
        }

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}\n`);
      }
    }

    return {
      source: 'SC County Parks',
      success: false,
      error: 'All URLs failed - may need different approach'
    };
  }

  /**
   * 测试 Visit Silicon Valley
   */
  async testVisitSiliconValley() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Testing: Visit Silicon Valley');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const url = 'https://www.visitsiliconvalley.org/events/';
    console.log(`URL: ${url}\n`);

    try {
      const $ = await this.fetchPage(url);
      const events = [];

      // 旅游局网站通常有event cards
      $('.event-card, .event, article, [class*="event-"]').each((i, elem) => {
        if (i >= 5) return;

        const $elem = $(elem);
        const title = $elem.find('h1, h2, h3, h4, .title').first().text().trim();
        const date = $elem.find('.date, time, [class*="date"]').first().text().trim();
        const location = $elem.find('.location, .venue, .address').first().text().trim();
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
          console.log(`  Date: ${event.date || 'N/A'}`);
          console.log(`  Location: ${event.location || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No events found with standard selectors');
        console.log(`Page title: ${$('title').text()}`);
        console.log(`Page has ${$('h2').length} h2 tags, ${$('article').length} articles`);
      }

      console.log('📊 Structure:');
      console.log(`  - Event cards: ${$('.event-card, .event').length}`);
      console.log(`  - Articles: ${$('article').length}`);
      console.log(`  - Time elements: ${$('time').length}`);
      console.log('');

      return {
        source: 'Visit Silicon Valley',
        url,
        success: events.length > 0,
        eventCount: events.length,
        sampleEvents: events.slice(0, 2),
        recommendation: events.length > 0 ? 'CSS-configurable' : 'May need AI or different URL'
      };

    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
      return {
        source: 'Visit Silicon Valley',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 测试 SF Rec & Parks
   */
  async testSFRecParks() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Testing: SF Rec & Parks');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const url = 'https://sfrecpark.org/Calendar/';
    console.log(`URL: ${url}\n`);

    try {
      const $ = await this.fetchPage(url);
      const events = [];

      // 政府网站可能用表格或列表
      $('.event, .calendar-item, tr, li[class*="event"]').each((i, elem) => {
        if (i >= 5) return;

        const $elem = $(elem);
        const title = $elem.find('h2, h3, h4, td, .title, .event-title').first().text().trim();
        const date = $elem.find('.date, time, [class*="date"]').first().text().trim();
        const location = $elem.find('.location, .venue').first().text().trim();

        if (title && title.length > 5 && !title.toLowerCase().includes('calendar')) {
          events.push({ title, date, location });
        }
      });

      console.log(`✅ Found ${events.length} events\n`);

      if (events.length > 0) {
        events.slice(0, 3).forEach((event, idx) => {
          console.log(`Event ${idx + 1}:`);
          console.log(`  Title: ${event.title.substring(0, 60)}`);
          console.log(`  Date: ${event.date || 'N/A'}`);
          console.log('');
        });
      }

      console.log('📊 Structure:');
      console.log(`  - Tables: ${$('table').length}`);
      console.log(`  - List items: ${$('li').length}`);
      console.log(`  - Event classes: ${$('[class*="event"]').length}`);
      console.log('');

      return {
        source: 'SF Rec & Parks',
        url,
        success: events.length > 0,
        eventCount: events.length,
        sampleEvents: events.slice(0, 2),
        recommendation: events.length > 0 ? 'CSS-configurable' : 'May have calendar widget'
      };

    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
      return {
        source: 'SF Rec & Parks',
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
      results.push(await this.testDoTheBay());
      results.push(await this.testSCCountyParks());
      results.push(await this.testVisitSiliconValley());
      results.push(await this.testSFRecParks());

      // 总结
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 CSS SOURCES TEST SUMMARY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      console.log(`✅ Successful: ${successful.length}/${results.length}\n`);

      successful.forEach(r => {
        console.log(`${r.source}:`);
        console.log(`  Events found: ${r.eventCount}`);
        console.log(`  URL: ${r.url}`);
        console.log(`  Status: ${r.recommendation}`);
        console.log('');
      });

      if (failed.length > 0) {
        console.log(`\n❌ Failed: ${failed.length}\n`);
        failed.forEach(r => {
          console.log(`${r.source}: ${r.error || 'Unknown error'}`);
        });
        console.log('');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 RECOMMENDATION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('CSS-configurable sources (ready to implement):');
      successful.forEach(r => {
        console.log(`  ✓ ${r.source}`);
      });
      console.log('');

      if (failed.length > 0) {
        console.log('Sources needing alternative approach:');
        failed.forEach(r => {
          console.log(`  ⚠ ${r.source} - Consider: AI extraction, API, or different URL`);
        });
        console.log('');
      }

      const totalCSSSources = successful.length + 1; // +1 for SJ Downtown from previous test
      console.log(`\n🎯 Total CSS-configurable sources identified: ${totalCSSSources}`);
      console.log('   (San Jose Downtown, ' + successful.map(r => r.source).join(', ') + ')');
      console.log('');

    } finally {
      await this.close();
    }
  }
}

// 运行测试
(async () => {
  const tester = new CSSSourceTester();
  await tester.runAllTests();
})().catch(console.error);
