#!/usr/bin/env node

/**
 * 快速测试脚本：5 分钟快速验证优化
 * 这个脚本不需要 Node 运行时，只验证代码逻辑
 *
 * 用法：
 *   node quick-test.js
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 开始快速验证优化...\n');

// ============ 检查 1: 数据库索引 ============

console.log('检查 1️⃣  数据库索引代码');
console.log('-'.repeat(50));

const dbPath = path.join(__dirname, 'src/utils/database.js');
const dbCode = fs.readFileSync(dbPath, 'utf-8');

const indexes = [
  { name: 'idx_events_dedup', pattern: /idx_events_dedup/ },
  { name: 'idx_events_week', pattern: /idx_events_week/ },
  { name: 'idx_events_location', pattern: /idx_events_location/ },
  { name: 'idx_events_normalized_title', pattern: /idx_events_normalized_title/ },
  { name: 'idx_events_source', pattern: /idx_events_source/ }
];

let indexCount = 0;
indexes.forEach(idx => {
  if (idx.pattern.test(dbCode)) {
    console.log(`  ✅ 找到索引: ${idx.name}`);
    indexCount++;
  } else {
    console.log(`  ❌ 缺少索引: ${idx.name}`);
  }
});

console.log(`\n  结果: ${indexCount}/5 个索引`);

// ============ 检查 2: 关键词搜索阈值 ============

console.log('\n检查 2️⃣  关键词搜索逻辑');
console.log('-'.repeat(50));

const scraperPath = path.join(__dirname, 'src/scrapers/eventbrite-scraper.js');
const scraperCode = fs.readFileSync(scraperPath, 'utf-8');

let keywordChecks = 0;

// 检查阈值定义
if (/const\s+keywordSearchThreshold\s*=\s*50/.test(scraperCode)) {
  console.log(`  ✅ 阈值定义: const keywordSearchThreshold = 50`);
  keywordChecks++;
} else {
  console.log(`  ❌ 缺少阈值定义或值不正确`);
}

// 检查条件判断
if (/events\.length\s*<\s*keywordSearchThreshold/.test(scraperCode)) {
  console.log(`  ✅ 条件判断: events.length < keywordSearchThreshold`);
  keywordChecks++;
} else {
  console.log(`  ❌ 缺少条件判断`);
}

// 检查跳过逻辑
if (/⏭️\s*Skipping keyword searches/.test(scraperCode) ||
    /Skipping keyword searches/.test(scraperCode)) {
  console.log(`  ✅ 跳过逻辑: 日志提示已实现`);
  keywordChecks++;
} else {
  console.log(`  ℹ️  跳过逻辑: 未找到对应日志`);
}

console.log(`\n  结果: ${keywordChecks}/3 项检查`);

// ============ 检查 3: 代码质量 ============

console.log('\n检查 3️⃣  代码质量');
console.log('-'.repeat(50));

let qualityChecks = 0;

// 检查注释
if (/优化:|performance optimization/i.test(dbCode) ||
    /优化:|performance optimization/i.test(scraperCode)) {
  console.log(`  ✅ 包含优化说明注释`);
  qualityChecks++;
} else {
  console.log(`  ℹ️  可以添加更多注释说明`);
}

// 检查错误处理
if (/try\s*{[\s\S]*?catch/.test(dbCode) && /catch/.test(dbCode)) {
  console.log(`  ✅ 包含错误处理`);
  qualityChecks++;
} else {
  console.log(`  ❌ 缺少错误处理`);
}

// 检查日志输出
if (/console\.log/.test(dbCode) && /console\.log/.test(scraperCode)) {
  console.log(`  ✅ 包含日志输出`);
  qualityChecks++;
} else {
  console.log(`  ❌ 缺少日志输出`);
}

console.log(`\n  结果: ${qualityChecks}/3 项`);

// ============ 总结 ============

console.log('\n' + '='.repeat(50));
console.log('📊 验证总结');
console.log('='.repeat(50));

const totalChecks = indexCount + keywordChecks + qualityChecks;
const maxChecks = 5 + 3 + 3;

console.log(`\n总体进度: ${totalChecks}/${maxChecks} (${Math.round(totalChecks/maxChecks*100)}%)`);

if (indexCount === 5 && keywordChecks >= 2) {
  console.log('\n✅ 优化代码验证通过！');
  console.log('   - 数据库索引已全部实现');
  console.log('   - 关键词搜索阈值已实现');
  console.log('\n📚 下一步：');
  console.log('   1. 运行完整测试: node test-optimizations.js');
  console.log('   2. 查看测试指南: cat TEST_GUIDE.md');
  console.log('   3. 运行实际抓取: npm run scrape');
  process.exit(0);
} else {
  console.log('\n⚠️  部分检查未通过，请检查代码');
  console.log(`   数据库索引: ${indexCount}/5`);
  console.log(`   关键词搜索: ${keywordChecks}/3`);
  console.log(`   代码质量: ${qualityChecks}/3`);
  process.exit(1);
}
