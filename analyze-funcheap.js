const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function analyzeFuncheap() {
  const url = 'https://sf.funcheap.com/category/event/event-types/fairs-festivals/';
  
  let browser;
  try {
    console.log('Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log(`Fetching: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const html = await page.content();
    
    // Save full HTML
    fs.writeFileSync('/tmp/funcheap-full.html', html);
    console.log('\nFull HTML saved to /tmp/funcheap-full.html');
    
    // Analyze structure
    const $ = cheerio.load(html);
    
    console.log('\n=== PAGE STRUCTURE ANALYSIS ===\n');
    
    // Check for event containers
    const selectors = [
      { name: 'article.tanbox', selector: 'article.tanbox' },
      { name: 'article.post', selector: 'article.post' },
      { name: 'article', selector: 'article' },
      { name: 'div.tanbox', selector: 'div.tanbox' },
      { name: 'div.post', selector: 'div.post' },
      { name: '.event-item', selector: '.event-item' },
      { name: '.event-entry', selector: '.event-entry' },
      { name: 'div[data-event]', selector: 'div[data-event]' }
    ];
    
    console.log('Testing CSS selectors for event containers:');
    for (const {name, selector} of selectors) {
      const count = $(selector).length;
      console.log(`  ${selector}: ${count} elements`);
    }
    
    // Find the main content area
    console.log('\n=== FINDING EVENT CONTAINERS ===\n');
    
    // Try the most likely selector first
    let $events = $('article.tanbox');
    let usedSelector = 'article.tanbox';
    
    if ($events.length === 0) {
      $events = $('article');
      usedSelector = 'article';
    }
    
    console.log(`Using selector: ${usedSelector}`);
    console.log(`Found ${$events.length} event containers\n`);
    
    if ($events.length > 0) {
      console.log('=== SAMPLE EVENT STRUCTURES (First 3) ===\n');
      
      $events.slice(0, 3).each((i, elem) => {
        console.log(`--- EVENT ${i + 1} ---`);
        
        const $elem = $(elem);
        
        // Show full HTML structure
        const html = $.html(elem);
        const preview = html.substring(0, 1500);
        console.log('HTML Structure (first 1500 chars):');
        console.log(preview);
        console.log('\n');
        
        // Extract key data
        const title = $elem.find('h2 a').text().trim();
        const link = $elem.find('h2 a').attr('href');
        const location = $elem.find('.location').text().trim();
        const datetime = $elem.find('.date-time, .meta.archive-meta.date-time');
        const cost = $elem.find('.cost_details').text().trim();
        const description = $elem.find('.entry').text().trim().substring(0, 100);
        
        console.log('Extracted Data:');
        console.log(`  Title: ${title || 'NOT FOUND'}`);
        console.log(`  Link: ${link || 'NOT FOUND'}`);
        console.log(`  Location: ${location || 'NOT FOUND'}`);
        console.log(`  Cost: ${cost || 'NOT FOUND'}`);
        console.log(`  Description: ${description || 'NOT FOUND'}`);
        
        if (datetime.length > 0) {
          console.log(`  DateTime HTML attrs:`, datetime.attr());
        }
        
        // Show class and id attributes
        console.log(`  Element classes: ${$elem.attr('class') || 'none'}`);
        console.log(`  Element id: ${$elem.attr('id') || 'none'}`);
        
        console.log('\n');
      });
    }
    
    // Check for pagination/loading more
    console.log('=== CHECKING FOR PAGINATION ===\n');
    const pagination = {
      'next-page link': $('a.next').length,
      'load-more button': $('button[class*="load"], button[class*="more"]').length,
      'pagination links': $('.pagination').length,
      'infinite scroll': $('[data-lazy]').length
    };
    
    Object.entries(pagination).forEach(([key, count]) => {
      if (count > 0) {
        console.log(`${key}: ${count} elements`);
      }
    });
    
    // Save sample HTML for each event
    if ($events.length > 0) {
      console.log('\n=== SAVING SAMPLE EVENT HTML ===\n');
      
      $events.slice(0, 2).each((i, elem) => {
        const eventHtml = $.html(elem);
        fs.writeFileSync(`/tmp/funcheap-event-${i+1}.html`, eventHtml);
        console.log(`Saved event ${i+1} to /tmp/funcheap-event-${i+1}.html`);
      });
    }
    
    await page.close();
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

analyzeFuncheap();
