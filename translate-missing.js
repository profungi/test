#!/usr/bin/env node

/**
 * 翻译数据库中缺失中文翻译的活动标题
 * 支持本地 SQLite 和 Turso 数据库
 */

require('dotenv').config();

// 根据环境变量选择数据库
const EventDatabase = process.env.USE_TURSO
  ? require('./src/utils/turso-database')
  : require('./src/utils/database');

const Translator = require('./src/utils/translator');

class MissingTranslationFixer {
  constructor() {
    this.database = new EventDatabase();
    const translatorProvider = process.env.TRANSLATOR_PROVIDER || 'auto';
    this.translator = new Translator(translatorProvider);
  }

  async run() {
    const dbType = process.env.USE_TURSO ? 'Turso 云数据库' : '本地 SQLite';
    console.log(`🌐 开始翻译缺失的中文标题...`);
    console.log(`💾 数据库: ${dbType}\n`);

    try {
      // 1. 连接数据库
      await this.database.connect();

      // 2. 查找所有缺失中文翻译的活动
      const missingEvents = await this.getMissingTranslations();

      if (missingEvents.length === 0) {
        console.log('✅ 所有活动都已有中文翻译！');
        await this.database.close();
        return;
      }

      console.log(`📊 发现 ${missingEvents.length} 个活动缺失中文翻译\n`);

      // 3. 翻译标题
      console.log('🌐 开始批量翻译...');
      const titles = missingEvents.map(e => e.title);
      const translationResults = await this.translator.translateBatch(
        titles,
        10,   // 每批 10 个
        1000  // 每批间隔 1 秒
      );

      // 4. 更新数据库
      console.log('\n💾 更新数据库...');
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < missingEvents.length; i++) {
        const event = missingEvents[i];
        const translation = translationResults[i];

        if (translation.provider !== 'failed') {
          try {
            await this.updateTranslation(event.id, translation.text);
            successCount++;
            console.log(`  ✅ [${i + 1}/${missingEvents.length}] ${event.title} → ${translation.text}`);
          } catch (error) {
            failCount++;
            console.error(`  ❌ [${i + 1}/${missingEvents.length}] 更新失败: ${event.title} - ${error.message}`);
          }
        } else {
          failCount++;
          console.error(`  ❌ [${i + 1}/${missingEvents.length}] 翻译失败: ${event.title}`);
        }
      }

      // 5. 显示统计
      console.log('\n' + '='.repeat(60));
      console.log('✨ 翻译完成！\n');
      console.log(`📊 统计:`);
      console.log(`   总计: ${missingEvents.length} 个活动`);
      console.log(`   ✅ 成功: ${successCount}`);
      if (failCount > 0) {
        console.log(`   ❌ 失败: ${failCount}`);
      }
      console.log('='.repeat(60) + '\n');

      await this.database.close();

    } catch (error) {
      console.error('❌ 翻译过程中发生错误:', error.message);
      console.error(error.stack);
      await this.database.close();
      process.exit(1);
    }
  }

  async getMissingTranslations() {
    // 检查是否使用 Turso
    if (process.env.USE_TURSO) {
      const result = await this.database.client.execute({
        sql: `
          SELECT id, title
          FROM events
          WHERE title_zh IS NULL OR title_zh = ''
          ORDER BY scraped_at DESC
        `,
        args: []
      });
      return result.rows.map(row => ({
        id: row.id,
        title: row.title
      }));
    } else {
      // 本地 SQLite
      return new Promise((resolve, reject) => {
        const query = `
          SELECT id, title
          FROM events
          WHERE title_zh IS NULL OR title_zh = ''
          ORDER BY scraped_at DESC
        `;

        this.database.db.all(query, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    }
  }

  async updateTranslation(eventId, titleZh) {
    // 检查是否使用 Turso
    if (process.env.USE_TURSO) {
      await this.database.client.execute({
        sql: `UPDATE events SET title_zh = ? WHERE id = ?`,
        args: [titleZh, eventId]
      });
      return { updated: true };
    } else {
      // 本地 SQLite
      return new Promise((resolve, reject) => {
        const query = `
          UPDATE events
          SET title_zh = ?
          WHERE id = ?
        `;

        this.database.db.run(query, [titleZh, eventId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ updated: this.changes > 0 });
          }
        });
      });
    }
  }

  static showHelp() {
    console.log(`
🌐 Missing Translation Fixer

用法:
  node translate-missing.js              # 翻译本地 SQLite 数据库中缺失的翻译
  USE_TURSO=1 node translate-missing.js  # 翻译 Turso 数据库中缺失的翻译

环境变量:
  USE_TURSO=1                    # 使用 Turso 数据库（默认使用本地 SQLite）
  TRANSLATOR_PROVIDER=auto       # 翻译服务 (auto|gemini|openai|mistral|google)
  TURSO_DATABASE_URL=...         # Turso 数据库 URL
  TURSO_AUTH_TOKEN=...           # Turso 认证令牌

示例:
  # 使用本地数据库，自动选择翻译服务
  node translate-missing.js

  # 使用 Turso 数据库
  USE_TURSO=1 node translate-missing.js

  # 指定使用 Gemini 翻译
  TRANSLATOR_PROVIDER=gemini node translate-missing.js
`);
  }
}

// 解析命令行参数
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  MissingTranslationFixer.showHelp();
  process.exit(0);
}

// 运行翻译修复
const fixer = new MissingTranslationFixer();
fixer.run().catch(err => {
  console.error('❌ 执行失败:', err);
  process.exit(1);
});
