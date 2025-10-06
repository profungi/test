#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function quickDebug() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Fetching Eventbrite...\n');
    await page.goto('https://www.eventbrite.com/d/ca--san-francisco/events/?page=1', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const html = await page.content();
    const $ = cheerio.load(html);

    // 找第一个事件卡片
    const $card = $('.event-card').first();

    if ($card.length === 0) {
      console.log('❌ No .event-card found');
      return;
    }

    console.log('✅ Found event card\n');
    console.log('=== Card HTML (first 2000 chars) ===');
    const cardHtml = $.html($card);
    console.log(cardHtml.substring(0, 2000));
    console.log('\n...\n');

    // 保存完整卡片HTML到文件
    fs.writeFileSync('./debug-card.html', cardHtml);
    console.log('Full card HTML saved to: ./debug-card.html\n');

    // 尝试提取信息
    console.log('=== Attempting to extract info ===\n');

    // 标题
    console.log('Trying title selectors:');
    const titleSelectors = ['h3', 'h2', 'h1', '[data-testid="event-title"]', '.event-title', 'a'];
    titleSelectors.forEach(sel => {
      const text = $card.find(sel).first().text().trim();
      if (text) console.log(`  ${sel}: "${text.substring(0, 60)}"`);
    });

    // 时间
    console.log('\nTrying time selectors:');
    const timeSelectors = ['time', '[datetime]', '.date', '[class*="date"]', '[class*="time"]'];
    timeSelectors.forEach(sel => {
      const $el = $card.find(sel).first();
      const text = $el.text().trim();
      const datetime = $el.attr('datetime');
      if (text || datetime) {
        console.log(`  ${sel}: text="${text}" datetime="${datetime}"`);
      }
    });

    // 地点
    console.log('\nTrying location selectors:');
    const locationSelectors = ['.location', '[class*="location"]', '[class*="venue"]', 'p'];
    locationSelectors.forEach(sel => {
      const text = $card.find(sel).first().text().trim();
      if (text) console.log(`  ${sel}: "${text.substring(0, 60)}"`);
    });

    // 价格
    console.log('\nTrying price selectors:');
    const priceSelectors = ['.price', '[class*="price"]', '[class*="cost"]', '[class*="ticket"]'];
    priceSelectors.forEach(sel => {
      const text = $card.find(sel).first().text().trim();
      if (text) console.log(`  ${sel}: "${text}"`);
    });

    // 列出所有文本内容
    console.log('\n=== All text in card (first 500 chars) ===');
    console.log($card.text().trim().substring(0, 500));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

quickDebug();
