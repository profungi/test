#!/usr/bin/env node

/**
 * 调试 SFStation 时间解析问题
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function debugSFStationTime() {
  console.log('🔍 Debugging SFStation time parsing...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // 测试下周的某一天
    const testDate = '2025-10-13'; // 下周一
    const url = `https://www.sfstation.com/calendar?date=${testDate}`;

    console.log(`Testing URL: ${url}\n`);
    console.log('='.repeat(80));

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const html = await page.content();
    const $ = cheerio.load(html);

    // 查找事件
    const eventSelectors = ['.event-wrapper', '.events_cont .event-wrapper'];

    for (const selector of eventSelectors) {
      const eventElements = $(selector);

      if (eventElements.length > 0) {
        console.log(`\nFound ${eventElements.length} events with selector: ${selector}\n`);

        // 分析前3个事件
        eventElements.slice(0, 3).each((i, element) => {
          const $el = $(element);

          console.log(`\n--- Event ${i + 1} ---`);

          // 标题
          const title = $el.find('[itemprop="name"]').text().trim() ||
                       $el.find('a[itemprop="url"]').attr('title') ||
                       $el.find('.event_title a').text().trim();
          console.log(`Title: ${title.substring(0, 60)}`);

          // URL
          let originalUrl = $el.find('a[itemprop="url"]').attr('href') ||
                           $el.find('a').first().attr('href');
          console.log(`URL: ${originalUrl}`);

          // 时间 - 原始 HTML
          const startDateAttr = $el.find('[itemprop="startDate"]').attr('content');
          console.log(`\nTime extraction:`);
          console.log(`  [itemprop="startDate"] content: ${startDateAttr}`);

          if (startDateAttr) {
            // 我们的处理逻辑
            const localTime = startDateAttr.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
            console.log(`  After removing timezone: ${localTime}`);

            // 解析成Date对象看看
            const parsedDate = new Date(startDateAttr);
            console.log(`  Parsed as Date (with TZ): ${parsedDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);

            const parsedLocalDate = new Date(localTime);
            console.log(`  Parsed as Date (without TZ): ${parsedLocalDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
          }

          // 备用时间提取
          const startDate = $el.find('.event-date').first().attr('content');
          const timeText = $el.find('.event-time').text().trim() ||
                          $el.find('.event_time').text().trim();
          console.log(`  .event-date content: ${startDate}`);
          console.log(`  .event-time text: ${timeText}`);

          console.log('-'.repeat(80));
        });

        break;
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugSFStationTime().catch(console.error);
