#!/usr/bin/env node

/**
 * 修复数据库中包含THOUGHT错误的翻译
 * 修复ID 420和459的错误翻译
 */

require('dotenv').config();

const EventDatabase = process.env.USE_TURSO
  ? require('./src/utils/turso-database')
  : require('./src/utils/database');

async function fixTranslations() {
  const dbType = process.env.USE_TURSO ? 'Turso 云数据库' : '本地 SQLite';
  console.log(`🔧 开始修复错误的翻译...`);
  console.log(`💾 数据库: ${dbType}\n`);

  const database = new EventDatabase();

  try {
    await database.connect();

    // 修复的翻译映射
    const fixes = [
      {
        id: 420,
        title: 'The Guardsmen Tree Lot',
        correct_zh: '卫士圣诞树场'
      },
      {
        id: 459,
        title: 'Family Holiday Party & Open House!',
        correct_zh: '家庭假日派对和开放日！'
      }
    ];

    console.log(`📝 准备修复 ${fixes.length} 条记录:\n`);

    for (const fix of fixes) {
      console.log(`正在修复 ID ${fix.id}: "${fix.title}"`);

      // 检查当前翻译
      let currentTranslation;
      if (process.env.USE_TURSO) {
        const result = await database.client.execute({
          sql: 'SELECT title_zh FROM events WHERE id = ?',
          args: [fix.id]
        });
        currentTranslation = result.rows[0]?.title_zh;
      } else {
        currentTranslation = await new Promise((resolve, reject) => {
          database.db.get(
            'SELECT title_zh FROM events WHERE id = ?',
            [fix.id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row?.title_zh);
            }
          );
        });
      }

      if (!currentTranslation) {
        console.log(`  ⚠️  ID ${fix.id} 不存在，跳过`);
        continue;
      }

      const hasError = currentTranslation.includes('THOUGHT');
      const needsFix = hasError || currentTranslation.length > 200;

      if (needsFix) {
        console.log(`  ❌ 发现错误翻译 (长度: ${currentTranslation.length} 字符)`);
        console.log(`  ✅ 更新为: "${fix.correct_zh}"`);

        // 更新翻译
        if (process.env.USE_TURSO) {
          await database.client.execute({
            sql: 'UPDATE events SET title_zh = ? WHERE id = ?',
            args: [fix.correct_zh, fix.id]
          });
        } else {
          await new Promise((resolve, reject) => {
            database.db.run(
              'UPDATE events SET title_zh = ? WHERE id = ?',
              [fix.correct_zh, fix.id],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        console.log(`  ✓ 已修复\n`);
      } else {
        console.log(`  ✓ 翻译正常，无需修复\n`);
      }
    }

    console.log('='.repeat(60));
    console.log('✨ 修复完成！\n');

    await database.close();

  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error.message);
    console.error(error.stack);
    await database.close();
    process.exit(1);
  }
}

// 运行修复
fixTranslations().catch(err => {
  console.error('❌ 执行失败:', err);
  process.exit(1);
});
