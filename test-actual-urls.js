#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testActualUrls() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // 测试 DoTheBay
    console.log('='.repeat(70));
    console.log('TESTING DOTHEBAY');
    console.log('='.repeat(70));

    console.log('\n1. Getting event list page...\n');
    await page.goto('https://dothebay.com/events/2025/10/13', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    let html = await page.content();
    let $ = cheerio.load(html);

    // 获取第一个事件的信息
    const $firstCard = $('.ds-listing.event-card').first();
    if ($firstCard.length > 0) {
      const title = $firstCard.find('[itemprop="name"]').text().trim() ||
                   $firstCard.find('.ds-listing-event-title-text').text().trim();

      const url = $firstCard.find('a[itemprop="url"]').attr('href') ||
                 $firstCard.find('a').first().attr('href');

      const fullUrl = url.startsWith('http') ? url : `https://dothebay.com${url}`;

      console.log(`First event: "${title}"`);
      console.log(`URL: ${fullUrl}\n`);

      // 访问详情页
      console.log('2. Visiting detail page...\n');
      await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      html = await page.content();
      $ = cheerio.load(html);

      // 显示页面标题
      const pageTitle = $('h1, h2').first().text().trim();
      console.log(`Page title: "${pageTitle}"\n`);

      // 查找时间信息
      console.log('--- TIME info on detail page ---');

      // 检查所有可能包含时间的元素
      $('*').each((i, el) => {
        const $el = $(el);
        const text = $el.text().trim();

        // 查找包含日期时间格式的文本
        if (text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday).*\d{1,2}:\d{2}/i) &&
            text.length < 200) {
          console.log(`  Found time text: "${text}"`);
        }
      });

      // 查找 datetime 属性
      $('[datetime], time').each((i, el) => {
        if (i < 3) {
          const datetime = $(el).attr('datetime');
          const text = $(el).text().trim();
          if (datetime || text) {
            console.log(`  <time>: text="${text}", datetime="${datetime || 'N/A'}"`);
          }
        }
      });

      // 查找地址
      console.log('\n--- ADDRESS info on detail page ---');
      $('*').each((i, el) => {
        const text = $(el).text().trim();
        // 查找包含街道地址的文本
        if (text.match(/\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Boulevard|Blvd)/i) &&
            text.length < 200) {
          console.log(`  Found address: "${text}"`);
        }
      });

      // 查找价格
      console.log('\n--- PRICE info on detail page ---');
      if ($('body').text().toLowerCase().includes('free')) {
        console.log(`  ✓ Found "free" in page`);
      }

      $('*').each((i, el) => {
        const text = $(el).text().trim();
        if (text.match(/\$\d+/) && text.length < 100) {
          console.log(`  Found price: "${text}"`);
        }
      });
    }

    // 测试 SFStation
    console.log('\n\n' + '='.repeat(70));
    console.log('TESTING SFSTATION');
    console.log('='.repeat(70));

    console.log('\n1. Getting event list page...\n');
    await page.goto('https://www.sfstation.com/calendar?date=2025-10-13', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    html = await page.content();
    $ = cheerio.load(html);

    // 获取第一个事件
    const $sfCard = $('.event-wrapper').first();
    if ($sfCard.length > 0) {
      const title = $sfCard.find('[itemprop="name"]').text().trim() ||
                   $sfCard.find('.event_title a').text().trim();

      const url = $sfCard.find('a[itemprop="url"]').attr('href') ||
                 $sfCard.find('a').first().attr('href');

      const fullUrl = url.startsWith('http') ? url : `https://www.sfstation.com${url}`;

      console.log(`First event: "${title}"`);
      console.log(`URL: ${fullUrl}\n`);

      // 访问详情页
      console.log('2. Visiting detail page...\n');
      await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      html = await page.content();
      $ = cheerio.load(html);

      const pageTitle = $('h1').first().text().trim();
      console.log(`Page title: "${pageTitle}"\n`);

      // 查找时间
      console.log('--- TIME info on detail page ---');
      $('*').each((i, el) => {
        const text = $(el).text().trim();
        if (text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday).*\d{1,2}:\d{2}/i) &&
            text.length < 200) {
          console.log(`  Found time text: "${text}"`);
        }
      });

      // 查找地址
      console.log('\n--- ADDRESS info on detail page ---');
      $('*').each((i, el) => {
        const text = $(el).text().trim();
        if (text.match(/\d+\s+[A-Za-z\s]+(Street|St|Avenue|Ave|Boulevard|Blvd)/i) &&
            text.length < 200) {
          console.log(`  Found address: "${text}"`);
        }
      });

      // 查找价格
      console.log('\n--- PRICE info on detail page ---');
      if ($('body').text().toLowerCase().includes('free')) {
        console.log(`  ✓ Found "free" in page`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) await browser.close();
  }
}

testActualUrls();
