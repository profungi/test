#!/usr/bin/env node

/**
 * 诊断脚本：检查 description_detail 为空的原因
 *
 * 用法：
 *   node DIAGNOSTIC_SCRIPT.js
 *
 * 这个脚本会：
 * 1. 检查数据库中 description_detail 的统计信息
 * 2. 检查错误日志
 * 3. 分析选择器有效性
 * 4. 提供诊断结果
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║           description_detail 诊断脚本                         ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// ============ 诊断 1: 检查数据库中的 description_detail ============

console.log('📊 诊断 1: 检查数据库中的 description_detail 字段');
console.log('─'.repeat(60));

const dbPath = path.join(__dirname, 'data', 'events.db');

if (!fs.existsSync(dbPath)) {
  console.log('❌ 数据库文件不存在：', dbPath);
  console.log('   请先运行: npm run scrape\n');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

db.all(`
  SELECT
    COUNT(*) as total_events,
    SUM(CASE WHEN description_detail IS NOT NULL THEN 1 ELSE 0 END) as with_description_detail,
    SUM(CASE WHEN description_detail IS NULL THEN 1 ELSE 0 END) as without_description_detail,
    SUM(CASE WHEN description_detail IS NOT NULL AND LENGTH(description_detail) > 0 THEN 1 ELSE 0 END) as non_empty_description_detail
  FROM events
`, (err, rows) => {
  if (err) {
    console.log('❌ 数据库查询错误:', err.message);
    db.close();
    process.exit(1);
  }

  const row = rows[0];
  console.log(`✅ 总事件数: ${row.total_events}`);
  console.log(`   - 有 description_detail: ${row.with_description_detail}`);
  console.log(`   - 空 description_detail: ${row.without_description_detail}`);
  console.log(`   - 非空 description_detail: ${row.non_empty_description_detail}`);

  if (row.without_description_detail === row.total_events) {
    console.log('\n❌ 结论: 所有事件的 description_detail 都是空的！');
  } else if (row.non_empty_description_detail > 0) {
    console.log(`\n✅ 好消息: ${row.non_empty_description_detail} 个事件有 description_detail`);
  }

  // ============ 诊断 2: 抽样检查 description_detail 的内容 ============

  console.log('\n📊 诊断 2: 抽样查看 description_detail 的值');
  console.log('─'.repeat(60));

  db.all(`
    SELECT title, source, description_detail, description
    FROM events
    LIMIT 5
  `, (err, rows) => {
    if (err) {
      console.log('❌ 查询错误:', err.message);
    } else {
      rows.forEach((event, index) => {
        console.log(`\n事件 ${index + 1}: ${event.title}`);
        console.log(`  源: ${event.source}`);
        console.log(`  description_detail: ${event.description_detail === null ? '❌ NULL' : event.description_detail ? '✅ 有值 (' + (event.description_detail.length) + ' 字符)' : '❌ 空字符串'}`);
        console.log(`  description: ${event.description === null ? '❌ NULL' : event.description ? '✅ 有值 (' + (event.description.length) + ' 字符)' : '❌ 空字符串'}`);
      });
    }

    // ============ 诊断 3: 按来源统计 ============

    console.log('\n📊 诊断 3: 按来源统计 description_detail 情况');
    console.log('─'.repeat(60));

    db.all(`
      SELECT
        source,
        COUNT(*) as total,
        SUM(CASE WHEN description_detail IS NOT NULL AND LENGTH(description_detail) > 0 THEN 1 ELSE 0 END) as with_detail,
        SUM(CASE WHEN description_detail IS NULL OR LENGTH(description_detail) = 0 THEN 1 ELSE 0 END) as without_detail
      FROM events
      GROUP BY source
    `, (err, rows) => {
      if (err) {
        console.log('❌ 查询错误:', err.message);
      } else {
        rows.forEach(row => {
          const percentage = row.total > 0 ? Math.round((row.with_detail / row.total) * 100) : 0;
          console.log(`\n${row.source}:`);
          console.log(`  总数: ${row.total}`);
          console.log(`  有 description_detail: ${row.with_detail} (${percentage}%)`);
          console.log(`  无 description_detail: ${row.without_detail}`);
        });
      }

      // ============ 诊断 4: 检查错误日志 ============

      console.log('\n📊 诊断 4: 检查错误日志');
      console.log('─'.repeat(60));

      const logsDir = path.join(__dirname, 'data', 'logs');
      if (fs.existsSync(logsDir)) {
        const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
        if (files.length > 0) {
          const latestLog = path.join(logsDir, files[files.length - 1]);
          const content = fs.readFileSync(latestLog, 'utf-8');

          // 查找相关错误
          const errors = content.split('\n').filter(line =>
            /failed|error|failed to fetch|description|detail/i.test(line)
          );

          if (errors.length > 0) {
            console.log(`✅ 在日志中找到 ${errors.length} 条相关信息：\n`);
            errors.slice(-10).forEach(error => {  // 显示最后 10 条
              console.log(`  ${error}`);
            });
          } else {
            console.log('✅ 日志中没有发现相关错误信息');
          }
        } else {
          console.log('ℹ️  没有找到日志文件');
        }
      } else {
        console.log('ℹ️  日志目录不存在');
      }

      // ============ 诊断 5: 检查代码中的选择器 ============

      console.log('\n📊 诊断 5: 检查代码中的 CSS 选择器');
      console.log('─'.repeat(60));

      const eventbritePath = path.join(__dirname, 'src/scrapers/eventbrite-scraper.js');
      const code = fs.readFileSync(eventbritePath, 'utf-8');

      // 提取选择器数组
      const selectorMatch = code.match(/const descriptionSelectors = \[([\s\S]*?)\];/);
      if (selectorMatch) {
        const selectorsStr = selectorMatch[1];
        const selectors = selectorsStr.match(/'[^']*'/g) || [];
        console.log(`✅ 在 eventbrite-scraper.js 中找到 ${selectors.length} 个选择器：`);
        selectors.forEach(selector => {
          console.log(`  ${selector}`);
        });
      }

      // 检查长度要求
      const lengthMatch = code.match(/\.length\s*>\s*(\d+)/);
      if (lengthMatch) {
        console.log(`\n✅ 长度要求: > ${lengthMatch[1]} 字符`);
      }

      // ============ 最终诊断总结 ============

      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                     诊断总结与建议                             ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');

      const percentage = row.total_events > 0 ? Math.round((row.non_empty_description_detail / row.total_events) * 100) : 0;

      if (percentage === 0) {
        console.log('❌ 问题确认: 100% 的事件都没有 description_detail\n');
        console.log('可能原因：');
        console.log('  1️⃣  CSS 选择器失效（Eventbrite 改变了 HTML 结构）');
        console.log('  2️⃣  详情页抓取失败（网络问题）');
        console.log('  3️⃣  描述内容太短（< 50字符）\n');

        console.log('建议的诊断步骤：');
        console.log('  1. 手动访问 Eventbrite 活动详情页');
        console.log('  2. 按 F12 打开开发者工具');
        console.log('  3. 在控制台运行选择器测试（见下方）\n');

        console.log('选择器测试代码（复制到浏览器控制台）：');
        console.log(`
  // 测试所有选择器
  const selectors = [
    '[class*="structured-content"]',
    '[data-testid="description"]',
    '[class*="event-details__main"]',
    '[class*="description-content"]',
    '[class*="event-description"]',
    '.event-details'
  ];

  selectors.forEach(selector => {
    const el = document.querySelector(selector);
    console.log(selector + ':', el ? '✅ 找到 (' + el.textContent.substring(0, 30) + '...)' : '❌ 未找到');
  });
        `);
      } else if (percentage > 50) {
        console.log(`✅ 好消息: ${percentage}% 的事件有 description_detail\n`);
        console.log('问题可能是：');
        console.log('  - 某些来源的爬虫工作正常');
        console.log('  - 其他来源需要调查');
      } else {
        console.log(`⚠️  部分问题: 仅 ${percentage}% 的事件有 description_detail\n`);
        console.log('这表明选择器部分有效，但需要改进。');
      }

      console.log('\n📝 诊断完成。');
      console.log('下一步：请按照上面的建议手动检查，然后在 GitHub issue 中报告结果。\n');

      db.close();
    });
  });
});
