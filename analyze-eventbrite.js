#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function analyze() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    console.log('Loading Eventbrite page...\n');
    await page.goto('https://www.eventbrite.com/d/ca--san-francisco/events/?page=1', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 在浏览器中直接提取信息（不用 cheerio）
    const events = await page.evaluate(() => {
      const cards = document.querySelectorAll('.event-card');
      const results = [];

      for (let i = 0; i < Math.min(3, cards.length); i++) {
        const card = cards[i];

        // 提取所有文本
        const allText = card.innerText;

        // 提取所有 class 属性
        const allClasses = [];
        card.querySelectorAll('[class]').forEach(el => {
          const classes = el.className;
          if (classes && typeof classes === 'string') {
            allClasses.push(classes);
          }
        });

        // 尝试找标题
        let title = '';
        const h3 = card.querySelector('h3');
        const h2 = card.querySelector('h2');
        if (h3) title = h3.innerText.trim();
        else if (h2) title = h2.innerText.trim();

        // 尝试找时间
        let timeText = '';
        let datetime = '';
        const timeEl = card.querySelector('time');
        if (timeEl) {
          timeText = timeEl.innerText.trim();
          datetime = timeEl.getAttribute('datetime') || '';
        }

        // 尝试找链接
        let url = '';
        const link = card.querySelector('a');
        if (link) {
          url = link.href;
        }

        results.push({
          index: i + 1,
          title,
          timeText,
          datetime,
          url,
          allText: allText.substring(0, 500),
          allClasses: [...new Set(allClasses)].slice(0, 20) // 去重，只保留前20个
        });
      }

      return results;
    });

    console.log('=== Extracted Events ===\n');

    events.forEach(event => {
      console.log(`\n--- Event ${event.index} ---`);
      console.log(`Title: ${event.title || 'NOT FOUND'}`);
      console.log(`Time text: ${event.timeText || 'NOT FOUND'}`);
      console.log(`Datetime attr: ${event.datetime || 'NOT FOUND'}`);
      console.log(`URL: ${event.url || 'NOT FOUND'}`);
      console.log(`\nAll text content:\n${event.allText}...`);
      console.log(`\nSample classes:\n${event.allClasses.slice(0, 10).join('\n')}`);
    });

    // 额外检查：看看页面中是否有 JSON 数据
    const scriptData = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const results = [];
      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          if (data && (data['@type'] === 'Event' || data['@type'] === 'EventList')) {
            results.push(data);
          }
        } catch (e) {
          // ignore
        }
      });
      return results;
    });

    if (scriptData.length > 0) {
      console.log('\n\n=== Found structured data (JSON-LD) ===');
      console.log(JSON.stringify(scriptData, null, 2).substring(0, 1000));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

analyze();
