#!/usr/bin/env node

/**
 * 批量生成活动摘要脚本
 * 为数据库中已存在的活动生成中英文 AI 摘要
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');
const Summarizer = require('./src/utils/summarizer');

class ExistingSummarizer {
  constructor() {
    // 初始化 Turso 客户端
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
    }

    this.client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    this.summarizer = new Summarizer();
  }

  /**
   * 获取本周和下周的周标识符
   */
  getWeekIdentifiers() {
    const now = new Date();
    const day = now.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;

    // 本周一
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - daysFromMonday);
    thisMonday.setHours(0, 0, 0, 0);

    // 本周日
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);

    // 下周一
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);

    // 下周日
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      current: `${formatDate(thisMonday)}_to_${formatDate(thisSunday)}`,
      next: `${formatDate(nextMonday)}_to_${formatDate(nextSunday)}`,
    };
  }

  /**
   * 获取需要生成摘要的活动
   */
  async getEventsNeedingSummary(weekIdentifiers) {
    const sql = `
      SELECT id, title, description, event_type, summary_en, summary_zh
      FROM events
      WHERE week_identifier IN (?, ?)
        AND description IS NOT NULL
        AND LENGTH(description) > 10
        AND (summary_en IS NULL OR summary_en = '' OR summary_zh IS NULL OR summary_zh = '')
      ORDER BY id ASC
    `;

    const result = await this.client.execute({
      sql,
      args: [weekIdentifiers.current, weekIdentifiers.next],
    });

    return result.rows;
  }

  /**
   * 更新单个活动的摘要
   */
  async updateEventSummary(id, summaryEn, summaryZh) {
    const sql = `
      UPDATE events
      SET summary_en = ?, summary_zh = ?
      WHERE id = ?
    `;

    await this.client.execute({
      sql,
      args: [summaryEn, summaryZh, id],
    });
  }

  /**
   * 批量生成摘要
   */
  async run() {
    console.log('='.repeat(60));
    console.log('  批量生成活动摘要');
    console.log('='.repeat(60) + '\n');

    const weeks = this.getWeekIdentifiers();
    console.log(`📅 本周: ${weeks.current}`);
    console.log(`📅 下周: ${weeks.next}\n`);

    // 获取需要处理的活动
    const events = await this.getEventsNeedingSummary(weeks);

    if (events.length === 0) {
      console.log('✨ 所有活动都已有摘要，无需处理！');
      return;
    }

    console.log(`📊 找到 ${events.length} 个需要生成摘要的活动\n`);

    const stats = {
      newapi: 0,
      gemini: 0,
      mistral: 0,
      skipped: 0,
      failed: 0,
    };

    const batchSize = 5;
    const delayMs = 2000;

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(events.length / batchSize);

      console.log(`\n📦 批次 ${batchNum}/${totalBatches}: 处理 ${batch.length} 个活动...`);

      for (let j = 0; j < batch.length; j++) {
        const event = batch[j];
        const globalIndex = i + j + 1;

        try {
          const summary = await this.summarizer.summarize(
            event.title,
            event.description,
            event.event_type
          );

          if (summary) {
            await this.updateEventSummary(event.id, summary.en, summary.zh);

            const providerIcon = {
              newapi: '🔷',
              gemini: '🔮',
              mistral: '🌪️',
            }[summary.provider] || '❓';

            console.log(`  ${providerIcon} [${globalIndex}/${events.length}] ID ${event.id}: ${event.title.substring(0, 35)}...`);
            console.log(`     EN: ${summary.en.substring(0, 60)}...`);
            console.log(`     ZH: ${summary.zh}`);

            stats[summary.provider]++;
          } else {
            console.log(`  ⏭️  [${globalIndex}/${events.length}] ID ${event.id}: 跳过（无法生成摘要）`);
            stats.skipped++;
          }

          // 批次内延迟
          if (j < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`  ❌ [${globalIndex}/${events.length}] ID ${event.id}: 失败 - ${error.message}`);
          stats.failed++;
        }
      }

      // 批次间延迟
      if (i + batchSize < events.length) {
        console.log(`  ⏳ 等待 ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // 显示统计
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✨ 摘要生成完成！\n`);
    console.log(`📊 统计:`);
    console.log(`   总计: ${events.length} 个活动`);
    if (stats.newapi > 0) console.log(`   🔷 NewAPI: ${stats.newapi}`);
    if (stats.gemini > 0) console.log(`   🔮 Gemini: ${stats.gemini}`);
    if (stats.mistral > 0) console.log(`   🌪️  Mistral: ${stats.mistral}`);
    if (stats.skipped > 0) console.log(`   ⏭️  跳过: ${stats.skipped}`);
    if (stats.failed > 0) console.log(`   ❌ 失败: ${stats.failed}`);
    console.log(`${'='.repeat(60)}\n`);

    if (stats.failed > 0) {
      console.log('⚠️  部分活动摘要生成失败，可以重新运行此脚本来重试');
    }

    console.log('💡 提示：运行 npm run sync-from-turso 将数据同步到本地');
  }

  /**
   * 显示帮助信息
   */
  static showHelp() {
    console.log(`
📝 批量生成活动摘要

用法:
  node generate-summaries.js          # 为本周和下周活动生成摘要
  node generate-summaries.js --help   # 显示帮助

环境变量:
  TURSO_DATABASE_URL    Turso 数据库 URL
  TURSO_AUTH_TOKEN      Turso 认证 Token
  NEWAPI_API_KEY        NewAPI 密钥（优先使用）
  NEWAPI_BASE_URL       NewAPI Base URL
  NEWAPI_MODEL          NewAPI 模型名称
  GEMINI_API_KEY        Gemini API 密钥（备选）
  MISTRAL_API_KEY       Mistral API 密钥（备选）

说明:
  此脚本会为本周和下周所有有描述但没有摘要的活动生成中英文摘要。
  摘要会直接写入 Turso 数据库。
  完成后可运行 npm run sync-from-turso 同步到本地。
`);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    ExistingSummarizer.showHelp();
    return;
  }

  try {
    const summarizer = new ExistingSummarizer();
    await summarizer.run();
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    process.exit(1);
  }
}

main();
