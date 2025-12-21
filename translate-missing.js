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

      // 3. 智能选择批次大小和延迟
      const translatorProvider = process.env.TRANSLATOR_PROVIDER || 'auto';
      let batchSize, delayMs;

      if (translatorProvider === 'gemini' || translatorProvider === 'auto') {
        // Gemini 免费版有严格的速率限制：15 RPM (requests per minute)
        // 使用更小的批次和更长的延迟
        batchSize = 5;   // 每批 5 个请求
        delayMs = 5000;  // 每批间隔 5 秒 (5*12 = 60秒，12批/分钟 = 60个请求/分钟，远低于限制)
        console.log('⚙️  检测到 Gemini 翻译服务，使用保守的速率限制策略');
        console.log(`   批次大小: ${batchSize} 个/批`);
        console.log(`   批次间隔: ${delayMs}ms (约 ${Math.round(60000 / (delayMs * batchSize))} 个请求/分钟)\n`);
      } else {
        // 其他服务通常有更宽松的限制
        batchSize = 10;
        delayMs = 1000;
        console.log(`⚙️  使用翻译服务: ${translatorProvider}`);
        console.log(`   批次大小: ${batchSize} 个/批, 间隔: ${delayMs}ms\n`);
      }

      // 4. 翻译标题（带智能重试）
      console.log('🌐 开始批量翻译...');
      const titles = missingEvents.map(e => e.title);
      const translationResults = await this.translateWithRetry(
        titles,
        batchSize,
        delayMs
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

  /**
   * 带智能重试的批量翻译
   * 如果遇到速率限制，会自动增加延迟并重试
   */
  async translateWithRetry(titles, batchSize, delayMs, maxRetries = 3) {
    let currentDelay = delayMs;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const results = await this.translator.translateBatch(
          titles,
          batchSize,
          currentDelay
        );

        // 检查是否有失败的翻译（可能是速率限制）
        const failedIndices = [];
        results.forEach((result, index) => {
          if (result.provider === 'failed') {
            failedIndices.push(index);
          }
        });

        if (failedIndices.length === 0) {
          // 全部成功
          return results;
        }

        if (attempt < maxRetries - 1) {
          // 还有重试机会，只重试失败的
          console.log(`\n⚠️  ${failedIndices.length} 个翻译失败，可能遇到速率限制`);
          console.log(`   增加延迟并重试 (尝试 ${attempt + 2}/${maxRetries})...`);

          // 指数退避：延迟翻倍
          currentDelay *= 2;
          console.log(`   新的批次间隔: ${currentDelay}ms\n`);

          // 只重试失败的项
          const failedTitles = failedIndices.map(i => titles[i]);
          const retryResults = await this.translator.translateBatch(
            failedTitles,
            Math.max(1, Math.floor(batchSize / 2)), // 减少批次大小
            currentDelay
          );

          // 合并结果
          retryResults.forEach((retryResult, i) => {
            const originalIndex = failedIndices[i];
            results[originalIndex] = retryResult;
          });

          return results;
        } else {
          // 最后一次尝试也失败了
          console.warn(`\n⚠️  经过 ${maxRetries} 次尝试，仍有 ${failedIndices.length} 个翻译失败`);
          return results;
        }
      } catch (error) {
        if (error.message.includes('429') || error.message.includes('quota') ||
            error.message.includes('RESOURCE_EXHAUSTED')) {
          attempt++;
          if (attempt < maxRetries) {
            currentDelay *= 2;
            console.log(`\n⚠️  遇到速率限制错误，等待 ${currentDelay}ms 后重试 (${attempt + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, currentDelay));
            continue;
          } else {
            console.error(`\n❌ 达到最大重试次数，部分翻译可能失败`);
            throw error;
          }
        } else {
          // 其他错误，直接抛出
          throw error;
        }
      }
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
  TRANSLATOR_PROVIDER=auto       # 翻译服务 (auto|newapi|gemini|openai|mistral|google)
  TURSO_DATABASE_URL=...         # Turso 数据库 URL
  TURSO_AUTH_TOKEN=...           # Turso 认证令牌
  NEWAPI_API_KEY=...             # NewAPI 密钥（需同时配置 MODEL）
  NEWAPI_BASE_URL=...            # NewAPI Base URL
  NEWAPI_MODEL=...               # NewAPI 模型名称（需同时配置 API_KEY）

示例:
  # 使用本地数据库，自动选择翻译服务
  node translate-missing.js

  # 使用 Turso 数据库
  USE_TURSO=1 node translate-missing.js

  # 指定使用 Gemini 翻译
  TRANSLATOR_PROVIDER=gemini node translate-missing.js

翻译优先级（auto 模式）:
  NewAPI → Gemini → OpenAI → Mistral → Google Translate

速率限制策略:
  - Gemini/auto 模式：5 个/批，批次间隔 5 秒，批次内延迟 200ms
    → 约 10 个请求/分钟（远低于 15 RPM 限制）
  - 其他服务：10 个/批，批次间隔 1 秒
  - 遇到速率限制时自动重试，延迟指数退避（最多 3 次）
  - 串行处理而非并行，精确控制请求速率
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
