#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testCheerio() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    console.log('Fetching...\n');
    await page.goto('https://www.eventbrite.com/d/ca--san-francisco/events/?page=1', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const html = await page.content();
    const $ = cheerio.load(html);

    const $card = $('.event-card').first();

    console.log('=== Testing location extraction ===\n');

    // 测试方法1：通过class
    console.log('Method 1: By class');
    const byClass = $card.find('[class*="event-card__clamp-line--one"]');
    console.log(`  Found ${byClass.length} elements`);
    if (byClass.length > 0) {
      console.log(`  Text: "${byClass.first().text().trim()}"`);
    }

    // 测试方法2：按行提取
    console.log('\nMethod 2: By line parsing');
    const allText = $card.text();
    const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log(`  Total lines: ${lines.length}`);

    lines.forEach((line, i) => {
      if (i < 10) { // 只显示前10行
        console.log(`  Line ${i}: "${line.substring(0, 60)}"`);
      }
    });

    // 找时间行
    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/[•·]\s*\d{1,2}:\d{2}\s*(AM|PM)/i) ||
          lines[i].match(/tomorrow|today/i)) {
        timeLineIndex = i;
        console.log(`\n  Time line found at index ${i}: "${lines[i]}"`);
        break;
      }
    }

    if (timeLineIndex >= 0 && timeLineIndex + 1 < lines.length) {
      console.log(`  Next line (location): "${lines[timeLineIndex + 1]}"`);
    }

    // 测试方法3：所有候选
    console.log('\nMethod 3: All candidates');
    const candidates = [];
    $card.find('p, div, span').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2 && text.length < 100 &&
          !text.match(/\d+:\d+|PM|AM|followers|from \$|save|share|almost full|sales end|check ticket|tomorrow|today|^\$/i)) {
        candidates.push(text);
      }
    });
    console.log(`  Found ${candidates.length} candidates`);
    candidates.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. "${c.substring(0, 60)}"`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

testCheerio();
