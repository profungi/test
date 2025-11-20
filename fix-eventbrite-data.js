#!/usr/bin/env node

/**
 * 修复数据库中 Eventbrite 数据的格式问题：
 * 1. 地址格式：在城市前添加逗号
 * 2. Description：去掉开头的 "Overview"
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'events.db');

function fixAddress(address) {
  if (!address) return address;

  // 移除 "Get directions" 等干扰文本
  let addressText = address.replace(/Get directions.*$/i, '').trim();

  // 🔧 修复地址格式问题：
  // 问题1: 重复的街道地址 "266 14th St266 14th, StreetOakland"
  // 问题2: 逗号位置错误 "473, Valencia StreetSan Francisco"
  // 问题3: 城市前缺少逗号 "473 Valencia StreetSan Francisco"

  // 第一步：处理重复的街道地址
  // 匹配模式：场馆名/街道号 街道名1 街道号, 街道名2城市
  // 例如：266 14th St266 14th, StreetOakland -> 取第二部分
  addressText = addressText.replace(/^(.*?)(\d+)\s+([^,]+)\2\s*,?\s*(.*)$/, '$1$2 $4');

  // 第二步：移除街道号后的错误逗号
  // "1355, Market Street" -> "1355 Market Street"
  addressText = addressText.replace(/(\d+),\s+([A-Z])/g, '$1 $2');

  // 第三步：移除 #楼层 后的逗号
  // "#6th, Floor" -> "#6th Floor"
  addressText = addressText.replace(/#(\w+),\s+/g, '#$1 ');

  // 第四步：标准化格式为 "场馆/街道地址, 城市, 州 邮编"
  // 匹配：(前面部分包含街道号)(城市名大写开头), (州缩写) (邮编)
  const match = addressText.match(/^(.*?)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s+(\d{5})$/);

  if (match) {
    let streetPart = match[1].trim();
    const city = match[2].trim();
    const state = match[3].trim();
    const zip = match[4].trim();

    // 如果街道部分以句点结尾但后面没有空格，添加空格
    streetPart = streetPart.replace(/\.([A-Z])/, '. $1');

    // 确保街道部分末尾没有逗号
    if (streetPart.endsWith(',')) {
      streetPart = streetPart.slice(0, -1).trim();
    }

    return `${streetPart}, ${city}, ${state} ${zip}`;
  }

  // 备用：如果已经是正确格式（两个逗号），直接返回
  const correctFormat = addressText.match(/^(.*?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s+(\d{5})$/);
  if (correctFormat) {
    return addressText;
  }

  // 无法识别格式，返回原值
  return address;
}

function fixDescription(description) {
  if (!description) return description;

  // 去掉开头的 "Overview"（不区分大小写）
  return description.replace(/^overview\s*/i, '');
}

async function fixEventbriteData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      console.log('🔗 已连接到数据库:', DB_PATH);
      console.log('');

      // 查询所有 Eventbrite 事件
      db.all(
        'SELECT id, location, description FROM events WHERE source = ?',
        ['eventbrite'],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          console.log(`📊 找到 ${rows.length} 条 Eventbrite 记录`);
          console.log('');

          let addressFixed = 0;
          let descriptionFixed = 0;
          let errors = 0;

          // 开始事务
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            rows.forEach((row, index) => {
              const oldLocation = row.location;
              const oldDescription = row.description;

              const newLocation = fixAddress(oldLocation);
              const newDescription = fixDescription(oldDescription);

              let needsUpdate = false;
              const updates = [];
              const params = [];

              // 检查地址是否需要更新
              if (newLocation !== oldLocation) {
                updates.push('location = ?');
                params.push(newLocation);
                addressFixed++;
                needsUpdate = true;

                if (index < 3) {
                  // 只显示前3个示例
                  console.log(`📍 地址修复示例 #${index + 1}:`);
                  console.log(`   旧: ${oldLocation.substring(0, 100)}`);
                  console.log(`   新: ${newLocation.substring(0, 100)}`);
                  console.log('');
                }
              }

              // 检查描述是否需要更新
              if (newDescription !== oldDescription) {
                updates.push('description = ?');
                params.push(newDescription);
                descriptionFixed++;
                needsUpdate = true;

                if (index < 3) {
                  // 只显示前3个示例
                  console.log(`📝 描述修复示例 #${index + 1}:`);
                  console.log(`   旧: ${oldDescription.substring(0, 100)}...`);
                  console.log(`   新: ${newDescription.substring(0, 100)}...`);
                  console.log('');
                }
              }

              // 如果需要更新，执行UPDATE
              if (needsUpdate) {
                params.push(row.id);
                const sql = `UPDATE events SET ${updates.join(', ')} WHERE id = ?`;

                db.run(sql, params, (err) => {
                  if (err) {
                    console.error(`❌ 更新失败 (ID: ${row.id}):`, err.message);
                    errors++;
                  }
                });
              }
            });

            // 提交事务
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('❌ 提交事务失败:', err.message);
                db.run('ROLLBACK');
                reject(err);
                return;
              }

              console.log('✅ 修复完成！');
              console.log('');
              console.log('📊 统计：');
              console.log(`   总记录数: ${rows.length}`);
              console.log(`   地址已修复: ${addressFixed}`);
              console.log(`   描述已修复: ${descriptionFixed}`);
              console.log(`   错误数: ${errors}`);
              console.log('');

              db.close((err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve({
                    total: rows.length,
                    addressFixed,
                    descriptionFixed,
                    errors
                  });
                }
              });
            });
          });
        }
      );
    });
  });
}

// 运行修复
if (require.main === module) {
  console.log('🔧 开始修复 Eventbrite 数据格式...');
  console.log('');

  fixEventbriteData()
    .then((result) => {
      console.log('✨ 所有操作已完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 修复失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = fixEventbriteData;
