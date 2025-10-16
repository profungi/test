#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'events.db');
const db = new sqlite3.Database(dbPath);

console.log('📊 检查数据库中的 description 字段内容\n');
console.log('='.repeat(80));

db.all(`
  SELECT
    id,
    title,
    source,
    description,
    description_detail,
    length(description) as desc_len,
    length(description_detail) as detail_len
  FROM events
  ORDER BY id
  LIMIT 10
`, [], (err, rows) => {
  if (err) {
    console.error('❌ 错误:', err.message);
    db.close();
    return;
  }

  if (!rows || rows.length === 0) {
    console.log('⚠️  数据库中没有活动数据');
    db.close();
    return;
  }

  rows.forEach((row, index) => {
    console.log(`\n活动 #${index + 1} (ID: ${row.id})`);
    console.log(`来源: ${row.source}`);
    console.log(`标题: ${row.title}`);
    console.log(`\ndescription (${row.desc_len || 0} 字符):`);
    if (row.description) {
      console.log(`"${row.description.substring(0, 200)}${row.description.length > 200 ? '...' : ''}"`);
    } else {
      console.log('(NULL)');
    }

    console.log(`\ndescription_detail (${row.detail_len || 0} 字符):`);
    if (row.description_detail) {
      console.log(`"${row.description_detail.substring(0, 200)}${row.description_detail.length > 200 ? '...' : ''}"`);
    } else {
      console.log('(NULL)');
    }
    console.log('-'.repeat(80));
  });

  console.log(`\n✅ 共显示 ${rows.length} 条记录\n`);

  // 统计分析
  db.get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END) as has_desc,
      SUM(CASE WHEN description_detail IS NOT NULL AND description_detail != '' THEN 1 ELSE 0 END) as has_detail,
      AVG(length(description)) as avg_desc_len,
      AVG(length(description_detail)) as avg_detail_len
    FROM events
  `, [], (err, stats) => {
    if (!err && stats) {
      console.log('📈 统计信息:');
      console.log(`   总活动数: ${stats.total}`);
      console.log(`   有 description: ${stats.has_desc} (${(stats.has_desc/stats.total*100).toFixed(1)}%)`);
      console.log(`   有 description_detail: ${stats.has_detail} (${(stats.has_detail/stats.total*100).toFixed(1)}%)`);
      console.log(`   description 平均长度: ${Math.round(stats.avg_desc_len || 0)} 字符`);
      console.log(`   description_detail 平均长度: ${Math.round(stats.avg_detail_len || 0)} 字符`);
    }
    db.close();
  });
});
