#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testDetailPages() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // 测试 DoTheBay 详情页
    console.log('='.repeat(70));
    console.log('TESTING DOTHEBAY DETAIL PAGE');
    console.log('='.repeat(70));

    const dothebayUrl = 'https://dothebay.com/events/2024/10/6/hexed-10-4-24-5';
    console.log(`\nFetching: ${dothebayUrl}\n`);

    await page.goto(dothebayUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    let html = await page.content();
    let $ = cheerio.load(html);

    console.log('--- Looking for TIME ---');
    $('time[datetime]').each((i, el) => {
      if (i < 3) {
        console.log(`  <time> ${i + 1}:`);
        console.log(`    Text: "${$(el).text().trim()}"`);
        console.log(`    datetime: "${$(el).attr('datetime')}"`);
      }
    });

    console.log('\n--- Looking for ADDRESS ---');
    $('[class*="address"], [class*="location"], [class*="venue"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5 && i < 5) {
        console.log(`  "${text.substring(0, 100)}"`);
      }
    });

    console.log('\n--- Looking for PRICE ---');
    $('[class*="price"], [class*="ticket"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && i < 5) {
        console.log(`  "${text.substring(0, 50)}"`);
      }
    });

    // 测试 SFStation 详情页
    console.log('\n\n' + '='.repeat(70));
    console.log('TESTING SFSTATION DETAIL PAGE');
    console.log('='.repeat(70));

    const sfstationUrl = 'https://www.sfstation.com/2024/10/15/litquake-2025-e2954551';
    console.log(`\nFetching: ${sfstationUrl}\n`);

    await page.goto(sfstationUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    html = await page.content();
    $ = cheerio.load(html);

    console.log('--- Looking for TIME ---');
    $('time[datetime]').each((i, el) => {
      if (i < 3) {
        console.log(`  <time> ${i + 1}:`);
        console.log(`    Text: "${$(el).text().trim()}"`);
        console.log(`    datetime: "${$(el).attr('datetime')}"`);
      }
    });

    // 查找包含完整日期时间的文本
    $('[itemprop="startDate"], [class*="date"], [class*="time"]').each((i, el) => {
      const text = $(el).text().trim();
      const datetime = $(el).attr('datetime') || $(el).attr('content');
      if ((text || datetime) && i < 5) {
        console.log(`  Element ${i + 1}:`);
        console.log(`    Text: "${text}"`);
        console.log(`    datetime/content: "${datetime || 'N/A'}"`);
      }
    });

    console.log('\n--- Looking for ADDRESS ---');
    $('[class*="address"], [class*="location"], [class*="venue"], [itemprop="location"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5 && i < 5) {
        console.log(`  "${text.substring(0, 100)}"`);
      }
    });

    console.log('\n--- Looking for PRICE ---');
    $('[class*="price"], [class*="ticket"], [itemprop="price"]').each((i, el) => {
      const text = $(el).text().trim();
      const content = $(el).attr('content');
      if ((text || content) && i < 5) {
        console.log(`  Text: "${text}" | Content: "${content || 'N/A'}"`);
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

testDetailPages();
