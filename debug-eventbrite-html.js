#!/usr/bin/env node

/**
 * 调试脚本 - 保存 Eventbrite 页面的 HTML 以便分析选择器
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const cheerio = require('cheerio');

async function debugEventbriteHTML() {
  console.log('🔍 Debugging Eventbrite HTML structure...\n');

  let browser = null;
  let page = null;

  try {
    // 启动浏览器
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    page = await browser.newPage();

    // 设置 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 });

    const url = 'https://www.eventbrite.com/d/ca--san-francisco/events/?page=1';
    console.log(`Fetching: ${url}\n`);

    // 导航到页面
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 等待内容加载
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 获取 HTML
    const html = await page.content();

    // 保存完整 HTML
    const htmlFile = './debug-eventbrite-full.html';
    fs.writeFileSync(htmlFile, html);
    console.log(`✅ Full HTML saved to: ${htmlFile}`);

    // 用 cheerio 解析
    const $ = cheerio.load(html);

    // 尝试找到事件卡片
    console.log('\n🔍 Looking for event cards...\n');

    const selectors = [
      '[data-testid="event-card"]',
      '.event-card',
      '.discover-search-desktop-card',
      '[data-event-id]',
      '.search-event-card',
      'article',
      '[class*="event"]',
      '[class*="card"]'
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements with selector: "${selector}"`);

        // 保存第一个元素的 HTML
        const firstElement = elements.first();
        const elementHTML = $.html(firstElement);
        const filename = `./debug-eventbrite-element-${selector.replace(/[\[\]"\.]/g, '_')}.html`;
        fs.writeFileSync(filename, elementHTML);
        console.log(`   Saved first element to: ${filename}`);

        // 分析第一个元素的结构
        console.log('\n   Analyzing first element structure:');

        // 查找标题
        const titleSelectors = [
          '[data-testid="event-title"]',
          '.event-title',
          'h3 a',
          'h2 a',
          'h3',
          'h2',
          'a[href*="/e/"]'
        ];
        titleSelectors.forEach(sel => {
          const title = firstElement.find(sel).first().text().trim();
          if (title) {
            console.log(`   📝 Title (${sel}): ${title.substring(0, 60)}...`);
          }
        });

        // 查找时间
        const timeSelectors = [
          '[data-testid="event-datetime"]',
          '.event-time',
          '.date-time',
          'time',
          '[datetime]',
          '[class*="date"]',
          '[class*="time"]'
        ];
        timeSelectors.forEach(sel => {
          const timeEl = firstElement.find(sel).first();
          if (timeEl.length > 0) {
            const timeText = timeEl.text().trim();
            const datetime = timeEl.attr('datetime');
            if (timeText || datetime) {
              console.log(`   🕐 Time (${sel}): text="${timeText}" datetime="${datetime}"`);
            }
          }
        });

        // 查找地点
        const locationSelectors = [
          '[data-testid="event-location"]',
          '.event-location',
          '.location',
          '.venue',
          '[aria-label*="location"]',
          '[class*="location"]',
          '[class*="venue"]'
        ];
        locationSelectors.forEach(sel => {
          const location = firstElement.find(sel).first().text().trim();
          if (location) {
            console.log(`   📍 Location (${sel}): ${location.substring(0, 60)}...`);
          }
        });

        // 查找价格
        const priceSelectors = [
          '[data-testid="price"]',
          '.price',
          '.ticket-price',
          '.cost',
          '[class*="price"]',
          '[class*="ticket"]',
          '[class*="cost"]'
        ];
        priceSelectors.forEach(sel => {
          const price = firstElement.find(sel).first().text().trim();
          if (price) {
            console.log(`   💰 Price (${sel}): ${price}`);
          }
        });

        // 查找链接
        const link = firstElement.find('a').first().attr('href');
        if (link) {
          console.log(`   🔗 Link: ${link.substring(0, 80)}...`);
        }

        console.log('');
        break; // 找到就停止
      }
    }

    // 检查是否有任何 a 标签
    const allLinks = $('a[href*="/e/"]');
    console.log(`\n📊 Total links with "/e/" in href: ${allLinks.length}`);

    if (allLinks.length > 0) {
      console.log('\nFirst 5 event links:');
      allLinks.slice(0, 5).each((i, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        const text = $el.text().trim();
        console.log(`  ${i + 1}. ${text.substring(0, 50)}... (${href})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    console.log('\n✅ Debug completed');
  }
}

debugEventbriteHTML();
