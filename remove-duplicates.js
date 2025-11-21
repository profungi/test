#!/usr/bin/env node
/**
 * 删除数据库中的重复活动
 * 保留优先级最高或ID最小的活动
 */

const Database = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'events.db');
const db = new Database(dbPath);

console.log('🔍 查找并删除重复活动...\n');

// 统计信息
let stats = {
  totalBefore: 0,
  duplicatesFound: 0,
  invalidRemoved: 0,
  duplicatesRemoved: 0,
  totalAfter: 0,
};

// 启用外键约束
db.run('PRAGMA foreign_keys = ON');

// 开始事务
db.serialize(() => {
  // 1. 统计初始数量
  db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
    if (err) {
      console.error('❌ 错误:', err);
      return;
    }
    stats.totalBefore = row.count;
    console.log(`📊 初始活动数: ${stats.totalBefore}`);
  });

  // 2. 删除无效活动（标题是 www.sfstation.com 或其他无效标题）
  console.log('\n🗑️  删除无效活动...');
  const invalidTitles = [
    'www.sfstation.com',
    'www sfstation com',
    'eventbrite.com',
    'funcheap.com',
  ];

  const invalidPlaceholders = invalidTitles.map(() => '?').join(',');
  db.run(
    `DELETE FROM events WHERE normalized_title IN (${invalidPlaceholders})`,
    invalidTitles,
    function (err) {
      if (err) {
        console.error('❌ 删除无效活动失败:', err);
      } else {
        stats.invalidRemoved = this.changes;
        console.log(`   ✅ 删除了 ${stats.invalidRemoved} 个无效活动`);
      }
    }
  );

  // 3. 查找重复活动（相同的 normalized_title）
  console.log('\n🔍 查找重复活动（按标题分组）...');
  db.all(
    `
    SELECT
      normalized_title,
      COUNT(*) as count,
      GROUP_CONCAT(id) as ids,
      GROUP_CONCAT(priority) as priorities
    FROM events
    GROUP BY normalized_title
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    `,
    (err, rows) => {
      if (err) {
        console.error('❌ 查找重复失败:', err);
        return;
      }

      stats.duplicatesFound = rows.length;
      console.log(`   发现 ${stats.duplicatesFound} 组重复活动\n`);

      if (rows.length === 0) {
        finishUp();
        return;
      }

      // 显示重复活动
      rows.slice(0, 5).forEach((row) => {
        const ids = row.ids.split(',').map(Number);
        const priorities = row.priorities.split(',').map(Number);
        console.log(`   • "${row.normalized_title}": ${row.count} 个重复`);
        console.log(`     IDs: ${ids.join(', ')}`);
        console.log(`     优先级: ${priorities.join(', ')}`);
      });

      if (rows.length > 5) {
        console.log(`   ... 还有 ${rows.length - 5} 组重复`);
      }

      console.log('\n🗑️  删除重复活动（保留优先级最高或ID最小的）...');

      // 对每组重复，删除除了最佳的之外的所有记录
      let processed = 0;
      rows.forEach((row) => {
        const ids = row.ids.split(',').map(Number);
        const priorities = row.priorities.split(',').map(Number);

        // 找到优先级最高的ID
        let bestIndex = 0;
        let maxPriority = priorities[0];
        for (let i = 1; i < priorities.length; i++) {
          if (priorities[i] > maxPriority) {
            maxPriority = priorities[i];
            bestIndex = i;
          } else if (priorities[i] === maxPriority && ids[i] < ids[bestIndex]) {
            // 如果优先级相同，保留ID最小的（最早的）
            bestIndex = i;
          }
        }

        const keepId = ids[bestIndex];
        const deleteIds = ids.filter((id) => id !== keepId);

        if (deleteIds.length > 0) {
          const placeholders = deleteIds.map(() => '?').join(',');
          db.run(
            `DELETE FROM events WHERE id IN (${placeholders})`,
            deleteIds,
            function (err) {
              if (err) {
                console.error(`   ❌ 删除 IDs ${deleteIds.join(', ')} 失败:`, err);
              } else {
                stats.duplicatesRemoved += this.changes;
              }

              processed++;
              if (processed === rows.length) {
                finishUp();
              }
            }
          );
        } else {
          processed++;
          if (processed === rows.length) {
            finishUp();
          }
        }
      });
    }
  );

  function finishUp() {
    // 4. 统计最终数量
    setTimeout(() => {
      db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        if (err) {
          console.error('❌ 错误:', err);
          db.close();
          return;
        }

        stats.totalAfter = row.count;

        console.log('\n' + '='.repeat(50));
        console.log('✅ 去重完成！\n');
        console.log('📊 统计信息:');
        console.log(`   • 初始活动数: ${stats.totalBefore}`);
        console.log(`   • 删除无效活动: ${stats.invalidRemoved}`);
        console.log(`   • 删除重复活动: ${stats.duplicatesRemoved}`);
        console.log(`   • 最终活动数: ${stats.totalAfter}`);
        console.log(`   • 共删除: ${stats.totalBefore - stats.totalAfter}`);
        console.log('='.repeat(50));

        db.close((err) => {
          if (err) {
            console.error('❌ 关闭数据库失败:', err);
          }
        });
      });
    }, 500);
  }
});
