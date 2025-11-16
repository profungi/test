#!/usr/bin/env node

const readline = require('readline');
const EventDatabase = require('./src/utils/database');
const EnglishPostGenerator = require('./src/formatters/english-post-generator');
const CommonHelpers = require('./src/utils/common-helpers');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('📝 ENGLISH POST GENERATOR (Reddit & Nextdoor)');
  console.log('='.repeat(60) + '\n');

  const db = new EventDatabase();
  const generator = new EnglishPostGenerator();

  try {
    await db.connect();

    // Step 1: 选择周
    console.log('📅 Step 1: Select the week for events\n');

    const weekIdentifier = await question('Enter week identifier (e.g., 2025-11-10_to_2025-11-16): ');

    if (!weekIdentifier || !weekIdentifier.match(/\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}/)) {
      console.log('❌ Invalid week identifier format. Example: 2025-11-10_to_2025-11-16');
      rl.close();
      await db.close();
      return;
    }

    // Step 2: 获取所有活动
    console.log(`\n🔍 Fetching all events for week ${weekIdentifier}...\n`);

    const events = await db.getWeekEvents(weekIdentifier);

    if (events.length === 0) {
      console.log('❌ No events found for this week. Please scrape events first.');
      rl.close();
      await db.close();
      return;
    }

    console.log(`✅ Found ${events.length} events\n`);

    // 显示统计信息
    console.log('📊 Event Statistics:');
    const typeStats = CommonHelpers.getEventTypeStats(events);
    Object.keys(typeStats).forEach(type => {
      console.log(`   ${type}: ${typeStats[type]}`);
    });

    const priceStats = CommonHelpers.getPriceDistribution(events);
    console.log(`\n💰 Price Distribution:`);
    console.log(`   Free: ${priceStats.free}`);
    console.log(`   Paid: ${priceStats.paid}`);

    const sourceStats = {};
    events.forEach(e => {
      sourceStats[e.source] = (sourceStats[e.source] || 0) + 1;
    });
    console.log(`\n🌐 Sources:`);
    Object.keys(sourceStats).forEach(source => {
      console.log(`   ${source}: ${sourceStats[source]}`);
    });

    // Step 3: 选择平台
    console.log('\n📱 Step 2: Select platform(s) to generate\n');
    console.log('Available platforms:');
    console.log('  1. Reddit (Markdown format)');
    console.log('  2. Nextdoor (Plain text format)');
    console.log('  3. Both\n');

    const platformChoice = await question('Enter choice (1/2/3): ');

    const weekRange = {
      identifier: weekIdentifier,
      readable: weekIdentifier.replace('_to_', ' to ')
    };

    const platforms = [];
    if (platformChoice === '1') {
      platforms.push('reddit');
    } else if (platformChoice === '2') {
      platforms.push('nextdoor');
    } else if (platformChoice === '3') {
      platforms.push('reddit', 'nextdoor');
    } else {
      console.log('❌ Invalid choice');
      rl.close();
      await db.close();
      return;
    }

    // Step 4: 生成帖子
    console.log('\n🚀 Generating posts...\n');

    const results = [];

    for (const platform of platforms) {
      const result = await generator.generatePost(events, weekRange, platform);
      results.push(result);
    }

    // Step 5: 总结
    console.log('\n' + '='.repeat(60));
    console.log('✅ GENERATION COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📁 Generated files:');
    results.forEach(result => {
      console.log(`   ${result.platform}: ${result.filepath}`);
    });
    console.log('\n💡 Next steps:');
    console.log('   1. Review the generated files');
    console.log('   2. Make any manual edits if needed');
    console.log('   3. Copy and paste to the respective platforms');
    console.log('\n📝 Platform-specific tips:');
    console.log('   Reddit: Post to r/BayArea, r/sanfrancisco, or r/oakland');
    console.log('           Best time: Thursday evening or Friday morning');
    console.log('   Nextdoor: Choose appropriate neighborhood');
    console.log('             Category: Events or General');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    rl.close();
    await db.close();
  }
}

main();
