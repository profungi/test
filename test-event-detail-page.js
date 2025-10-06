#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testDetailPage() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // 测试一个具体的活动详情页
    const testUrl = 'https://www.eventbrite.com/e/thrill-o-ween-tickets-1571056445119';
    console.log(`Fetching event detail page: ${testUrl}\n`);

    await page.goto(testUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('=== Looking for FULL ADDRESS ===\n');

    // 查找地址相关的选择器
    const addressSelectors = [
      '[data-testid="venue-address"]',
      '.address',
      '[class*="address"]',
      '[class*="location"]',
      '[class*="venue"]',
      '.event-details__data'
    ];

    addressSelectors.forEach(sel => {
      const $el = $(sel);
      if ($el.length > 0) {
        const text = $el.text().trim();
        if (text && text.length > 5) {
          console.log(`${sel}: "${text}"`);
        }
      }
    });

    // 查找包含街道地址的所有文本
    console.log('\n--- Text containing street addresses ---');
    $('p, div, span, a').each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd)/i)) {
        if (text.length < 200) {
          console.log(`  "${text}"`);
        }
      }
    });

    console.log('\n=== Looking for EXACT TIME ===\n');

    // 查找时间
    const timeSelectors = [
      '[data-testid="event-date-time"]',
      'time',
      '[datetime]',
      '[class*="date"]',
      '[class*="time"]'
    ];

    timeSelectors.forEach(sel => {
      const $el = $(sel);
      if ($el.length > 0) {
        $el.each((i, el) => {
          const text = $(el).text().trim();
          const datetime = $(el).attr('datetime');
          if ((text || datetime) && i < 5) {
            console.log(`${sel}:`);
            console.log(`  Text: "${text}"`);
            console.log(`  datetime: "${datetime || 'N/A'}"`);
          }
        });
      }
    });

    console.log('\n=== Looking for PRICE ===\n');

    // 查找价格
    const priceSelectors = [
      '[data-testid="ticket-price"]',
      '.conversion-bar__panel-price',
      '[class*="price"]',
      '.ticket-card__price',
      '[data-automation="price"]'
    ];

    priceSelectors.forEach(sel => {
      const $el = $(sel);
      if ($el.length > 0) {
        $el.each((i, el) => {
          const text = $(el).text().trim();
          if (text && i < 5) {
            console.log(`${sel}: "${text}"`);
          }
        });
      }
    });

    // 查找包含 "Free" 的元素
    console.log('\n--- Looking for "Free" ---');
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase() === 'free' || text.toLowerCase() === 'free admission') {
        const tag = $(el).prop('tagName').toLowerCase();
        const classes = $(el).attr('class') || '';
        console.log(`  <${tag} class="${classes}">: "${text}"`);
      }
    });

    // 检查是否有 JSON-LD 结构化数据
    console.log('\n=== Checking for JSON-LD structured data ===\n');
    const scripts = $('script[type="application/ld+json"]');
    if (scripts.length > 0) {
      scripts.each((i, el) => {
        try {
          const data = JSON.parse($(el).html());
          if (data['@type'] === 'Event') {
            console.log('Found Event JSON-LD:');
            console.log(`  Name: ${data.name}`);
            console.log(`  StartDate: ${data.startDate}`);
            console.log(`  EndDate: ${data.endDate || 'N/A'}`);
            if (data.location) {
              console.log(`  Location name: ${data.location.name}`);
              if (data.location.address) {
                console.log(`  Address: ${JSON.stringify(data.location.address, null, 2)}`);
              }
            }
            if (data.offers) {
              console.log(`  Price: ${data.offers.price || 'N/A'}`);
              console.log(`  Price currency: ${data.offers.priceCurrency || 'N/A'}`);
            }
          }
        } catch (e) {
          // ignore
        }
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

testDetailPage();
