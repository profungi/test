#!/usr/bin/env node

/**
 * 清理数据库中下周的活动，用于测试
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'events.db');

console.log('🗑️  清理下周活动数据...');
console.log(`数据库路径: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 计算下周的日期范围
const now = new Date();
const nextWeekStart = new Date(now);
nextWeekStart.setDate(now.getDate() + 7);
nextWeekStart.setHours(0, 0, 0, 0);

const nextWeekEnd = new Date(nextWeekStart);
nextWeekEnd.setDate(nextWeekStart.getDate() + 7);
nextWeekEnd.setHours(23, 59, 59, 999);

console.log(`\n📅 删除日期范围:`);
console.log(`   从: ${nextWeekStart.toISOString()}`);
console.log(`   到: ${nextWeekEnd.toISOString()}`);

// 先查询要删除的活动数量
const countQuery = `
  SELECT COUNT(*) as count
  FROM events
  WHERE event_date >= ? AND event_date <= ?
`;

db.get(countQuery, [nextWeekStart.toISOString(), nextWeekEnd.toISOString()], (err, row) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    db.close();
    process.exit(1);
  }

  const count = row.count;
  console.log(`\n📊 找到 ${count} 个下周的活动`);

  if (count === 0) {
    console.log('✅ 没有需要删除的活动');
    db.close();
    return;
  }

  // 删除活动
  const deleteQuery = `
    DELETE FROM events
    WHERE event_date >= ? AND event_date <= ?
  `;

  db.run(deleteQuery, [nextWeekStart.toISOString(), nextWeekEnd.toISOString()], function(err) {
    if (err) {
      console.error('❌ 删除失败:', err.message);
      db.close();
      process.exit(1);
    }

    console.log(`✅ 成功删除 ${this.changes} 个活动`);

    // 显示剩余活动数量
    db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
      if (err) {
        console.error('查询剩余活动数失败:', err.message);
      } else {
        console.log(`📊 数据库中剩余 ${row.count} 个活动`);
      }

      db.close((err) => {
        if (err) {
          console.error('关闭数据库时出错:', err.message);
        } else {
          console.log('✅ 数据库已关闭');
        }
      });
    });
  });
});
