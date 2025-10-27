#!/usr/bin/env node

/**
 * 调试 Funcheap 详情页抓取
 * 直接测试从一个真实 URL 提取 description_detail
 */

const FuncheapWeekendScraper = require('./src/scrapers/funcheap-weekend-scraper');

async function debugFuncheapDetail() {
  console.log('🐛 Debugging Funcheap Detail Page Extraction\n');
  console.log('='.repeat(70));

  const scraper = new FuncheapWeekendScraper();

  try {
    // 步骤 1: 获取一个事件
    console.log('\n📅 Step 1: Getting a Funcheap event...');
    const weekRange = scraper.getNextWeekRange();
    const events = await scraper.scrapeEvents(weekRange);

    if (events.length === 0) {
      console.log('❌ No events found');
      return;
    }

    const event = events[0];
    console.log(`\n✅ Got event: ${event.title}`);
    console.log(`   URL: ${event.originalUrl}`);
    console.log(`   Description (from list): ${event.description ? event.description.substring(0, 100) + '...' : 'null'}`);
    console.log(`   Description_detail (from list): ${event.description_detail || 'null'}`);

    // 步骤 2: 尝试手动获取详情页
    console.log('\n' + '='.repeat(70));
    console.log('\n📄 Step 2: Fetching detail page manually...');

    if (!event.originalUrl.includes('funcheap.com')) {
      console.log('⚠️  This is not a funcheap.com URL, skipping detail fetch');
      console.log(`   URL: ${event.originalUrl}`);
      return;
    }

    console.log(`   Fetching: ${event.originalUrl}`);

    const $ = await scraper.fetchPage(event.originalUrl);

    console.log('\n✅ Page loaded successfully');
    console.log(`   Page title: ${$('title').text()}`);

    // 步骤 3: 测试所有选择器
    console.log('\n' + '='.repeat(70));
    console.log('\n🔍 Step 3: Testing description selectors...\n');

    const selectors = [
      '.entry-content',
      '.post-content',
      '.entry-body',
      '.content-area main article',
      'article',
      'main',
      'article p',  // 额外的
      '.post p'     // 额外的
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      console.log(`Selector: "${selector}"`);
      console.log(`  Found elements: ${elements.length}`);

      if (elements.length > 0) {
        const text = $(elements[0]).text().trim();
        const cleanText = text.replace(/\s+/g, ' ').replace(/\n+/g, '\n');
        console.log(`  Text length: ${cleanText.length} chars`);
        if (cleanText.length > 50) {
          console.log(`  ✅ Has enough content (> 50 chars)`);
          console.log(`  Preview: ${cleanText.substring(0, 150)}...`);
        } else if (cleanText.length > 0) {
          console.log(`  ⚠️  Too short (${cleanText.length} chars): "${cleanText}"`);
        } else {
          console.log(`  ❌ Empty`);
        }
      } else {
        console.log(`  ❌ Not found`);
      }
      console.log('');
    }

    // 步骤 4: 使用 scraper 的方法
    console.log('='.repeat(70));
    console.log('\n📝 Step 4: Using scraper\'s extractDetailedDescription()...\n');

    const description = scraper.extractDetailedDescription($);

    if (description) {
      console.log(`✅ Extracted description (${description.length} chars):`);
      console.log(`   "${description.substring(0, 200)}..."`);
    } else {
      console.log(`❌ Failed to extract description`);
    }

    // 步骤 5: 完整测试 fetchEventDetails
    console.log('\n' + '='.repeat(70));
    console.log('\n🔄 Step 5: Testing full fetchEventDetails()...\n');

    const detailedEvent = await scraper.fetchEventDetails(event);

    console.log(`Original description_detail: ${event.description_detail || 'null'}`);
    console.log(`New description_detail: ${detailedEvent.description_detail ? (detailedEvent.description_detail.substring(0, 150) + '...') : 'null'}`);

    if (detailedEvent.description_detail) {
      console.log(`\n✅ SUCCESS: description_detail was extracted!`);
      console.log(`   Length: ${detailedEvent.description_detail.length} chars`);
    } else {
      console.log(`\n❌ FAILURE: description_detail is still null`);
    }

    // 总结
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 Summary:\n');
    console.log(`Event title: ${event.title}`);
    console.log(`URL: ${event.originalUrl}`);
    console.log(`List description: ${event.description ? 'Present' : 'Missing'}`);
    console.log(`Detail description: ${detailedEvent.description_detail ? 'Present' : 'Missing'}`);

    if (detailedEvent.description_detail) {
      console.log(`\n✅ description_detail extraction is WORKING`);
    } else {
      console.log(`\n❌ description_detail extraction is FAILING`);
      console.log(`\nPossible reasons:`);
      console.log(`  1. CSS selectors don't match the page structure`);
      console.log(`  2. Page content is dynamically loaded (JavaScript)`);
      console.log(`  3. Page requires authentication or has anti-scraping measures`);
      console.log(`\nNext steps:`);
      console.log(`  1. Visit the URL in a browser: ${event.originalUrl}`);
      console.log(`  2. Inspect the page source to find description content`);
      console.log(`  3. Update the CSS selectors in extractDetailedDescription()`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugFuncheapDetail();
