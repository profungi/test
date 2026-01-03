#!/usr/bin/env node

/**
 * 调试 DoTheBay 和 San Jose Downtown 的 HTML 结构
 * 帮助我们了解为什么 CSS 选择器失效
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function debugDoTheBay() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  调试 DoTheBay HTML 结构');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    console.log('📄 访问列表页: https://dothebay.com/events');
    await page.goto('https://dothebay.com/events', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // 等待 JavaScript 渲染
    await new Promise(resolve => setTimeout(resolve, 5000));

    const html = await page.content();
    const $ = cheerio.load(html);

    // 检查容器
    const containers = $('.ds-listing');
    console.log(`✅ 找到 ${containers.length} 个事件容器\n`);

    if (containers.length > 0) {
      console.log('📝 第一个事件容器的 HTML 结构:\n');
      const first = containers.first();
      console.log(first.html().substring(0, 1000));
      console.log('\n...\n');

      // 尝试提取第一个事件的信息
      console.log('🔍 尝试用当前选择器提取第一个事件:');
      console.log(`   标题 (.ds-listing-event-title-text): ${first.find('.ds-listing-event-title-text').text().trim()}`);
      console.log(`   时间 (.ds-event-time): ${first.find('.ds-event-time').text().trim()}`);
      console.log(`   地点 (.ds-event-location): ${first.find('.ds-event-location').text().trim()}`);
      console.log(`   链接 (a): ${first.find('a').attr('href')}`);
      console.log('');

      // 显示该容器内所有的类名
      console.log('📋 第一个容器内的所有元素及其类名:');
      first.find('*').each((i, elem) => {
        const classes = $(elem).attr('class');
        const text = $(elem).text().trim().substring(0, 50);
        if (classes && i < 20) { // 只显示前20个
          console.log(`   ${$(elem).prop('tagName')}.${classes}: "${text}"`);
        }
      });
    }

    // 检查一个详情页
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  检查 DoTheBay 详情页');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const firstLink = $('.ds-listing').first().find('a').attr('href');
    if (firstLink) {
      const detailUrl = firstLink.startsWith('http') ? firstLink : `https://dothebay.com${firstLink}`;
      console.log(`📄 访问详情页: ${detailUrl}`);

      await page.goto(detailUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const detailHtml = await page.content();
      const $detail = cheerio.load(detailHtml);

      console.log('\n🔍 详情页尝试提取:');
      console.log(`   标题 (h1): ${$detail('h1').first().text().trim()}`);
      console.log(`   时间 (.event-date): ${$detail('.event-date').text().trim()}`);
      console.log(`   时间 (time): ${$detail('time').text().trim()}`);
      console.log(`   时间 (.ds-event-time): ${$detail('.ds-event-time').text().trim()}`);
      console.log(`   地点 (.event-location): ${$detail('.event-location').text().trim()}`);
      console.log(`   地点 (address): ${$detail('address').text().trim()}`);

      // 搜索所有包含时间信息的元素
      console.log('\n📅 搜索所有可能包含时间的元素:');
      $detail('*').each((i, elem) => {
        const text = $detail(elem).text().trim();
        const className = $detail(elem).attr('class') || '';
        const id = $detail(elem).attr('id') || '';

        // 查找包含日期/时间模式的文本
        if (text.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}:\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december/i)) {
          if (text.length < 200) { // 只显示较短的文本
            console.log(`   ${$detail(elem).prop('tagName')}${className ? '.' + className : ''}${id ? '#' + id : ''}: "${text}"`);
          }
        }
      });
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await browser.close();
  }
}

async function debugSJDowntown() {
  console.log('\n\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  调试 San Jose Downtown HTML 结构');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    console.log('📄 访问列表页: https://sjdowntown.com/dtsj-events');
    await page.goto('https://sjdowntown.com/dtsj-events', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const html = await page.content();
    const $ = cheerio.load(html);

    // 检查容器
    const containers = $('article');
    console.log(`✅ 找到 ${containers.length} 个 article 容器\n`);

    if (containers.length > 0) {
      console.log('📝 第一个事件容器的 HTML 结构:\n');
      const first = containers.first();
      console.log(first.html().substring(0, 1500));
      console.log('\n...\n');

      // 尝试提取第一个事件的信息
      console.log('🔍 尝试用当前选择器提取第一个事件:');
      console.log(`   标题 (h2): ${first.find('h2').text().trim()}`);
      console.log(`   标题 (h3): ${first.find('h3').text().trim()}`);
      console.log(`   标题 (.entry-title): ${first.find('.entry-title').text().trim()}`);
      console.log(`   时间 (.event-date): ${first.find('.event-date').text().trim()}`);
      console.log(`   时间 (time): ${first.find('time').text().trim()}`);
      console.log(`   地点 (.location): ${first.find('.location').text().trim()}`);
      console.log(`   地点 (.venue): ${first.find('.venue').text().trim()}`);
      console.log(`   链接 (a): ${first.find('a').attr('href')}`);
      console.log('');

      // 显示该容器内所有的类名和内容
      console.log('📋 第一个容器内的主要元素:');
      first.find('*').each((i, elem) => {
        const classes = $(elem).attr('class');
        const text = $(elem).text().trim().substring(0, 80);
        if ((classes || text) && i < 30) {
          const tagName = $(elem).prop('tagName');
          const href = $(elem).attr('href');
          console.log(`   ${tagName}${classes ? '.' + classes : ''}${href ? ' [href=' + href + ']' : ''}: "${text}"`);
        }
      });

      // 搜索所有链接
      console.log('\n🔗 容器内的所有链接:');
      first.find('a').each((i, elem) => {
        console.log(`   ${$(elem).attr('href')} - "${$(elem).text().trim().substring(0, 50)}"`);
      });
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await browser.close();
  }
}

async function main() {
  await debugDoTheBay();
  await debugSJDowntown();
}

main().catch(console.error);
