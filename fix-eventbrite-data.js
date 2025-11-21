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

  // 🔧 完全重写地址格式修复逻辑
  // 原始格式示例：
  // "SAP Center525, West Santa Clara StreetSan Jose, CA 95113"
  // "Santa Clara Convention Center5001, Great America ParkwaySanta Clara, CA 95054"
  // "Wildseed855 El Camino Real#Building 4, Palo Alto, CA 94301"

  // 目标格式：
  // "SAP Center 525 West Santa Clara Street, San Jose, CA 95113"
  // "Santa Clara Convention Center 5001 Great America Parkway, Santa Clara, CA 95054"
  // "Wildseed 855 El Camino Real #Building 4, Palo Alto, CA 94301"

  // 步骤1：移除所有不必要的逗号（门牌号后的逗号、#后的逗号等）
  // 保留城市和州之间的逗号
  let cleaned = addressText;

  // 移除门牌号后的逗号：将 "525," 改为 "525"
  cleaned = cleaned.replace(/(\d+),\s+/g, '$1 ');

  // 移除 # 后的逗号：将 "#Building 4," 改为 "#Building 4"
  cleaned = cleaned.replace(/#([^,]+),\s+/g, '#$1 ');

  // 步骤2：在场馆名和门牌号之间添加空格（如果缺失）
  // "SAP Center525" -> "SAP Center 525"
  cleaned = cleaned.replace(/([a-zA-Z])(\d+)/g, '$1 $2');

  // 步骤3：确保城市名前有逗号和空格
  // 已知的湾区城市名列表（包括多词城市名）
  const cities = [
    'San Francisco',
    'San Jose',
    'Oakland',
    'Berkeley',
    'Palo Alto',
    'East Palo Alto',
    'Santa Clara',
    'Sunnyvale',
    'Mountain View',
    'Redwood City',
    'San Mateo',
    'Fremont',
    'Hayward',
    'San Leandro',
    'Alameda',
    'Richmond',
    'Concord',
    'Walnut Creek',
    'Saratoga',
    'Los Gatos',
    'Cupertino',
    'Milpitas',
    'San Carlos',
    'Menlo Park',
    'Burlingame',
    'San Bruno',
    'South San Francisco',
    'Daly City',
    'Pacifica',
    'Half Moon Bay'
  ];

  // 尝试匹配已知城市
  for (const city of cities) {
    // 匹配格式：(前面的地址部分)(城市名), (州) (邮编)
    const regex = new RegExp(`^(.+?)(${city}),\\s*([A-Z]{2})\\s+(\\d{5})$`);
    const match = cleaned.match(regex);

    if (match) {
      let addressPart = match[1].trim();
      const cityName = match[2].trim();
      const state = match[3].trim();
      const zip = match[4].trim();

      // 返回标准格式
      return `${addressPart}, ${cityName}, ${state} ${zip}`;
    }
  }

  // 备用：如果已经是正确格式（有两个逗号），直接返回
  if (cleaned.match(/^.+?,\s*.+?,\s*[A-Z]{2}\s+\d{5}$/)) {
    return cleaned;
  }

  // 如果无法识别，返回清理后的版本
  return cleaned || address;
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
