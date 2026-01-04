#!/usr/bin/env node

/**
 * 完整的抓取流程测试
 *
 * 测试 npm run scrape 的所有步骤：
 * 1. 抓取各个数据源（每个限制5个活动）
 * 2. 翻译标题（title_zh）
 * 3. 生成摘要（summary_zh, summary_en）
 * 4. AI分类
 * 5. 保存到测试数据库
 *
 * ⚠️ 重要：使用独立的测试数据库，不影响 Turso 生产数据
 */

const path = require('path');
const fs = require('fs');

// ========== 测试环境设置 ==========
const TEST_DB_PATH = path.join(__dirname, 'test-data', 'test-full-scrape.db');
const testDataDir = path.dirname(TEST_DB_PATH);
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// 删除旧的测试数据库（确保每次测试都是干净的）
if (fs.existsSync(TEST_DB_PATH)) {
  console.log('🗑️  删除旧的测试数据库...');
  fs.unlinkSync(TEST_DB_PATH);
}

// ⚠️ 关键：禁用 Turso，强制使用本地 SQLite 测试数据库
delete process.env.USE_TURSO;
process.env.DATABASE_PATH = TEST_DB_PATH;

console.log('═══════════════════════════════════════════════════════════');
console.log('  完整抓取流程测试');
console.log('═══════════════════════════════════════════════════════════');
console.log(`📦 测试数据库: ${TEST_DB_PATH}`);
console.log('⚠️  每个数据源限制抓取 5 个活动（加速测试）\n');

// ========== 加载依赖 ==========
require('dotenv').config();

const EventDatabase = require('./src/utils/database');
const AIEventClassifier = require('./src/utils/ai-classifier');
const Translator = require('./src/utils/translator');
const Summarizer = require('./src/utils/summarizer');

const EventbriteScraper = require('./src/scrapers/eventbrite-scraper');
const SFStationScraper = require('./src/scrapers/sfstation-scraper');
const FuncheapWeekendScraper = require('./src/scrapers/funcheap-weekend-scraper');
const ConfigurableScraperManager = require('./src/scrapers/configurable-scraper-manager');

// ========== 限制事件数量的包装器 ==========
class LimitedScraper {
  constructor(scraper, limit = 5) {
    this.scraper = scraper;
    this.limit = limit;
    this.sourceName = scraper.sourceName;
  }

  async scrape(targetWeek) {
    console.log(`   📥 抓取 ${this.sourceName} (限制: ${this.limit} 个活动)...`);
    const events = await this.scraper.scrape(targetWeek);
    const limited = events.slice(0, this.limit);
    console.log(`   ✅ ${this.sourceName}: ${limited.length}/${events.length} 个活动`);
    return limited;
  }
}

// ========== 主测试函数 ==========
async function testFullScrapeWorkflow() {
  const db = new EventDatabase();
  const aiClassifier = new AIEventClassifier();
  const translator = new Translator(process.env.TRANSLATOR_PROVIDER || 'auto');
  const summarizer = new Summarizer();

  try {
    // 1. 连接数据库
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  步骤 1/7: 连接数据库');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    await db.connect();
    console.log('✅ 数据库连接成功\n');

    // 2. 初始化所有爬虫（限制每个5个活动）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  步骤 2/7: 抓取所有数据源');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const legacyScrapers = [
      new LimitedScraper(new EventbriteScraper(), 5),
      new LimitedScraper(new SFStationScraper(), 5),
      new LimitedScraper(new FuncheapWeekendScraper(), 5)
    ];

    const configurableManager = new ConfigurableScraperManager();
    const configurableScrapers = configurableManager.getAllScrapers().map(
      scraper => new LimitedScraper(scraper, 5)
    );

    const allScrapers = [...legacyScrapers, ...configurableScrapers];
    const targetWeek = 'next';

    // 并行抓取所有数据源
    const scrapePromises = allScrapers.map(async (scraper) => {
      try {
        const events = await scraper.scrape(targetWeek);
        await db.logScrapingResult(scraper.sourceName, events.length, true);
        return { success: true, events, source: scraper.sourceName };
      } catch (error) {
        console.error(`   ❌ ${scraper.sourceName} 失败: ${error.message}`);
        await db.logScrapingResult(scraper.sourceName, 0, false, error.message);
        return { success: false, events: [], source: scraper.sourceName };
      }
    });

    const results = await Promise.allSettled(scrapePromises);
    const allEvents = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        allEvents.push(...result.value.events);
      }
    });

    console.log(`\n✅ 抓取完成，共 ${allEvents.length} 个活动\n`);

    if (allEvents.length === 0) {
      console.log('❌ 没有抓取到任何活动，测试结束');
      return;
    }

    // 3. 添加 weekIdentifier 并保存到数据库
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  步骤 3/7: 保存活动到数据库');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const weekRange = allScrapers[0].scraper.getNextWeekRange();
    const savedEvents = [];

    for (const event of allEvents) {
      event.weekIdentifier = weekRange.identifier;
      try {
        const result = await db.saveEvent(event);
        if (result.saved) {
          // 将数据库 ID 添加到事件对象中，用于后续更新
          event.id = result.id;
          savedEvents.push(event);
        }
      } catch (error) {
        console.warn(`   保存失败: ${event.title} - ${error.message}`);
      }
    }

    console.log(`✅ 保存成功: ${savedEvents.length}/${allEvents.length} 个活动\n`);

    if (savedEvents.length === 0) {
      console.log('❌ 没有新活动需要处理，测试结束');
      return;
    }

    // 4. 翻译标题
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  步骤 4/7: 翻译活动标题');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const translatedEvents = await translator.translateEvents(
      savedEvents,
      5,   // 每批翻译 5 个
      1000, // 每批间隔 1 秒
      db   // 传入数据库实例以更新翻译
    );

    const translatedCount = translatedEvents.filter(e => e.title_zh).length;
    console.log(`\n✅ 翻译完成: ${translatedCount}/${translatedEvents.length} 个活动有中文标题\n`);

    // 立即验证数据库
    console.log('🔍 立即验证数据库中的翻译...');
    const checkTranslations = await new Promise((resolve, reject) => {
      db.db.all('SELECT id, title, title_zh FROM events WHERE id IN (' + savedEvents.map(e => e.id).join(',') + ')', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    const dbHasTranslations = checkTranslations.filter(r => r.title_zh).length;
    console.log(`   数据库中有翻译的活动: ${dbHasTranslations}/${checkTranslations.length}`);
    if (dbHasTranslations < checkTranslations.length) {
      console.log('   ⚠️  警告：部分翻译未写入数据库！');
      checkTranslations.forEach(r => {
        if (!r.title_zh) {
          console.log(`     - ID ${r.id}: ${r.title} - 缺少 title_zh`);
        }
      });
    }
    console.log('');

    // 5. 生成摘要
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  步骤 5/7: 生成活动摘要');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const summarizedEvents = await summarizer.summarizeEvents(
      translatedEvents,
      3,    // 每批处理 3 个
      2000, // 每批间隔 2 秒
      db    // 传入数据库实例以更新摘要
    );

    const summarizedCount = summarizedEvents.filter(e => e.summary_zh || e.summary_en).length;
    console.log(`\n✅ 摘要生成完成: ${summarizedCount}/${summarizedEvents.length} 个活动有摘要\n`);

    // 6. AI 分类
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  步骤 6/7: AI 分类');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const classifiedEvents = await aiClassifier.classifyEvents(summarizedEvents);
    console.log(`✅ AI 分类完成: ${classifiedEvents.length} 个活动\n`);

    // 7. 验证数据库中的数据
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  步骤 7/7: 验证数据库数据');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await verifyDatabaseData(db);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  测试汇总');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ 抓取活动: ${allEvents.length} 个`);
    console.log(`✅ 保存活动: ${savedEvents.length} 个`);
    console.log(`✅ 翻译标题: ${translatedCount} 个`);
    console.log(`✅ 生成摘要: ${summarizedCount} 个`);
    console.log(`✅ AI 分类: ${classifiedEvents.length} 个`);
    console.log(`\n📁 测试数据库: ${TEST_DB_PATH}\n`);

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.close();
    console.log('✅ 测试完成\n');
  }
}

// ========== 验证数据库数据 ==========
async function verifyDatabaseData(db) {
  console.log('🔍 检查数据库数据完整性...\n');

  // 获取所有活动
  const allEvents = await new Promise((resolve, reject) => {
    db.db.all('SELECT * FROM events ORDER BY id', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log(`   总活动数: ${allEvents.length}`);

  if (allEvents.length === 0) {
    console.log('   ⚠️  数据库中没有活动');
    return;
  }

  // 统计字段完整性
  const stats = {
    total: allEvents.length,
    hasTitle: 0,
    hasTitleZh: 0,
    hasStartTime: 0,
    hasLocation: 0,
    hasUrl: 0,
    hasSummaryZh: 0,
    hasSummaryEn: 0,
    hasEventType: 0,
    hasPriority: 0
  };

  allEvents.forEach(event => {
    if (event.title) stats.hasTitle++;
    if (event.title_zh) stats.hasTitleZh++;
    if (event.start_time) stats.hasStartTime++;
    if (event.location) stats.hasLocation++;
    if (event.original_url) stats.hasUrl++;
    if (event.summary_zh) stats.hasSummaryZh++;
    if (event.summary_en) stats.hasSummaryEn++;
    if (event.event_type) stats.hasEventType++;
    if (event.priority !== null && event.priority !== undefined) stats.hasPriority++;
  });

  console.log('\n   字段完整性统计:');
  console.log(`   ├─ 标题 (title): ${stats.hasTitle}/${stats.total} (${percent(stats.hasTitle, stats.total)}%)`);
  console.log(`   ├─ 中文标题 (title_zh): ${stats.hasTitleZh}/${stats.total} (${percent(stats.hasTitleZh, stats.total)}%)`);
  console.log(`   ├─ 开始时间 (start_time): ${stats.hasStartTime}/${stats.total} (${percent(stats.hasStartTime, stats.total)}%)`);
  console.log(`   ├─ 地点 (location): ${stats.hasLocation}/${stats.total} (${percent(stats.hasLocation, stats.total)}%)`);
  console.log(`   ├─ URL (original_url): ${stats.hasUrl}/${stats.total} (${percent(stats.hasUrl, stats.total)}%)`);
  console.log(`   ├─ 中文摘要 (summary_zh): ${stats.hasSummaryZh}/${stats.total} (${percent(stats.hasSummaryZh, stats.total)}%)`);
  console.log(`   ├─ 英文摘要 (summary_en): ${stats.hasSummaryEn}/${stats.total} (${percent(stats.hasSummaryEn, stats.total)}%)`);
  console.log(`   ├─ 活动类型 (event_type): ${stats.hasEventType}/${stats.total} (${percent(stats.hasEventType, stats.total)}%)`);
  console.log(`   └─ 优先级 (priority): ${stats.hasPriority}/${stats.total} (${percent(stats.hasPriority, stats.total)}%)`);

  // 检查关键字段（翻译和摘要）
  console.log('\n   关键验证点:');

  const missingTitleZh = allEvents.filter(e => !e.title_zh);
  if (missingTitleZh.length > 0) {
    console.log(`   ⚠️  ${missingTitleZh.length} 个活动缺少中文标题 (title_zh)`);
  } else {
    console.log(`   ✅ 所有活动都有中文标题`);
  }

  const missingSummaryZh = allEvents.filter(e => !e.summary_zh);
  if (missingSummaryZh.length > 0) {
    console.log(`   ⚠️  ${missingSummaryZh.length} 个活动缺少中文摘要 (summary_zh)`);
  } else {
    console.log(`   ✅ 所有活动都有中文摘要`);
  }

  const missingSummaryEn = allEvents.filter(e => !e.summary_en);
  if (missingSummaryEn.length > 0) {
    console.log(`   ⚠️  ${missingSummaryEn.length} 个活动缺少英文摘要 (summary_en)`);
  } else {
    console.log(`   ✅ 所有活动都有英文摘要`);
  }

  // 显示前3个活动的完整数据
  console.log('\n   前3个活动示例:\n');
  allEvents.slice(0, 3).forEach((event, idx) => {
    console.log(`   活动 ${idx + 1}:`);
    console.log(`   ├─ 标题: ${event.title}`);
    console.log(`   ├─ 中文标题: ${event.title_zh || '❌ 缺失'}`);
    console.log(`   ├─ 开始时间: ${event.start_time}`);
    console.log(`   ├─ 地点: ${event.location}`);
    console.log(`   ├─ URL: ${event.original_url}`);
    console.log(`   ├─ 中文摘要: ${event.summary_zh ? truncate(event.summary_zh, 50) : '❌ 缺失'}`);
    console.log(`   ├─ 英文摘要: ${event.summary_en ? truncate(event.summary_en, 50) : '❌ 缺失'}`);
    console.log(`   ├─ 活动类型: ${event.event_type || '未分类'}`);
    console.log(`   └─ 优先级: ${event.priority !== null ? event.priority : '未设置'}`);
    console.log('');
  });

  // 按来源统计
  const bySource = await new Promise((resolve, reject) => {
    db.db.all('SELECT source, COUNT(*) as count FROM events GROUP BY source', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log('   按来源分布:');
  bySource.forEach(row => {
    console.log(`   - ${row.source}: ${row.count} 个活动`);
  });
}

// ========== 辅助函数 ==========
function percent(num, total) {
  if (total === 0) return 0;
  return Math.round((num / total) * 100);
}

function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

// ========== 运行测试 ==========
testFullScrapeWorkflow().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
