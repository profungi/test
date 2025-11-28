#!/usr/bin/env node

/**
 * 清理数据库中 title_zh 为英文的记录
 * 这些记录需要重新翻译
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'events.db');

// 检查字符串是否主要包含中文字符
function hasChinese(text) {
  if (!text) return false;

  // 计算中文字符数量
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  const chineseCount = chineseChars ? chineseChars.length : 0;

  // 如果中文字符少于3个，认为是英文
  return chineseCount >= 3;
}

async function cleanEnglishTranslations() {
  console.log('🔍 开始检查和清理英文翻译...\n');

  const db = new sqlite3.Database(dbPath);

  // 1. 获取所有有 title_zh 的记录
  const query = `
    SELECT id, title, title_zh
    FROM events
    WHERE title_zh IS NOT NULL AND title_zh <> ''
    ORDER BY id ASC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('❌ 查询错误:', err);
      db.close();
      return;
    }

    console.log(`📋 找到 ${rows.length} 个已翻译的记录\n`);

    let englishCount = 0;
    let chineseCount = 0;
    const toClean = [];

    // 2. 检查每条记录
    rows.forEach(row => {
      const isChinese = hasChinese(row.title_zh);

      if (!isChinese) {
        englishCount++;
        toClean.push(row.id);
        console.log(`❌ ID ${row.id}: ${row.title_zh.substring(0, 60)}...`);
      } else {
        chineseCount++;
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 统计结果:');
    console.log(`   总计: ${rows.length} 条记录`);
    console.log(`   ✅ 中文翻译: ${chineseCount} 条`);
    console.log(`   ❌ 英文翻译: ${englishCount} 条`);
    console.log('='.repeat(60) + '\n');

    if (toClean.length === 0) {
      console.log('✨ 所有翻译都是中文，无需清理！');
      db.close();
      return;
    }

    // 3. 清理英文翻译
    console.log(`🧹 开始清理 ${toClean.length} 条英文翻译...\n`);

    const placeholders = toClean.map(() => '?').join(',');
    const updateQuery = `
      UPDATE events
      SET title_zh = NULL
      WHERE id IN (${placeholders})
    `;

    db.run(updateQuery, toClean, function(err) {
      if (err) {
        console.error('❌ 更新错误:', err);
      } else {
        console.log(`✅ 成功清理 ${this.changes} 条记录\n`);
        console.log('这些记录现在可以重新翻译了：');
        console.log(`  运行: npm run translate-existing\n`);
      }

      db.close();
    });
  });
}

cleanEnglishTranslations().catch(console.error);
