#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function debugSFStationList() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    console.log('Fetching SFStation list page...\n');
    await page.goto('https://www.sfstation.com/calendar?date=2025-10-13', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const html = await page.content();
    const $ = cheerio.load(html);

    const $cards = $('.event-wrapper');
    console.log(`Found ${$cards.length} event cards\n`);

    // 分析前3个事件
    for (let i = 0; i < Math.min(3, $cards.length); i++) {
      const $card = $cards.eq(i);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`EVENT ${i + 1}`);
      console.log('='.repeat(60));

      // 标题
      const title = $card.find('[itemprop="name"]').text().trim() ||
                   $card.find('.event_title a').text().trim();
      console.log(`\nTitle: "${title}"`);

      // 所有文本
      const allText = $card.text().trim();
      console.log(`\nAll text (first 300 chars):\n"${allText.substring(0, 300)}..."`);

      // 时间相关
      console.log('\n--- TIME ---');
      const $timeEl = $card.find('[itemprop="startDate"]');
      const timeContent = $timeEl.attr('content');
      const timeText = $card.find('.event-time, .event_time').text().trim();

      console.log(`  [itemprop="startDate"] content: "${timeContent || 'N/A'}"`);
      console.log(`  .event-time text: "${timeText}"`);

      // 地点相关
      console.log('\n--- LOCATION ---');
      const locationSelectors = ['[itemprop="location"]', '.event_place', '.location', '.venue'];
      locationSelectors.forEach(sel => {
        const $el = $card.find(sel);
        if ($el.length > 0) {
          const text = $el.text().trim();
          const content = $el.attr('content');
          console.log(`  ${sel}:`);
          console.log(`    text: "${text.substring(0, 100)}"`);
          if (content) console.log(`    content: "${content}"`);
        }
      });

      // 价格
      console.log('\n--- PRICE ---');
      const priceContent = $card.find('[itemprop="price"]').attr('content');
      console.log(`  [itemprop="price"] content: "${priceContent || 'N/A'}"`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

debugSFStationList();
