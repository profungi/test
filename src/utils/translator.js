/**
 * 翻译服务模块
 * 支持多种翻译服务：Google Translate API 和 OpenAI
 */

const axios = require('axios');
const OpenAI = require('openai');

class Translator {
  constructor(provider = 'google') {
    this.provider = provider;

    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY 未设置，请在 .env 文件中配置');
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else if (provider === 'google') {
      if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
        console.warn('⚠️  警告: GOOGLE_TRANSLATE_API_KEY 未设置，将使用免费的翻译服务');
      }
    }
  }

  /**
   * 使用 Google Translate API 翻译
   * @param {string} text - 要翻译的文本
   * @returns {Promise<string>} 翻译后的文本
   */
  async translateWithGoogle(text) {
    try {
      const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

      if (!apiKey) {
        // 如果没有 API Key，使用免费的 Google Translate（通过非官方接口）
        return await this.translateWithGoogleFree(text);
      }

      const url = 'https://translation.googleapis.com/language/translate/v2';
      const response = await axios.post(url, null, {
        params: {
          q: text,
          target: 'zh-CN',
          source: 'en',
          key: apiKey,
        },
      });

      return response.data.data.translations[0].translatedText;
    } catch (error) {
      console.error('Google Translate API 错误:', error.message);
      throw error;
    }
  }

  /**
   * 使用免费的 Google Translate（非官方接口）
   * @param {string} text - 要翻译的文本
   * @returns {Promise<string>} 翻译后的文本
   */
  async translateWithGoogleFree(text) {
    try {
      // 使用 Google Translate 的非官方接口
      const url = 'https://translate.googleapis.com/translate_a/single';
      const response = await axios.get(url, {
        params: {
          client: 'gtx',
          sl: 'en',
          tl: 'zh-CN',
          dt: 't',
          q: text,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      // 解析响应（格式: [[["翻译文本", "原文", null, null, 10]], null, "en", ...])
      const translated = response.data[0]
        .map(item => item[0])
        .join('');

      return translated;
    } catch (error) {
      console.error('免费 Google Translate 错误:', error.message);
      throw error;
    }
  }

  /**
   * 使用 OpenAI GPT 翻译
   * @param {string} text - 要翻译的文本
   * @returns {Promise<string>} 翻译后的文本
   */
  async translateWithOpenAI(text) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // 使用最便宜的模型
        messages: [
          {
            role: 'system',
            content: '你是一个专业的英译中翻译助手。请将英文活动标题翻译成自然流畅的中文，保持活动的吸引力和准确性。只返回翻译后的文本，不要添加任何解释或标点符号。',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI 翻译错误:', error.message);
      throw error;
    }
  }

  /**
   * 翻译单个文本
   * @param {string} text - 要翻译的文本
   * @returns {Promise<string>} 翻译后的文本
   */
  async translate(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // 如果文本已经包含中文，跳过翻译
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return text;
    }

    try {
      if (this.provider === 'openai') {
        return await this.translateWithOpenAI(text);
      } else {
        return await this.translateWithGoogle(text);
      }
    } catch (error) {
      console.error(`翻译失败 "${text}":`, error.message);
      // 翻译失败时返回原文
      return text;
    }
  }

  /**
   * 批量翻译（带进度显示）
   * @param {Array<string>} texts - 要翻译的文本数组
   * @param {number} batchSize - 批次大小
   * @param {number} delayMs - 每批次之间的延迟（毫秒）
   * @returns {Promise<Array<string>>} 翻译后的文本数组
   */
  async translateBatch(texts, batchSize = 10, delayMs = 1000) {
    const results = [];
    const total = texts.length;

    console.log(`\n🌐 开始批量翻译 ${total} 个文本 (使用 ${this.provider})...`);

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      console.log(`\n📦 批次 ${batchNum}/${totalBatches}: 翻译 ${batch.length} 个文本...`);

      // 并行翻译当前批次
      const batchResults = await Promise.all(
        batch.map(async (text, index) => {
          try {
            const translated = await this.translate(text);
            const globalIndex = i + index + 1;
            console.log(`  ✓ [${globalIndex}/${total}] ${text.substring(0, 40)}... → ${translated.substring(0, 30)}...`);
            return translated;
          } catch (error) {
            console.error(`  ✗ [${i + index + 1}/${total}] 翻译失败: ${text.substring(0, 40)}...`);
            return text; // 失败时返回原文
          }
        })
      );

      results.push(...batchResults);

      // 如果不是最后一批，延迟一下避免触发速率限制
      if (i + batchSize < texts.length) {
        console.log(`⏳ 等待 ${delayMs}ms 避免速率限制...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`\n✨ 批量翻译完成！成功: ${results.length}/${total}\n`);
    return results;
  }

  /**
   * 翻译活动对象数组（添加 title_zh 字段）
   * @param {Array<Object>} events - 活动对象数组（每个对象需有 title 字段）
   * @param {number} batchSize - 批次大小
   * @param {number} delayMs - 每批次之间的延迟（毫秒）
   * @returns {Promise<Array<Object>>} 添加了 title_zh 字段的活动数组
   */
  async translateEvents(events, batchSize = 10, delayMs = 1000) {
    if (!events || events.length === 0) {
      return events;
    }

    console.log(`\n🎯 准备翻译 ${events.length} 个活动标题...`);

    // 提取所有标题
    const titles = events.map(event => event.title);

    // 批量翻译
    const translatedTitles = await this.translateBatch(titles, batchSize, delayMs);

    // 将翻译结果添加到活动对象中
    const translatedEvents = events.map((event, index) => ({
      ...event,
      title_zh: translatedTitles[index],
    }));

    return translatedEvents;
  }
}

module.exports = Translator;
