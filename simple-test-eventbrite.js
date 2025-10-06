#!/usr/bin/env node

/**
 * 简单测试 - 直接显示 Eventbrite 抓取结果
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function simpleTest() {
  console.log('🧪 Simple Eventbrite Test\n');

  let browser = null;

  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    const url = 'https://www.eventbrite.com/d/ca--san-francisco/events/?page=1';
    console.log(`Fetching: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('Looking for events...\n');

    // 尝试最常见的选择器
    const $cards = $('[data-testid="event-card"]');
    console.log(`Found ${$cards.length} cards with [data-testid="event-card"]\n`);

    if ($cards.length > 0) {
      // 分析前3个
      $cards.slice(0, 3).each((i, card) => {
        const $card = $(card);

        console.log(`\n=== Event ${i + 1} ===`);

        // 标题
        const title = $card.find('h3').first().text().trim() ||
                     $card.find('h2').first().text().trim() ||
                     $card.find('[data-testid="event-title"]').text().trim();
        console.log(`Title: ${title || 'NOT FOUND'}`);

        // 时间
        const timeEl = $card.find('time').first();
        const datetime = timeEl.attr('datetime');
        const timeText = timeEl.text().trim();
        console.log(`Time: ${timeText || 'NOT FOUND'}`);
        console.log(`  datetime attr: ${datetime || 'NOT FOUND'}`);

        // 地点
        const location = $card.find('[class*="location"]').first().text().trim() ||
                        $card.find('[class*="venue"]').first().text().trim() ||
                        $card.find('p').filter((i, el) => {
                          const text = $(el).text().toLowerCase();
                          return text.includes('san francisco') ||
                                 text.includes('oakland') ||
                                 text.includes('berkeley');
                        }).first().text().trim();
        console.log(`Location: ${location || 'NOT FOUND'}`);

        // 价格
        const price = $card.find('[class*="price"]').first().text().trim() ||
                     $card.find('[class*="cost"]').first().text().trim();
        console.log(`Price: ${price || 'NOT FOUND'}`);

        // URL
        const link = $card.find('a').first().attr('href');
        console.log(`URL: ${link || 'NOT FOUND'}`);

        // 打印所有 class 名称以便分析
        console.log('\nAll classes in this card:');
        $card.find('[class]').each((j, el) => {
          const classes = $(el).attr('class');
          if (classes && j < 10) { // 只显示前10个
            console.log(`  - ${classes}`);
          }
        });
      });
    } else {
      console.log('⚠️  No cards found with [data-testid="event-card"]');
      console.log('\nTrying alternative selectors...\n');

      // 尝试其他方式
      const links = $('a[href*="/e/"]');
      console.log(`Found ${links.length} links with /e/ in href`);

      if (links.length > 0) {
        links.slice(0, 5).each((i, el) => {
          const $link = $(el);
          const href = $link.attr('href');
          const text = $link.text().trim();

          console.log(`\n--- Link ${i + 1} ---`);
          console.log(`Text: ${text.substring(0, 80)}`);
          console.log(`Href: ${href}`);

          // 找父元素
          const $parent = $link.closest('div[class*="card"], article, [class*="event"]');
          if ($parent.length > 0) {
            console.log(`Parent HTML preview:`);
            const parentHtml = $.html($parent).substring(0, 300);
            console.log(parentHtml + '...');
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

simpleTest();
