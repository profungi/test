#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testMultipleCards() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    console.log('Fetching Eventbrite...\n');
    await page.goto('https://www.eventbrite.com/d/ca--san-francisco/events/?page=1', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const html = await page.content();
    const $ = cheerio.load(html);

    const $cards = $('.event-card');
    console.log(`Found ${$cards.length} event cards\n`);

    // 分析前5个不同的卡片
    for (let cardIndex = 0; cardIndex < Math.min(5, $cards.length); cardIndex++) {
      const $card = $cards.eq(cardIndex);

      console.log(`\n${'='.repeat(70)}`);
      console.log(`CARD ${cardIndex + 1}`);
      console.log('='.repeat(70));

      // 标题
      const title = $card.find('h3, h2').first().text().trim();
      console.log(`\nTitle: ${title}`);

      // 卡片的所有文本按行分割
      const allText = $card.text();
      const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      console.log(`\nAll lines (${lines.length} total):`);
      lines.forEach((line, i) => {
        if (i < 15) { // 显示前15行
          console.log(`  ${i + 1}. "${line}"`);
        }
      });

      // 找时间行
      console.log('\nLooking for time line...');
      let timeLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/[•·]\s*\d{1,2}:\d{2}\s*(AM|PM)/i) ||
            lines[i].match(/tomorrow|today/i)) {
          timeLineIndex = i;
          console.log(`  ✓ Time found at line ${i + 1}: "${lines[i]}"`);
          break;
        }
      }

      if (timeLineIndex >= 0) {
        // 显示时间行周围的行
        console.log('\nLines around time:');
        for (let i = Math.max(0, timeLineIndex - 1); i <= Math.min(lines.length - 1, timeLineIndex + 3); i++) {
          const marker = i === timeLineIndex ? '>>>' : '   ';
          console.log(`  ${marker} Line ${i + 1}: "${lines[i]}"`);
        }

        // 猜测地点
        if (timeLineIndex + 1 < lines.length) {
          const locationCandidate = lines[timeLineIndex + 1];
          console.log(`\n  → Location candidate (next line): "${locationCandidate}"`);

          // 检查是否有效
          const isValid = locationCandidate.length > 2 &&
                         locationCandidate.length < 100 &&
                         !locationCandidate.match(/almost full|sales end|from \$|free|save|share|check ticket/i);
          console.log(`  → Valid location? ${isValid ? '✓ YES' : '✗ NO'}`);
        }
      }

      // 测试通过 class 查找
      console.log('\nTrying to find by class "event-card__clamp-line--one":');
      const byClass = $card.find('[class*="event-card__clamp-line--one"]');
      console.log(`  Found ${byClass.length} elements`);
      if (byClass.length > 0) {
        console.log(`  Text: "${byClass.first().text().trim()}"`);
      }

      // 价格
      console.log('\nLooking for price:');
      const priceMatch = allText.match(/From \$[\d,]+\.?\d*/i) ||
                        allText.match(/\$[\d,]+\.?\d+/) ||
                        (allText.match(/\bfree\b/i) ? ['Free'] : null);
      if (priceMatch) {
        console.log(`  ✓ Price: "${priceMatch[0]}"`);
      } else {
        console.log(`  ✗ No price found`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

testMultipleCards();
