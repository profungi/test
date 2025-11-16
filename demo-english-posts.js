#!/usr/bin/env node

// 演示脚本：展示英文帖子生成器的输出格式

const config = require('./src/config');

// 示例活动数据
const sampleEvents = [
  {
    id: 1,
    title: 'Ferry Plaza Farmers Market',
    start_time: '2025-11-15T10:00:00Z',
    end_time: '2025-11-15T14:00:00Z',
    location: 'Ferry Building, San Francisco, CA',
    price: 'Free',
    description: 'Weekly farmers market',
    description_detail: 'Fresh produce, artisan goods, and live music. Over 100 vendors featuring local farms and food artisans. Pet-friendly event.',
    event_type: 'market',
    source: 'eventbrite',
    original_url: 'https://eventbrite.com/e/ferry-plaza-farmers-market-12345'
  },
  {
    id: 2,
    title: 'Downtown Oakland Art Walk',
    start_time: '2025-11-15T18:00:00Z',
    end_time: '2025-11-15T21:00:00Z',
    location: 'Downtown Oakland, Oakland, CA',
    price: 'Free',
    description: 'Monthly art walk',
    description_detail: 'Explore local galleries, street art, and live performances. Food trucks and pop-up vendors. Family-friendly event featuring over 20 participating galleries.',
    event_type: 'art',
    source: 'sfstation',
    original_url: 'https://sfstation.com/oakland-art-walk'
  },
  {
    id: 3,
    title: 'San Jose Food Truck Festival',
    start_time: '2025-11-16T11:00:00Z',
    end_time: '2025-11-16T17:00:00Z',
    location: 'Santana Row, San Jose, CA',
    price: '$5',
    description: 'Food truck festival',
    description_detail: 'Over 30 gourmet food trucks, live music, and craft beer garden. Features cuisine from around the world. Kids activities area included.',
    event_type: 'food',
    source: 'eventbrite',
    original_url: 'https://eventbrite.com/e/sj-food-truck-fest-67890'
  },
  {
    id: 4,
    title: 'Half Moon Bay Pumpkin Festival',
    start_time: '2025-11-16T09:00:00Z',
    end_time: '2025-11-16T18:00:00Z',
    location: 'Half Moon Bay, CA',
    price: '$15',
    description: 'Annual pumpkin festival',
    description_detail: 'Giant pumpkin weigh-off, costume contest, pumpkin carving, pie eating contest, and live entertainment. Over 200 vendors and food booths.',
    event_type: 'festival',
    source: 'funcheap',
    original_url: 'https://pumpkinfest.com'
  }
];

console.log('\n' + '='.repeat(70));
console.log('DEMO: English Post Generator Output');
console.log('='.repeat(70) + '\n');

console.log('This demo shows what the generated posts will look like.\n');

// Reddit 格式演示
console.log('━'.repeat(70));
console.log('📱 REDDIT FORMAT (.md file)');
console.log('━'.repeat(70) + '\n');

const redditPost = `# Bay Area Events This Week (Nov 10-16)

Compiled a list of local events for the week. Hope you find something fun!

## Markets & Fairs

**Ferry Plaza Farmers Market**
Sat 11/15, 10:00 AM - 2:00 PM | San Francisco, CA | Free
Fresh produce, artisan goods, and live music. Over 100 vendors featuring local farms and food artisans. Pet-friendly event.
https://eventbrite.com/e/ferry-plaza-farmers-market-12345

## Festivals

**Half Moon Bay Pumpkin Festival**
Sun 11/16, 9:00 AM - 6:00 PM | Half Moon Bay, CA | $15
Giant pumpkin weigh-off, costume contest, pumpkin carving, pie eating contest, and live entertainment. Over 200 vendors and food booths.
https://pumpkinfest.com

## Food & Drink

**San Jose Food Truck Festival**
Sun 11/16, 11:00 AM - 5:00 PM | Santana Row, San Jose, CA | $5
Over 30 gourmet food trucks, live music, and craft beer garden. Features cuisine from around the world. Kids activities area included.
https://eventbrite.com/e/sj-food-truck-fest-67890

## Arts & Culture

**Downtown Oakland Art Walk**
Sat 11/15, 6:00 PM - 9:00 PM | Downtown Oakland, CA | Free
Explore local galleries, street art, and live performances. Food trucks and pop-up vendors. Family-friendly event featuring over 20 participating galleries.
https://sfstation.com/oakland-art-walk

---
*Sources: Eventbrite, SFStation, Funcheap. Events listed for informational purposes.*`;

console.log(redditPost);
console.log('\n' + '━'.repeat(70) + '\n\n');

// Nextdoor 格式演示
console.log('━'.repeat(70));
console.log('📱 NEXTDOOR FORMAT (.txt file)');
console.log('━'.repeat(70) + '\n');

const nextdoorPost = `This Week's Local Events (Nov 10-16) 🌟

Hi neighbors! I put together a list of events happening around the Bay Area this week. Thought some of you might be interested:

🛒 Sat 11/15 | Ferry Plaza Farmers Market
🕒 10:00 AM - 2:00 PM
📍 San Francisco, CA | Free
Fresh produce, artisan goods, and live music. Over 100 vendors featuring local farms and food artisans. Pet-friendly event.
→ https://eventbrite.com/e/ferry-plaza-farmers-market-12345

🎨 Sat 11/15 | Downtown Oakland Art Walk
🕒 6:00 PM - 9:00 PM
📍 Downtown Oakland, CA | Free
Explore local galleries, street art, and live performances. Food trucks and pop-up vendors. Family-friendly event featuring over 20 participating galleries.
→ https://sfstation.com/oakland-art-walk

🍽️ Sun 11/16 | San Jose Food Truck Festival
🕒 11:00 AM - 5:00 PM
📍 Santana Row, San Jose, CA | $5
Over 30 gourmet food trucks, live music, and craft beer garden. Features cuisine from around the world. Kids activities area included.
→ https://eventbrite.com/e/sj-food-truck-fest-67890

🎉 Sun 11/16 | Half Moon Bay Pumpkin Festival
🕒 9:00 AM - 6:00 PM
📍 Half Moon Bay, CA | $15
Giant pumpkin weigh-off, costume contest, pumpkin carving, pie eating contest, and live entertainment. Over 200 vendors and food booths.
→ https://pumpkinfest.com

Let me know if you're planning to check any of these out! 😊`;

console.log(nextdoorPost);
console.log('\n' + '━'.repeat(70) + '\n');

console.log('💡 Key Differences:\n');
console.log('   Reddit:');
console.log('   • Grouped by category (Markets, Festivals, Food, Arts)');
console.log('   • Markdown formatting (## headers, **bold**)');
console.log('   • Information-dense, neutral tone');
console.log('   • Source attribution footer\n');
console.log('   Nextdoor:');
console.log('   • Chronological order (sorted by date/time)');
console.log('   • Friendly, conversational tone');
console.log('   • Emoji-enhanced for visual appeal');
console.log('   • Personal touch ("Hi neighbors!")\n');

console.log('📁 To generate real posts from your database:\n');
console.log('   npm run generate-english\n');
console.log('   or\n');
console.log('   node generate-english-posts.js\n');

console.log('='.repeat(70) + '\n');
