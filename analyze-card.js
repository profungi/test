#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function analyzeCard() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    console.log('Loading Eventbrite...\n');
    await page.goto('https://www.eventbrite.com/d/ca--san-francisco/events/?page=1', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 在浏览器中分析第一个卡片的结构
    const analysis = await page.evaluate(() => {
      const card = document.querySelector('.event-card');
      if (!card) return null;

      // 获取所有子元素的文本
      const children = Array.from(card.querySelectorAll('*'));
      const elements = children.slice(0, 30).map(el => {
        const tag = el.tagName.toLowerCase();
        const classes = el.className;
        const text = el.innerText ? el.innerText.substring(0, 100) : '';

        return {
          tag,
          classes,
          text: text.split('\n')[0] // 只取第一行
        };
      });

      // 获取卡片的完整文本，按行分割
      const allLines = card.innerText.split('\n').filter(line => line.trim());

      return {
        elements,
        allLines
      };
    });

    if (!analysis) {
      console.log('No card found');
      return;
    }

    console.log('=== Card structure (first 30 elements) ===\n');
    analysis.elements.forEach((el, i) => {
      if (el.text) {
        console.log(`${i + 1}. <${el.tag}> "${el.text}"`);
        if (el.classes) {
          console.log(`   classes: ${el.classes}`);
        }
      }
    });

    console.log('\n=== All text lines ===\n');
    analysis.allLines.forEach((line, i) => {
      console.log(`Line ${i + 1}: "${line}"`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

analyzeCard();
