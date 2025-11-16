#!/usr/bin/env node

// 快速测试英文帖子生成器

const EventDatabase = require('./src/utils/database');
const EnglishPostGenerator = require('./src/formatters/english-post-generator');

async function test() {
  console.log('🧪 Testing English Post Generator...\n');

  const db = new EventDatabase();
  const generator = new EnglishPostGenerator();

  try {
    await db.connect();

    const weekIdentifier = '2025-11-10_to_2025-11-16';
    const events = await db.getWeekEvents(weekIdentifier);

    console.log(`📊 Loaded ${events.length} events for week ${weekIdentifier}\n`);

    const weekRange = {
      identifier: weekIdentifier,
      readable: weekIdentifier.replace('_to_', ' to ')
    };

    // 测试 Reddit 格式
    console.log('Testing Reddit format...\n');
    await generator.generatePost(events, weekRange, 'reddit');

    console.log('\n---\n');

    // 测试 Nextdoor 格式
    console.log('Testing Nextdoor format...\n');
    await generator.generatePost(events, weekRange, 'nextdoor');

    console.log('\n✅ Test complete! Check the output directory for generated files.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

test();
