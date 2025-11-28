#!/usr/bin/env node

/**
 * 翻译历史活动标题脚本
 * 为数据库中已存在的活动添加中文标题翻译
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const Translator = require('./src/utils/translator');

class ExistingEventTranslator {
  constructor() {
    this.dbPath = path.join(__dirname, 'data', 'events.db');
    this.db = null;

    // 从环境变量或命令行参数获取翻译服务提供商
    const args = process.argv.slice(2);
    const providerIndex = args.indexOf('--provider');
    const provider = providerIndex !== -1 && args[providerIndex + 1]
      ? args[providerIndex + 1]
      : process.env.TRANSLATOR_PROVIDER || 'auto';

    this.translator = new Translator(provider);
    if (provider === 'auto') {
      console.log(`🌐 使用自动翻译模式 (优先级: Gemini → OpenAI → Mistral → Google)`);
    } else {
      console.log(`🌐 使用指定翻译服务: ${provider}`);
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ 已连接到数据库');
          resolve();
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            console.log('✅ 数据库连接已关闭');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 获取所有需要翻译的活动（title_zh 为空或 NULL）
   */
  async getEventsNeedingTranslation() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, title, title_zh
        FROM events
        WHERE title_zh IS NULL OR title_zh = ''
        ORDER BY id ASC
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * 更新单个活动的中文标题
   */
  async updateEventTitle(id, titleZh) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE events
        SET title_zh = ?
        WHERE id = ?
      `;

      this.db.run(query, [titleZh, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ updated: this.changes > 0 });
        }
      });
    });
  }

  /**
   * 批量翻译并更新活动
   */
  async translateAndUpdate(events, batchSize = 10, delayMs = 1000) {
    const total = events.length;
    let successCount = 0;
    let failCount = 0;
    const providerStats = {
      gemini: 0,
      openai: 0,
      mistral: 0,
      google: 0,
      skipped: 0,
      failed: 0,
    };

    console.log(`\n📊 待翻译活动总数: ${total}\n`);

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(events.length / batchSize);

      console.log(`\n📦 批次 ${batchNum}/${totalBatches}: 处理 ${batch.length} 个活动...`);

      // 翻译当前批次
      const translations = await Promise.allSettled(
        batch.map(async (event, index) => {
          const globalIndex = i + index + 1;

          try {
            // 翻译标题（返回 {text, provider}）
            const result = await this.translator.translate(event.title);
            const titleZh = result.text;
            const provider = result.provider;

            // 更新数据库
            await this.updateEventTitle(event.id, titleZh);

            // 服务图标
            const providerIcon = {
              gemini: '🔮',
              openai: '🤖',
              mistral: '🌪️',
              google: '🌐',
              skipped: '⏭️',
              failed: '❌',
            }[provider] || '❓';

            console.log(`  ${providerIcon} [${globalIndex}/${total}] ID ${event.id}: ${event.title.substring(0, 40)}... → ${titleZh.substring(0, 30)}... (${provider})`);

            return { success: true, id: event.id, titleZh, provider };
          } catch (error) {
            console.error(`  ✗ [${globalIndex}/${total}] ID ${event.id} 翻译失败: ${error.message}`);
            return { success: false, id: event.id, error: error.message };
          }
        })
      );

      // 统计结果
      translations.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
          const provider = result.value.provider || 'unknown';
          if (providerStats.hasOwnProperty(provider)) {
            providerStats[provider]++;
          }
        } else {
          failCount++;
          providerStats.failed++;
        }
      });

      // 显示进度
      const progress = Math.round((i + batch.length) / total * 100);
      console.log(`\n  进度: ${i + batch.length}/${total} (${progress}%)`);
      console.log(`  成功: ${successCount} | 失败: ${failCount}`);

      // 如果不是最后一批，延迟避免速率限制
      if (i + batchSize < events.length) {
        console.log(`  ⏳ 等待 ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { total, successCount, failCount, providerStats };
  }

  /**
   * 主执行函数
   */
  async run() {
    console.log('🚀 开始翻译历史活动标题...\n');

    try {
      // 1. 连接数据库
      await this.connect();

      // 2. 获取需要翻译的活动
      const events = await this.getEventsNeedingTranslation();

      if (events.length === 0) {
        console.log('✨ 所有活动标题都已翻译完成！');
        return;
      }

      console.log(`📋 找到 ${events.length} 个需要翻译的活动`);

      // 3. 批量翻译并更新
      // 根据翻译服务提供商调整批次大小和间隔
      let batchSize, delayMs;

      const provider = this.translator.provider;
      if (provider === 'gemini') {
        // Gemini 免费层：每分钟最多 10 个请求
        // 使用保守策略：每批 2 个，间隔 15 秒
        batchSize = 2;
        delayMs = 15000;
        console.log('⚠️  使用 Gemini 服务，应用速率限制保护（每批2个，间隔15秒）');
      } else if (provider === 'auto') {
        // 自动模式：优先使用 Gemini，但用小批次避免速率限制
        // 如果 Gemini 失败，自动回退到 OpenAI → Mistral → Google
        batchSize = 3;
        delayMs = 10000;
        console.log('⚙️  自动回退模式：优先 Gemini（每批3个，间隔10秒）');
        console.log('    失败时自动切换: Gemini → OpenAI → Mistral → Google');
      } else if (provider === 'google') {
        // Google Translate：无速率限制
        batchSize = 10;
        delayMs = 1000;
        console.log('✅ 使用 Google Translate（无速率限制）');
      } else {
        // OpenAI/Mistral：适中的限制
        batchSize = 5;
        delayMs = 5000;
      }

      const result = await this.translateAndUpdate(events, batchSize, delayMs);

      // 4. 输出最终报告
      console.log('\n' + '='.repeat(60));
      console.log('✨ 翻译完成！\n');
      console.log(`📊 最终统计:`);
      console.log(`   总计: ${result.total} 个活动`);
      console.log(`   成功: ${result.successCount} 个 (${Math.round(result.successCount / result.total * 100)}%)`);
      console.log(`   失败: ${result.failCount} 个 (${Math.round(result.failCount / result.total * 100)}%)`);

      // 显示每个服务的使用情况
      if (result.providerStats) {
        console.log(`\n📊 翻译服务使用情况:`);
        if (result.providerStats.gemini > 0) console.log(`   🔮 Gemini: ${result.providerStats.gemini} (${Math.round(result.providerStats.gemini / result.total * 100)}%)`);
        if (result.providerStats.openai > 0) console.log(`   🤖 OpenAI: ${result.providerStats.openai} (${Math.round(result.providerStats.openai / result.total * 100)}%)`);
        if (result.providerStats.mistral > 0) console.log(`   🌪️  Mistral: ${result.providerStats.mistral} (${Math.round(result.providerStats.mistral / result.total * 100)}%)`);
        if (result.providerStats.google > 0) console.log(`   🌐 Google: ${result.providerStats.google} (${Math.round(result.providerStats.google / result.total * 100)}%)`);
        if (result.providerStats.skipped > 0) console.log(`   ⏭️  跳过: ${result.providerStats.skipped} (已含中文)`);
      }
      console.log('='.repeat(60) + '\n');

      if (result.failCount > 0) {
        console.log('⚠️  部分活动翻译失败，可以重新运行此脚本来重试');
      }

    } catch (error) {
      console.error('\n❌ 发生错误:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await this.close();
    }
  }

  /**
   * 显示帮助信息
   */
  static showHelp() {
    console.log(`
🌐 翻译历史活动标题

用法:
  node translate-existing-events.js [选项]

选项:
  --provider <provider>   指定翻译服务 (auto | gemini | openai | mistral | google)
                         默认: auto (自动按优先级回退)

  --help, -h             显示帮助信息

示例:
  node translate-existing-events.js                    # 自动模式
  node translate-existing-events.js --provider gemini  # 只用 Gemini
  node translate-existing-events.js --provider openai  # 只用 OpenAI
  node translate-existing-events.js --provider google  # 只用 Google

环境变量:
  TRANSLATOR_PROVIDER       默认翻译服务提供商 (默认: auto)
  GEMINI_API_KEY           Google Gemini API 密钥
  OPENAI_API_KEY           OpenAI API 密钥
  MISTRAL_API_KEY          Mistral AI API 密钥
  GOOGLE_TRANSLATE_API_KEY Google Translate API 密钥（可选）

翻译优先级（auto 模式）:
  1. Gemini (免费额度大，质量好)
  2. OpenAI (质量最好，便宜)
  3. Mistral (性价比高)
  4. Google Translate (免费兜底)

说明:
  此脚本会翻译数据库中所有 title_zh 字段为空的活动标题。
  使用 auto 模式时，会按优先级尝试所有可用服务，一个失败自动切换到下一个。
  翻译完成后，网站前端会自动显示中文标题。
`);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  // 显示帮助
  if (args.includes('--help') || args.includes('-h')) {
    ExistingEventTranslator.showHelp();
    return;
  }

  // 运行翻译
  const translator = new ExistingEventTranslator();
  await translator.run();
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ExistingEventTranslator;
