#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function testSFStationDetail() {
  console.log('Testing SFStation detail page extraction...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // 首先访问列表页获取一些URL
    const listUrl = 'https://www.sfstation.com/events';
    console.log(`Fetching list page: ${listUrl}`);
    await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const listHtml = await page.content();
    const $list = cheerio.load(listHtml);

    // 获取前3个 sfstation.com 的活动链接
    const urls = [];
    $list('.event-wrapper').each((i, el) => {
      if (urls.length >= 3) return false;
      const url = $list(el).find('a[itemprop="url"]').attr('href') ||
                  $list(el).find('a').first().attr('href');
      if (url && url.includes('sfstation.com') && !url.includes('http://') && !url.includes('https://')) {
        urls.push(`https://www.sfstation.com${url}`);
      } else if (url && url.includes('sfstation.com/event')) {
        urls.push(url);
      }
    });

    console.log(`Found ${urls.length} sfstation.com URLs\n`);

    if (urls.length === 0) {
      console.log('No sfstation.com URLs found in list page');
      return;
    }

    // 测试第一个详情页
    const testUrl = urls[0];
    console.log(`Testing detail page: ${testUrl}\n`);
    console.log('='.repeat(80));

    await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const detailHtml = await page.content();
    const $ = cheerio.load(detailHtml);

    // 提取标题
    console.log('\n📝 TITLE:');
    const titleSelectors = ['h1[itemprop="name"]', 'h1.event-title', 'h1', '[itemprop="name"]'];
    titleSelectors.forEach(sel => {
      const title = $(sel).first().text().trim();
      if (title) {
        console.log(`  ${sel}: "${title.substring(0, 100)}"`);
      }
    });

    // 提取地址
    console.log('\n📍 LOCATION:');
    console.log('  [itemprop="location"]:');
    const $location = $('[itemprop="location"]').first();
    if ($location.length > 0) {
      console.log(`    content attr: "${$location.attr('content') || 'N/A'}"`);
      console.log(`    text: "${$location.text().trim().substring(0, 200)}"`);

      const $address = $location.find('[itemprop="address"]').first();
      if ($address.length > 0) {
        console.log('    [itemprop="address"]:');
        console.log(`      streetAddress: "${$address.find('[itemprop="streetAddress"]').text().trim()}"`);
        console.log(`      addressLocality: "${$address.find('[itemprop="addressLocality"]').text().trim()}"`);
        console.log(`      addressRegion: "${$address.find('[itemprop="addressRegion"]').text().trim()}"`);
        console.log(`      postalCode: "${$address.find('[itemprop="postalCode"]').text().trim()}"`);
      }
    } else {
      console.log('    Not found!');
    }

    console.log('\n  Other address selectors:');
    ['.venue-address', '.event-venue-address', '.address', '.event_place'].forEach(sel => {
      const addr = $(sel).first().text().trim();
      if (addr) {
        console.log(`    ${sel}: "${addr.substring(0, 200)}"`);
      }
    });

    // 提取时间
    console.log('\n⏰ TIME:');
    const $time = $('time[datetime]').first();
    if ($time.length > 0) {
      console.log(`  <time datetime>: "${$time.attr('datetime')}"`);
      console.log(`  <time> text: "${$time.text().trim()}"`);
    }

    const startDateAttr = $('[itemprop="startDate"]').attr('content') || $('[itemprop="startDate"]').attr('datetime');
    console.log(`  [itemprop="startDate"]: "${startDateAttr || 'N/A'}"`);

    // 提取价格
    console.log('\n💰 PRICE:');
    const priceSelectors = ['[itemprop="price"]', '.price', '.event-price', '.ticket-price'];
    priceSelectors.forEach(sel => {
      const $priceEl = $(sel).first();
      if ($priceEl.length > 0) {
        console.log(`  ${sel}:`);
        console.log(`    content attr: "${$priceEl.attr('content') || 'N/A'}"`);
        console.log(`    text: "${$priceEl.text().trim()}"`);
      }
    });

    // 搜索页面中的 "free" 关键词
    const bodyText = $('body').text().toLowerCase();
    if (bodyText.includes('free')) {
      console.log('\n  ⚠️ Page contains "free" keyword');
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testSFStationDetail().catch(console.error);
