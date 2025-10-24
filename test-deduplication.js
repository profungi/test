#!/usr/bin/env node

/**
 * 去重逻辑综合测试脚本
 * 测试所有四层去重机制，包括多日活动检测
 */

const EventScrapeOrchestrator = require('./src/scrape-events');
const EventDatabase = require('./src/utils/database');
const { format, addDays } = require('date-fns');

async function main() {
  console.log('🧪 去重逻辑综合测试\n');
  console.log('='.repeat(80));

  // 第 1 部分：测试内存层去重
  console.log('\n📋 第 1 部分：内存层去重测试');
  console.log('-'.repeat(80));

  const orchestrator = new EventScrapeOrchestrator();

  // 测试数据：模拟真实的 "The Box SF" 活动
  const testEvents = [
    {
      title: 'The Box SF Monthly Artists and Makers Fair (November 1-2)',
      originalUrl: 'https://eventbrite.com/e/the-box-sf-123',
      startTime: '2025-11-01T10:00',
      location: 'The Box SF',
      price: '$10',
      eventType: 'fair'
    },
    {
      title: 'The Box SF Artists & Makers Fair (Nov. 1-2)',  // 相似标题
      originalUrl: 'https://funcheap.com/the-box-sf-nov1',  // 不同URL
      startTime: '2025-11-01T14:00',  // 同一天但不同时间
      location: 'The Box SF',
      price: 'Free',
      eventType: 'fair'
    },
    {
      title: 'The Box SF Artists & Makers Fair (Nov. 1-2)',  // 完全相同
      originalUrl: 'https://funcheap.com/the-box-sf-nov2',  // 不同URL
      startTime: '2025-11-02T10:00',  // 不同天
      location: 'The Box SF',
      price: 'Free',
      eventType: 'fair'
    },
    {
      title: 'Different Event',  // 完全不同
      originalUrl: 'https://eventbrite.com/e/different-456',
      startTime: '2025-11-01T18:00',
      location: 'Golden Gate Park',
      price: 'Free',
      eventType: 'festival'
    }
  ];

  console.log(`\n📥 输入: ${testEvents.length} 个事件\n`);
  testEvents.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.title} @ ${e.location}`);
    console.log(`     时间: ${e.startTime} | URL: ${e.originalUrl}`);
  });

  console.log('\n🔑 唯一键生成结果：\n');
  const keys = {};
  testEvents.forEach((event, i) => {
    const key = orchestrator.generateEventKey(event);
    keys[i] = key;
    console.log(`  事件 ${i + 1}: ${key}`);
  });

  console.log('\n🔄 内存层去重模拟：\n');
  const uniqueMap = new Map();
  let inMemoryDuplicates = 0;

  testEvents.forEach((event, i) => {
    const key = keys[i];
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, event);
      console.log(`  ✅ 事件 ${i + 1}: 保留`);
    } else {
      inMemoryDuplicates++;
      console.log(`  📝 事件 ${i + 1}: 去重（${key}）`);
    }
  });

  console.log(`\n📊 内存层去重结果:`);
  console.log(`  原始: ${testEvents.length} → 去重后: ${uniqueMap.size} (去除 ${inMemoryDuplicates} 个)`);

  // 第 2 部分：测试数据库层去重（多日活动检测）
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 第 2 部分：数据库层去重测试（多日活动检测）');
  console.log('-'.repeat(80));

  try {
    const db = new EventDatabase();
    await db.connect();

    // 获取当前周的标识符
    const thisWeekMonday = new Date();
    thisWeekMonday.setDate(thisWeekMonday.getDate() - thisWeekMonday.getDay() + 1);
    const weekId = format(thisWeekMonday, 'yyyy-MM-dd') + '_to_' + format(addDays(thisWeekMonday, 6), 'yyyy-MM-dd');

    console.log(`\n📅 测试周期: ${weekId}\n`);

    // 构造数据库测试事件
    const dbTestEvents = [
      {
        title: 'The Box SF Monthly Artists and Makers Fair',
        startTime: '2025-11-01T10:00',
        location: 'The Box SF',
        price: '$10',
        description: 'Art and craft fair day 1',
        originalUrl: 'https://eventbrite.com/the-box-sf-1',
        source: 'eventbrite',
        eventType: 'fair',
        weekIdentifier: weekId
      },
      {
        title: 'The Box SF Artists & Makers Fair',  // 不同的标题措辞
        startTime: '2025-11-02T10:00',  // 不同日期
        location: 'The Box SF',
        price: 'Free',
        description: 'Art and craft fair day 2',
        originalUrl: 'https://funcheap.com/the-box-sf-2',
        source: 'funcheap',
        eventType: 'fair',
        weekIdentifier: weekId
      },
      {
        title: 'Halloween Festival',  // 完全不同
        startTime: '2025-10-31T15:00',
        location: 'Golden Gate Park',
        price: 'Free',
        description: 'Halloween celebration',
        originalUrl: 'https://eventbrite.com/halloween',
        source: 'eventbrite',
        eventType: 'festival',
        weekIdentifier: weekId
      }
    ];

    console.log('💾 数据库去重测试（模拟保存）：\n');

    let dbSaved = 0;
    let dbDuplicates = 0;

    for (let i = 0; i < dbTestEvents.length; i++) {
      const event = dbTestEvents[i];
      const isDup = await db.isDuplicate(event);

      console.log(`  事件 ${i + 1}: "${event.title}"`);
      console.log(`     时间: ${event.startTime} | 地点: ${event.location}`);

      if (isDup) {
        console.log(`     ⚠️  被检测为重复`);
        dbDuplicates++;
      } else {
        console.log(`     ✅ 会保存到数据库`);
        dbSaved++;
        // 实际保存到数据库用于后续测试
        await db.saveEvent(event);
      }
      console.log();
    }

    console.log(`📊 数据库层去重结果:`);
    console.log(`  共测试: ${dbTestEvents.length} | 保存: ${dbSaved} | 去重: ${dbDuplicates}`);

    console.log('\n💡 多日活动检测说明：');
    console.log(`  - "The Box SF Monthly Artists and Makers Fair" (Eventbrite)`);
    console.log(`  - "The Box SF Artists & Makers Fair" (Funcheap)`);
    console.log(`  相似度 ≥ 85% 且同地点 → 应被检测为重复`);

    await db.close();

  } catch (error) {
    console.error('❌ 数据库测试失败:', error.message);
  }

  // 第 3 部分：总结
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 测试总结：\n');
  console.log('✅ 内存层去重：');
  console.log(`   - URL 优先去重`);
  console.log(`   - 标题+时间+地点 组合去重`);
  console.log('\n✅ 数据库层去重：');
  console.log(`   - 策略 1：时间接近 + 地点 + 标题相似 (80%)`);
  console.log(`   - 策略 2：多日活动检测 - 同地点 + 高相似度 (85%) + 同周期`);
  console.log('\n✅ Funcheap 爬虫内去重：');
  console.log(`   - 用 title + location 去重而不是 URL`);
  console.log('\n🎯 预期结果：\n   四层去重应该成功检测到 "The Box SF" 的三个重复活动\n');
}

main().catch(error => {
  console.error('❌ 测试脚本错误:', error);
  process.exit(1);
});
