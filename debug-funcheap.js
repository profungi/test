#!/usr/bin/env node

/**
 * Funcheap 调试脚本 - 用来检查事件 HTML 结构
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function main() {
  let browser;
  try {
    console.log('🔍 Funcheap HTML 结构调试\n');

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const url = 'https://sf.funcheap.com/category/event/event-types/fairs-festivals/page/2/';

    console.log(`📄 Fetching: ${url}\n`);

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
    } catch (e) {
      console.log('Navigation warning (continuing):', e.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    const html = await page.content();

    const $ = cheerio.load(html);

    // 找到第一个事件元素
    const firstEvent = $('div.tanbox[id^="post-"]').first();

    if (firstEvent.length === 0) {
      console.log('❌ No div.tanbox[id^="post-"] found');
      console.log('\n可能的备选选择器：');
      console.log('- article elements:', $('article').length);
      console.log('- div.tanbox:', $('div.tanbox').length);
      console.log('- div.post:', $('div.post').length);

      // 显示第一个 article 的结构
      const firstArticle = $('article').first();
      if (firstArticle.length > 0) {
        console.log('\n📝 First article HTML (first 800 chars):');
        console.log(firstArticle.html()?.substring(0, 800));
      }
    } else {
      console.log('✅ Found event div.tanbox\n');
      console.log('='.repeat(80));

      // 显示完整的事件 HTML
      const eventHtml = firstEvent.html();
      console.log('\n📝 Complete Event HTML:\n');
      console.log(eventHtml);

      console.log('\n' + '='.repeat(80));
      console.log('\n🔎 Field Extraction Test:\n');

      // 测试各个字段的提取
      const titleLink = firstEvent.find('span.title.entry-title a');
      console.log(`✓ Title selector (span.title.entry-title a): "${titleLink.text().trim()}"`);
      console.log(`  Found: ${titleLink.length > 0 ? 'YES' : 'NO'}`);

      const meta = firstEvent.find('div.meta.archive-meta.date-time');
      console.log(`\n✓ Meta selector (div.meta.archive-meta.date-time): Found ${meta.length > 0 ? 'YES' : 'NO'}`);
      if (meta.length > 0) {
        console.log(`  data-event-date: "${meta.attr('data-event-date')}"`);
        console.log(`  data-event-date-end: "${meta.attr('data-event-date-end')}"`);
      }

      const costSpan = firstEvent.find('span.cost');
      console.log(`\n✓ Cost selector (span.cost): Found ${costSpan.length > 0 ? 'YES' : 'NO'}`);
      if (costSpan.length > 0) {
        console.log(`  Text: "${costSpan.text().trim()}"`);
      }

      const metaSpans = firstEvent.find('div.meta.archive-meta span');
      console.log(`\n✓ Meta spans: Found ${metaSpans.length}`);
      metaSpans.each((i, el) => {
        const $span = $(el);
        console.log(`  [${i}] class="${$span.attr('class')}" text="${$span.text().trim()}"`);
      });

      const thumbnail = firstEvent.find('div.thumbnail-wrapper');
      console.log(`\n✓ Thumbnail: Found ${thumbnail.length > 0 ? 'YES' : 'NO'}`);

      // 检查描述文本
      const textAfterThumbnail = thumbnail.length > 0 ? thumbnail[0].nextSibling : null;
      console.log(`\n✓ Text after thumbnail: ${textAfterThumbnail ? 'YES (' + textAfterThumbnail.nodeType + ')' : 'NO'}`);

      // 尝试其他可能的描述位置
      const entry = firstEvent.find('.entry');
      console.log(`\n✓ .entry selector: Found ${entry.length > 0 ? 'YES' : 'NO'}`);
      if (entry.length > 0) {
        console.log(`  Text (first 100 chars): "${entry.text().trim().substring(0, 100)}"`);
      }

      const description = firstEvent.find('.post-content, .description, p');
      console.log(`\n✓ Description alternatives:`);
      console.log(`  .post-content: ${firstEvent.find('.post-content').length > 0 ? 'YES' : 'NO'}`);
      console.log(`  .description: ${firstEvent.find('.description').length > 0 ? 'YES' : 'NO'}`);
      console.log(`  p tag: ${firstEvent.find('p').length > 0 ? 'YES' : 'NO'}`);
    }

    await page.close();
    await browser.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

main();
