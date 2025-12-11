#!/usr/bin/env node

/**
 * 同步数据库：更新 events 和 event_performance 表的数据格式
 * 1. 更新地址格式：所有部分用逗号分隔
 * 2. 去掉 description 开头的 "Overview"
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'events.db');

// 地址修复函数 - 使用与爬虫相同的逻辑
function fixEventbriteAddress(address) {
  if (!address) return address;

  // 移除 "Get directions" 等干扰文本
  let cleaned = address.replace(/Get directions.*$/i, '').trim();

  // 如果地址已经有2个或更多逗号，可能已经是正确格式
  const commaCount = (cleaned.match(/,/g) || []).length;
  if (commaCount >= 2) {
    return cleaned;
  }

  // 在字母和数字之间添加逗号+空格
  // "AC Kitchen at AC Hotel San Jose350" -> "AC Kitchen at AC Hotel San Jose, 350"
  cleaned = cleaned.replace(/([a-zA-Z])(\d+)/g, '$1, $2');

  // 移除门牌号后错误的逗号："350, West" -> "350 West"
  cleaned = cleaned.replace(/(\d+),\s+([A-Z][a-z])/g, '$1 $2');

  return cleaned;
}

function fixDescription(description) {
  if (!description) return description;

  // 去掉开头的 "Overview"（不区分大小写）
  return description.replace(/^overview\s*/i, '');
}

async function syncDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      console.log('🔗 已连接到数据库:', DB_PATH);
      console.log('');

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // ========== 更新 events 表 ==========
        console.log('📊 更新 events 表...\n');

        db.all(
          'SELECT id, location, description, description_detail, source FROM events WHERE source = ?',
          ['eventbrite'],
          (err, rows) => {
            if (err) {
              console.error('❌ 查询 events 失败:', err);
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            console.log(`   找到 ${rows.length} 条 Eventbrite 记录\n`);

            let eventsLocationFixed = 0;
            let eventsDescFixed = 0;
            let eventsDescDetailFixed = 0;
            let eventsProcessed = 0;

            rows.forEach((row, index) => {
              const newLocation = fixEventbriteAddress(row.location);
              const newDescription = fixDescription(row.description);
              const newDescriptionDetail = fixDescription(row.description_detail);

              let needsUpdate = false;
              const updates = [];
              const params = [];

              if (newLocation !== row.location) {
                updates.push('location = ?');
                params.push(newLocation);
                eventsLocationFixed++;
                needsUpdate = true;

                if (index < 3) {
                  console.log(`   📍 地址修复示例 #${index + 1}:`);
                  console.log(`      旧: ${row.location.substring(0, 80)}...`);
                  console.log(`      新: ${newLocation.substring(0, 80)}...`);
                  console.log('');
                }
              }

              if (newDescription !== row.description) {
                updates.push('description = ?');
                params.push(newDescription);
                eventsDescFixed++;
                needsUpdate = true;
              }

              if (newDescriptionDetail !== row.description_detail) {
                updates.push('description_detail = ?');
                params.push(newDescriptionDetail);
                eventsDescDetailFixed++;
                needsUpdate = true;

                if (index < 3 && newDescriptionDetail) {
                  console.log(`   📝 描述详情修复示例 #${index + 1}:`);
                  console.log(`      旧: ${row.description_detail ? row.description_detail.substring(0, 60) : 'null'}...`);
                  console.log(`      新: ${newDescriptionDetail.substring(0, 60)}...`);
                  console.log('');
                }
              }

              if (needsUpdate) {
                params.push(row.id);
                const sql = `UPDATE events SET ${updates.join(', ')} WHERE id = ?`;

                db.run(sql, params, (err) => {
                  if (err) {
                    console.error(`   ❌ 更新失败 (ID: ${row.id}):`, err.message);
                  }
                });
              }

              eventsProcessed++;
            });

            console.log(`   ✅ events 表处理完成`);
            console.log(`      处理记录: ${eventsProcessed}`);
            console.log(`      地址修复: ${eventsLocationFixed}`);
            console.log(`      description 修复: ${eventsDescFixed}`);
            console.log(`      description_detail 修复: ${eventsDescDetailFixed}\n`);

            // ========== 更新 event_performance 表 ==========
            console.log('📊 更新 event_performance 表...\n');

            db.all(
              'SELECT id, location, source_website FROM event_performance WHERE source_website LIKE ?',
              ['%eventbrite%'],
              (err, perfRows) => {
                if (err) {
                  console.error('❌ 查询 event_performance 失败:', err);
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                console.log(`   找到 ${perfRows.length} 条 Eventbrite 记录\n`);

                let perfLocationFixed = 0;
                let perfProcessed = 0;

                perfRows.forEach((row, index) => {
                  const newLocation = fixEventbriteAddress(row.location);

                  if (newLocation !== row.location) {
                    db.run(
                      'UPDATE event_performance SET location = ? WHERE id = ?',
                      [newLocation, row.id],
                      (err) => {
                        if (err) {
                          console.error(`   ❌ 更新失败 (ID: ${row.id}):`, err.message);
                        }
                      }
                    );

                    perfLocationFixed++;

                    if (index < 3) {
                      console.log(`   📍 地址修复示例 #${index + 1}:`);
                      console.log(`      旧: ${row.location ? row.location.substring(0, 80) : 'null'}...`);
                      console.log(`      新: ${newLocation.substring(0, 80)}...`);
                      console.log('');
                    }
                  }

                  perfProcessed++;
                });

                console.log(`   ✅ event_performance 表处理完成`);
                console.log(`      处理记录: ${perfProcessed}`);
                console.log(`      地址修复: ${perfLocationFixed}\n`);

                // ========== 提交事务 ==========
                db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('❌ 提交事务失败:', err.message);
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }

                  console.log('═'.repeat(60));
                  console.log('✅ 数据库同步完成！');
                  console.log('═'.repeat(60));
                  console.log('');
                  console.log('📊 总计：');
                  console.log(`   events 表:`);
                  console.log(`     - 处理: ${eventsProcessed} 条`);
                  console.log(`     - 地址修复: ${eventsLocationFixed} 条`);
                  console.log(`     - description 修复: ${eventsDescFixed} 条`);
                  console.log(`     - description_detail 修复: ${eventsDescDetailFixed} 条`);
                  console.log('');
                  console.log(`   event_performance 表:`);
                  console.log(`     - 处理: ${perfProcessed} 条`);
                  console.log(`     - 地址修复: ${perfLocationFixed} 条`);
                  console.log('');

                  db.close((err) => {
                    if (err) {
                      reject(err);
                    } else {
                      resolve({
                        events: {
                          processed: eventsProcessed,
                          locationFixed: eventsLocationFixed,
                          descFixed: eventsDescFixed,
                          descDetailFixed: eventsDescDetailFixed
                        },
                        performance: {
                          processed: perfProcessed,
                          locationFixed: perfLocationFixed
                        }
                      });
                    }
                  });
                });
              }
            );
          }
        );
      });
    });
  });
}

// 运行同步
if (require.main === module) {
  console.log('🔧 开始同步数据库...');
  console.log('');

  syncDatabase()
    .then((result) => {
      console.log('✨ 所有操作已完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 同步失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = syncDatabase;
