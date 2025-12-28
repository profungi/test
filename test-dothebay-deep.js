#!/usr/bin/env node

/**
 * Deep dive test for DoTheBay to understand its structure
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testDoTheBay() {
  console.log('🔍 Deep Testing: DoTheBay.com\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    console.log('📥 Loading page...');
    await page.goto('https://dothebay.com/events', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('⏳ Waiting for dynamic content (5 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 尝试滚动以触发懒加载
    console.log('📜 Scrolling to load more content...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PAGE STRUCTURE ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 分析class名称
    const classNames = new Set();
    $('[class*="event"]').each((i, elem) => {
      const classes = $(elem).attr('class');
      if (classes) {
        classes.split(' ').forEach(c => {
          if (c.includes('event')) classNames.add(c);
        });
      }
    });

    console.log('Event-related classes:');
    Array.from(classNames).slice(0, 20).forEach(c => console.log(`  - ${c}`));
    console.log('');

    // 查看页面结构
    console.log('Element counts:');
    console.log(`  - Total elements with "event" in class: ${$('[class*="event"]').length}`);
    console.log(`  - <article>: ${$('article').length}`);
    console.log(`  - <time>: ${$('time').length}`);
    console.log(`  - Links: ${$('a').length}`);
    console.log('');

    // 尝试提取事件（更积极的选择器）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 TRYING EVENT EXTRACTION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const events = [];

    // 策略1: 查找所有可能的事件容器
    const containerSelectors = [
      '.ds-listing',
      '.ds-event',
      '.event-item',
      '.ds-cover-item',
      '[class*="listing"]',
      '[data-event-id]'
    ];

    for (const selector of containerSelectors) {
      const count = $(selector).length;
      console.log(`Trying selector: "${selector}" - found ${count} elements`);

      if (count > 0 && count < 100) {
        $(selector).slice(0, 5).each((i, elem) => {
          const $elem = $(elem);

          // 尝试多种方式提取标题
          let title = $elem.find('h2, h3, h4, .title, [class*="title"]').first().text().trim();
          if (!title) title = $elem.find('a').first().text().trim();

          // 提取日期
          const date = $elem.find('time, .date, [class*="date"]').text().trim();

          // 提取链接
          const link = $elem.find('a').first().attr('href');

          if (title && title.length > 5) {
            events.push({
              selector,
              title: title.substring(0, 80),
              date: date || 'N/A',
              link: link || 'N/A'
            });
          }
        });
      }
    }

    console.log(`\n✅ Extracted ${events.length} potential events:\n`);

    events.slice(0, 10).forEach((e, i) => {
      console.log(`${i + 1}. [${e.selector}]`);
      console.log(`   Title: ${e.title}`);
      console.log(`   Date: ${e.date}`);
      console.log(`   Link: ${e.link.substring(0, 60)}${e.link.length > 60 ? '...' : ''}`);
      console.log('');
    });

    // 输出sample HTML
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 SAMPLE HTML');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const sampleContainer = $('.ds-listing, .ds-event, [class*="listing"]').first();
    if (sampleContainer.length) {
      console.log('First event container HTML:');
      console.log(sampleContainer.html().substring(0, 800));
      console.log('...\n');
    }

    // 检查是否有JSON数据
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 CHECKING FOR JSON DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const scripts = $('script[type="application/ld+json"], script[type="application/json"]');
    console.log(`Found ${scripts.length} JSON script tags`);

    if (scripts.length > 0) {
      scripts.slice(0, 2).each((i, elem) => {
        const content = $(elem).html();
        console.log(`\nJSON ${i + 1} (first 300 chars):`);
        console.log(content.substring(0, 300));
      });
    }

  } finally {
    await browser.close();
  }
}

testDoTheBay().catch(console.error);
