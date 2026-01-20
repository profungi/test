/**
 * 翻译服务模块
 * 支持多种翻译服务，带优先级回退机制
 * 优先级：NewAPI → Gemini → OpenAI → Mistral → Google Translate
 */

const axios = require('axios');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class Translator {
  constructor(provider = 'auto') {
    this.provider = provider;
    this.clients = {};

    // 定义统一的翻译系统提示词
    this.systemPrompt = `你是专业的湾区活动翻译专家，精通英译中和本地化表达。

翻译要求：
1. 自然流畅的中文表达，符合小红书用户阅读习惯
2. 保留活动的吸引力和特色，使用生动的词汇
3. 本地化处理：Bay Area → 湾区，San Francisco → 旧金山，Oakland → 奥克兰等
4. 对于专有名词（品牌、艺术家名字、场馆名）保留英文
5. 只返回翻译结果，不要解释、引号或多余标点

示例：
"Halloween Farmers Market" → "万圣节农夫市集"
"Jazz Night at The Fillmore" → "The Fillmore 爵士之夜"
"Bay Area Food Festival" → "湾区美食节"
"Tech Talk: AI & Machine Learning" → "科技讲座：AI与机器学习"`;

    // 初始化所有可用的翻译客户端
    this.initializeClients();

    // 如果指定了特定提供商，验证其可用性
    if (provider !== 'auto') {
      this.validateProvider(provider);
    }
  }

  /**
   * 初始化所有翻译服务客户端
   */
  initializeClients() {
    // NewAPI (OpenAI-compatible, 优先级最高)
    if (process.env.NEWAPI_API_KEY && process.env.NEWAPI_MODEL) {
      try {
        this.clients.newapi = new OpenAI({
          apiKey: process.env.NEWAPI_API_KEY,
          baseURL: process.env.NEWAPI_BASE_URL || 'https://api.newapi.pro/v1',
        });
        console.log(`✅ NewAPI 客户端已初始化 (translator, model: ${process.env.NEWAPI_MODEL})`);
      } catch (error) {
        console.warn('⚠️  NewAPI 客户端初始化失败:', error.message);
      }
    }

    // Gemini
    if (process.env.GEMINI_API_KEY) {
      try {
        this.clients.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini 客户端已初始化');
      } catch (error) {
        console.warn('⚠️  Gemini 客户端初始化失败:', error.message);
      }
    }

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        this.clients.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI 客户端已初始化');
      } catch (error) {
        console.warn('⚠️  OpenAI 客户端初始化失败:', error.message);
      }
    }

    // Mistral (使用 OpenAI 兼容接口)
    if (process.env.MISTRAL_API_KEY) {
      try {
        this.clients.mistral = new OpenAI({
          apiKey: process.env.MISTRAL_API_KEY,
          baseURL: 'https://api.mistral.ai/v1',
        });
        console.log('✅ Mistral 客户端已初始化');
      } catch (error) {
        console.warn('⚠️  Mistral 客户端初始化失败:', error.message);
      }
    }

    // Google Translate 总是可用（使用免费接口）
    this.clients.google = true;
    console.log('✅ Google Translate (免费) 已启用');
  }

  /**
   * 验证指定的提供商是否可用
   */
  validateProvider(provider) {
    if (!this.clients[provider]) {
      throw new Error(`翻译服务 ${provider} 不可用，请检查 API Key 配置`);
    }
  }

  /**
   * 获取可用的翻译服务列表（按优先级排序）
   */
  getAvailableProviders() {
    const priority = ['newapi', 'gemini', 'openai', 'mistral', 'google'];
    return priority.filter(p => this.clients[p]);
  }

  /**
   * 使用 NewAPI 翻译
   */
  async translateWithNewAPI(text) {
    try {
      const response = await this.clients.newapi.chat.completions.create({
        model: process.env.NEWAPI_MODEL,
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.5,
        max_tokens: 150,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('NewAPI 翻译错误:', error.message);
      throw error;
    }
  }

  /**
   * 使用 Google Gemini 翻译（带速率限制重试）
   */
  async translateWithGemini(text, retries = 1) {
    try {
      // 使用 Gemini 2.5 Flash 模型（2024年11月更新）
      // gemini-2.5-flash 是最新的、价格性能比最佳的模型
      // 注意：gemini-1.5-* 模型已于2024年9月退役
      const model = this.clients.gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 150,
        },
      });

      const prompt = `${this.systemPrompt}

请翻译以下英文活动标题：
${text}

中文翻译：`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const translated = response.text().trim();

      // 去除可能的引号和多余标点
      return translated.replace(/^["'「『]|["'」』]$/g, '').replace(/^中文翻译[:：]\s*/, '');
    } catch (error) {
      // 检查是否是速率限制错误
      if (error.message.includes('429') || error.message.includes('quota')) {
        console.warn('⚠️  Gemini 速率限制，自动回退到其他服务...');
      } else {
        console.error('Gemini 翻译错误:', error.message);
      }
      throw error;
    }
  }

  /**
   * 使用 OpenAI GPT 翻译
   */
  async translateWithOpenAI(text) {
    try {
      const response = await this.clients.openai.chat.completions.create({
        model: 'gpt-4o-mini', // 使用最便宜的模型
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.5,
        max_tokens: 150,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI 翻译错误:', error.message);
      throw error;
    }
  }

  /**
   * 使用 Mistral 翻译
   */
  async translateWithMistral(text) {
    try {
      const response = await this.clients.mistral.chat.completions.create({
        model: 'mistral-small-latest', // 使用小模型
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.5,
        max_tokens: 150,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Mistral 翻译错误:', error.message);
      throw error;
    }
  }

  /**
   * 使用 Google Translate API 翻译
   */
  async translateWithGoogle(text) {
    try {
      const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

      if (apiKey) {
        // 使用官方 API
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
      } else {
        // 使用免费的非官方接口
        return await this.translateWithGoogleFree(text);
      }
    } catch (error) {
      console.error('Google Translate 错误:', error.message);
      throw error;
    }
  }

  /**
   * 使用免费的 Google Translate（非官方接口）
   */
  async translateWithGoogleFree(text) {
    try {
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

      // 解析响应
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
   * 验证翻译输出是否有效
   * @param {string} translated - 翻译后的文本
   * @param {string} original - 原始文本
   * @returns {boolean} 是否有效
   */
  validateTranslation(translated, original) {
    if (!translated || typeof translated !== 'string') {
      return false;
    }

    // 检查1: 长度异常（翻译结果不应该比原文长5倍以上）
    if (translated.length > original.length * 5) {
      console.warn(`⚠️  翻译结果异常长 (${translated.length} 字符，原文 ${original.length} 字符)`);
      return false;
    }

    // 检查2: 长度异常短（翻译结果不应该为空或只有几个字符）
    if (translated.length < 2) {
      console.warn(`⚠️  翻译结果过短 (${translated.length} 字符)`);
      return false;
    }

    // 检查3: 包含AI思考过程的关键词
    const thinkingKeywords = [
      'THOUGHT', 'THINKING', 'ANALYSIS', 'CONSIDER',
      '思考：', '分析：', '考虑：', 'Let me', 'I need to',
      '中文翻译：', '翻译结果：', '翻译为：'
    ];
    for (const keyword of thinkingKeywords) {
      if (translated.includes(keyword)) {
        console.warn(`⚠️  翻译结果包含思考过程关键词: "${keyword}"`);
        return false;
      }
    }

    // 检查4: 包含多余的解释性文字（例如带引号的解释）
    if (translated.match(/["'"].*?["'"]\s*[-:：]\s*/)) {
      console.warn(`⚠️  翻译结果可能包含解释性文字`);
      return false;
    }

    // 检查5: 不应该包含换行符（活动标题应该是单行）
    if (translated.includes('\n')) {
      console.warn(`⚠️  翻译结果包含换行符`);
      return false;
    }

    // 检查6: 翻译结果应该包含中文字符
    const hasChinese = /[\u4e00-\u9fa5]/.test(translated);
    if (!hasChinese) {
      console.warn(`⚠️  翻译结果不包含中文字符: "${translated}"`);
      return false;
    }

    // 检查7: 翻译结果不应该和原文完全相同（除非原文已包含中文）
    const originalHasChinese = /[\u4e00-\u9fa5]/.test(original);
    if (!originalHasChinese && translated === original) {
      console.warn(`⚠️  翻译结果与原文相同（未翻译）`);
      return false;
    }

    // 检查8: 检查是否包含常见的翻译错误标记
    const errorMarkers = ['[翻译]', '[Translation]', '(翻译)', '(Translation)', '无法翻译', 'Cannot translate'];
    for (const marker of errorMarkers) {
      if (translated.includes(marker)) {
        console.warn(`⚠️  翻译结果包含错误标记: "${marker}"`);
        return false;
      }
    }

    return true;
  }

  /**
   * 翻译单个文本（带优先级回退）
   * @param {string} text - 要翻译的文本
   * @returns {Promise<{text: string, provider: string}>} 翻译结果和使用的服务
   */
  async translate(text) {
    if (!text || typeof text !== 'string') {
      return { text, provider: 'none' };
    }

    // 如果文本已经包含中文，跳过翻译
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return { text, provider: 'skipped' };
    }

    // 如果指定了特定提供商，只使用该服务
    if (this.provider !== 'auto') {
      try {
        const translated = await this.translateWithProvider(text, this.provider);

        // 验证翻译结果
        if (!this.validateTranslation(translated, text)) {
          console.error(`❌ ${this.provider} 翻译结果验证失败`);
          return { text, provider: 'failed' };
        }

        return { text: translated, provider: this.provider };
      } catch (error) {
        console.error(`❌ ${this.provider} 翻译失败:`, error.message);
        return { text, provider: 'failed' };
      }
    }

    // 自动模式：按优先级尝试所有可用服务
    const providers = this.getAvailableProviders();

    for (const provider of providers) {
      try {
        const translated = await this.translateWithProvider(text, provider);

        // 验证翻译结果
        if (!this.validateTranslation(translated, text)) {
          console.warn(`⚠️  ${provider} 翻译结果验证失败，尝试下一个服务...`);
          continue;
        }

        return { text: translated, provider };
      } catch (error) {
        console.warn(`⚠️  ${provider} 翻译失败，尝试下一个服务...`);
        continue;
      }
    }

    // 所有服务都失败，返回原文
    console.error('❌ 所有翻译服务都失败了');
    return { text, provider: 'failed' };
  }

  /**
   * 使用指定的提供商翻译
   */
  async translateWithProvider(text, provider) {
    switch (provider) {
      case 'newapi':
        return await this.translateWithNewAPI(text);
      case 'gemini':
        return await this.translateWithGemini(text);
      case 'openai':
        return await this.translateWithOpenAI(text);
      case 'mistral':
        return await this.translateWithMistral(text);
      case 'google':
        return await this.translateWithGoogle(text);
      default:
        throw new Error(`未知的翻译服务: ${provider}`);
    }
  }

  /**
   * 批量翻译（带进度显示和优先级回退）
   * @param {Array<string>} texts - 要翻译的文本数组
   * @param {number} batchSize - 批次大小
   * @param {number} delayMs - 每批次之间的延迟（毫秒）
   * @returns {Promise<Array<{text: string, provider: string}>>} 翻译结果数组
   */
  async translateBatch(texts, batchSize = 10, delayMs = 1000) {
    const results = [];
    const total = texts.length;
    const stats = {
      newapi: 0,
      gemini: 0,
      openai: 0,
      mistral: 0,
      google: 0,
      skipped: 0,
      failed: 0,
    };

    console.log(`\n🌐 开始批量翻译 ${total} 个文本...`);
    console.log(`📋 可用服务: ${this.getAvailableProviders().join(' → ')}`);
    console.log(`⚙️  模式: ${this.provider === 'auto' ? '自动回退' : '指定服务 (' + this.provider + ')'}\n`);

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      console.log(`\n📦 批次 ${batchNum}/${totalBatches}: 翻译 ${batch.length} 个文本...`);

      // 串行翻译当前批次（避免并发请求触发速率限制）
      const batchResults = [];
      for (let j = 0; j < batch.length; j++) {
        const text = batch[j];
        const globalIndex = i + j + 1;

        try {
          const result = await this.translate(text);
          stats[result.provider]++;

          const providerIcon = {
            newapi: '🔷',
            gemini: '🔮',
            openai: '🤖',
            mistral: '🌪️',
            google: '🌐',
            skipped: '⏭️',
            failed: '❌',
          }[result.provider] || '❓';

          console.log(
            `  ${providerIcon} [${globalIndex}/${total}] ${text.substring(0, 35)}... → ${result.text.substring(0, 25)}... (${result.provider})`
          );

          batchResults.push(result);

          // 在批次内的请求之间也添加小延迟（对 Gemini 或 auto 模式）
          if (j < batch.length - 1 && (this.provider === 'gemini' || this.provider === 'auto')) {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms 延迟，进一步降低速率
          }
        } catch (error) {
          console.error(`  ✗ [${globalIndex}/${total}] 翻译失败: ${text.substring(0, 40)}...`);
          stats.failed++;
          batchResults.push({ text, provider: 'failed' });
        }
      }

      results.push(...batchResults);

      // 如果不是最后一批，延迟一下避免触发速率限制
      if (i + batchSize < texts.length) {
        console.log(`  ⏳ 等待 ${delayMs}ms 避免速率限制...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // 显示统计信息
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✨ 批量翻译完成！\n`);
    console.log(`📊 翻译统计:`);
    console.log(`   总计: ${total} 个文本`);
    if (stats.newapi > 0) console.log(`   🔷 NewAPI: ${stats.newapi} (${Math.round((stats.newapi / total) * 100)}%)`);
    if (stats.gemini > 0) console.log(`   🔮 Gemini: ${stats.gemini} (${Math.round((stats.gemini / total) * 100)}%)`);
    if (stats.openai > 0) console.log(`   🤖 OpenAI: ${stats.openai} (${Math.round((stats.openai / total) * 100)}%)`);
    if (stats.mistral > 0) console.log(`   🌪️  Mistral: ${stats.mistral} (${Math.round((stats.mistral / total) * 100)}%)`);
    if (stats.google > 0) console.log(`   🌐 Google: ${stats.google} (${Math.round((stats.google / total) * 100)}%)`);
    if (stats.skipped > 0) console.log(`   ⏭️  跳过: ${stats.skipped} (已含中文)`);
    if (stats.failed > 0) console.log(`   ❌ 失败: ${stats.failed}`);
    console.log(`${'='.repeat(60)}\n`);

    return results;
  }

  /**
   * 翻译活动对象数组（添加 title_zh 字段）
   * @param {Array<Object>} events - 活动对象数组（每个对象需有 title 字段）
   * @param {number} batchSize - 批次大小
   * @param {number} delayMs - 每批次之间的延迟（毫秒）
   * @param {Object} database - 可选的数据库实例，用于更新数据库
   * @returns {Promise<Array<Object>>} 添加了 title_zh 字段的活动数组
   */
  async translateEvents(events, batchSize = 10, delayMs = 1000, database = null) {
    if (!events || events.length === 0) {
      return events;
    }

    console.log(`\n🎯 准备翻译 ${events.length} 个活动标题...`);

    // 提取所有标题
    const titles = events.map(event => event.title);

    // 批量翻译
    const translationResults = await this.translateBatch(titles, batchSize, delayMs);

    // 将翻译结果添加到活动对象中
    const translatedEvents = events.map((event, index) => ({
      ...event,
      title_zh: translationResults[index].text,
    }));

    // 如果提供了数据库实例，更新数据库中的 title_zh
    if (database) {
      console.log(`\n💾 更新数据库中的翻译...`);
      let updateCount = 0;

      for (const event of translatedEvents) {
        if (event.title_zh && event.id) {
          try {
            await database.updateEventTranslation(event.id, event.title_zh);
            updateCount++;
          } catch (error) {
            console.warn(`  ⚠️  更新失败 (ID: ${event.id}): ${error.message}`);
          }
        }
      }

      console.log(`✅ 数据库更新完成: ${updateCount}/${translatedEvents.length} 个活动\n`);
    }

    return translatedEvents;
  }
}

module.exports = Translator;
