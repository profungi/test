#!/usr/bin/env node

/**
 * 清空数据库中所有活动，用于测试
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'events.db');

console.log('🗑️  清空所有活动数据...');
console.log(`数据库路径: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 无法打开数据库:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 先查询总数
db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    db.close();
    process.exit(1);
  }

  const count = row.count;
  console.log(`\n📊 当前数据库中有 ${count} 个活动`);

  if (count === 0) {
    console.log('✅ 数据库已经是空的');
    db.close();
    return;
  }

  // 删除所有活动
  db.run('DELETE FROM events', function(err) {
    if (err) {
      console.error('❌ 删除失败:', err.message);
      db.close();
      process.exit(1);
    }

    console.log(`✅ 成功删除 ${this.changes} 个活动`);
    console.log('✅ 数据库已清空');

    db.close((err) => {
      if (err) {
        console.error('关闭数据库时出错:', err.message);
      } else {
        console.log('✅ 数据库已关闭');
      }
    });
  });
});
