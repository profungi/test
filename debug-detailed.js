#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function debugDetailed() {
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

    // 分析前3个卡片，显示所有相关信息
    for (let i = 0; i < Math.min(3, $cards.length); i++) {
      const $card = $cards.eq(i);

      console.log(`\n${'='.repeat(70)}`);
      console.log(`CARD ${i + 1}`);
      console.log('='.repeat(70));

      // 标题
      const title = $card.find('h3, h2').first().text().trim();
      console.log(`\nTitle: "${title}"`);

      // 获取卡片的所有文本
      const allText = $card.text();
      console.log(`\nAll card text:\n"${allText.substring(0, 500)}..."`);

      // 查找所有可能包含地址的元素
      console.log('\n--- Looking for ADDRESS ---');

      // 方法1: 查找包含完整地址的元素
      $card.find('p, div, span').each((j, el) => {
        const text = $(el).text().trim();
        // 地址通常包含街道号码、Ave、St、Blvd等
        if (text.match(/\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Way|Lane|Ln)/i)) {
          console.log(`  ✓ Found address pattern: "${text}"`);
        }
      });

      // 方法2: 查找特定的class
      const locationClasses = [
        '[class*="event-card__clamp-line--one"]',
        '[class*="location"]',
        '[class*="venue"]',
        '[class*="address"]'
      ];

      locationClasses.forEach(cls => {
        const $els = $card.find(cls);
        if ($els.length > 0) {
          $els.each((j, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 2) {
              console.log(`  ${cls}: "${text}"`);
            }
          });
        }
      });

      // 查找TIME元素
      console.log('\n--- Looking for TIME ---');

      // <time> 标签
      const $time = $card.find('time');
      if ($time.length > 0) {
        console.log(`  <time> tag found:`);
        console.log(`    Text: "${$time.text().trim()}"`);
        console.log(`    datetime attr: "${$time.attr('datetime') || 'N/A'}"`);
      }

      // 包含时间格式的文本
      const timePattern = /(?:Tomorrow|Today|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^•]*[•·]\s*\d{1,2}:\d{2}\s*(?:AM|PM)/gi;
      const timeMatches = allText.match(timePattern);
      if (timeMatches) {
        console.log(`  Time patterns found:`);
        timeMatches.forEach(m => {
          console.log(`    "${m}"`);
        });
      }

      // 查找PRICE
      console.log('\n--- Looking for PRICE ---');

      // 查找Free
      if (/\bfree\b/i.test(allText)) {
        console.log(`  ✓ Found "free" in text`);

        // 找出具体在哪里
        $card.find('p, div, span').each((j, el) => {
          const text = $(el).text().trim();
          if (/\bfree\b/i.test(text) && text.length < 50) {
            console.log(`    In element: "${text}"`);
          }
        });
      }

      // 查找价格数字
      const pricePattern = /(?:From\s+)?\$[\d,]+\.?\d*/gi;
      const priceMatches = allText.match(pricePattern);
      if (priceMatches) {
        console.log(`  Price patterns found:`);
        priceMatches.forEach(m => {
          console.log(`    "${m}"`);
        });
      }

      // 查找 "Check ticket" 文本
      if (/check ticket/i.test(allText)) {
        console.log(`  ⚠️  Found "Check ticket price on event" (no price info)`);
      }

      // 获取链接去实际页面看
      const link = $card.find('a').first().attr('href');
      if (link) {
        console.log(`\n🔗 Event URL: ${link.substring(0, 80)}...`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

debugDetailed();
