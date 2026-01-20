/**
 * AI 摘要生成模块
 * 将活动描述总结成一句话的中英文宣传语
 * 优先级：NewAPI → Gemini → Mistral
 */

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class Summarizer {
  constructor() {
    this.clients = {};
    this.initializeClients();
  }

  /**
   * 初始化所有 AI 客户端
   */
  initializeClients() {
    // NewAPI (OpenAI-compatible)
    if (process.env.NEWAPI_API_KEY && process.env.NEWAPI_MODEL) {
      try {
        this.clients.newapi = new OpenAI({
          apiKey: process.env.NEWAPI_API_KEY,
          baseURL: process.env.NEWAPI_BASE_URL || 'https://yinli.one/v1',
        });
        console.log(`✅ NewAPI 客户端已初始化 (model: ${process.env.NEWAPI_MODEL})`);
      } catch (error) {
        console.warn('⚠️  NewAPI 客户端初始化失败:', error.message);
      }
    }

    // Gemini
    if (process.env.GEMINI_API_KEY) {
      try {
        this.clients.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini 客户端已初始化 (summarizer)');
      } catch (error) {
        console.warn('⚠️  Gemini 客户端初始化失败:', error.message);
      }
    }

    // Mistral (OpenAI-compatible)
    if (process.env.MISTRAL_API_KEY) {
      try {
        this.clients.mistral = new OpenAI({
          apiKey: process.env.MISTRAL_API_KEY,
          baseURL: 'https://api.mistral.ai/v1',
        });
        console.log('✅ Mistral 客户端已初始化 (summarizer)');
      } catch (error) {
        console.warn('⚠️  Mistral 客户端初始化失败:', error.message);
      }
    }
  }

  /**
   * 获取可用的 provider 列表（按优先级排序）
   */
  getAvailableProviders() {
    const priority = ['newapi', 'gemini', 'mistral'];
    return priority.filter(p => this.clients[p]);
  }

  /**
   * 构建摘要生成的 prompt
   */
  buildPrompt(title, description, eventType) {
    return `你是湾区活动推广专家，擅长从活动描述中提炼核心亮点，用简洁有力的语言吸引读者。

【核心任务】
从详细描述（description）中提取活动的**独特亮点**，创作一句话摘要。

【提取重点】
从description中寻找以下信息（优先级从高到低）：
1. **数字亮点**：摊位数量、艺术家人数、参展商规模等
   - 示例：200+摊位、50位艺术家、100+本地商家
2. **特色内容**：具体的表演、美食、活动形式
   - 示例：印度舞蹈表演、BBQ烧烤、手工艺品展售、服装比赛
3. **独特元素**：与众不同的亮点
   - 示例：获奖艺术家、现场DJ、拍照打卡区、免费试吃
4. **活动氛围**：家庭友好、宠物友好、适合约会等

【严格禁止】
❌ 重复标题中已有的信息（标题会单独显示）
❌ 包含日期、时间、地点、价格（这些会单独展示）
❌ 使用空泛词汇："社区活动"、"本地活动"、"各种"、"众多"
❌ 只说活动类型不说具体内容："艺术展"❌ → "20+艺术家绘画雕塑展售"✅

【输出要求】
- 中文：15-25个汉字，简洁有力，突出核心亮点
- 英文：20-30个单词，地道表达，吸引眼球
- 语气：热情、生动、让人想立刻参加
- 格式：纯JSON，不要markdown code block

【示例】

输入：
标题: "Oakland Diwali Festival"
描述: "Traditional lighting ceremony at sunset, featuring over 30 Indian classical dancers, live sitar and tabla performances, South Asian food vendors offering samosas and chai, henna art station, and family-friendly fireworks display."

输出：
{"en": "30+ classical Indian dancers, live sitar music, South Asian food vendors, henna art & fireworks", "zh": "30+印度古典舞者表演、现场西塔琴音乐、南亚美食摊位、海娜彩绘和烟花秀"}

---

现在请处理：

活动标题：${title}
活动描述：${description || '无详细描述'}
活动类型：${eventType || 'other'}

只返回JSON格式：{"en": "...", "zh": "..."}`;
  }

  /**
   * 使用 NewAPI 生成摘要
   */
  async summarizeWithNewAPI(title, description, eventType) {
    const prompt = this.buildPrompt(title, description, eventType);

    const response = await this.clients.newapi.chat.completions.create({
      model: process.env.NEWAPI_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = response.choices[0].message.content.trim();
    return this.parseJSON(content);
  }

  /**
   * 使用 Gemini 生成摘要
   */
  async summarizeWithGemini(title, description, eventType) {
    const prompt = this.buildPrompt(title, description, eventType);

    const model = this.clients.gemini.getGenerativeModel({
      model: 'gemini-2.0-flash',
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text().trim();

    return this.parseJSON(content);
  }

  /**
   * 使用 Mistral 生成摘要
   */
  async summarizeWithMistral(title, description, eventType) {
    const prompt = this.buildPrompt(title, description, eventType);

    const response = await this.clients.mistral.chat.completions.create({
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = response.choices[0].message.content.trim();
    return this.parseJSON(content);
  }

  /**
   * 解析 JSON 响应
   */
  parseJSON(content) {
    // 尝试提取 JSON 部分（处理可能的 markdown code block）
    let jsonStr = content;

    // 移除 markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // 尝试直接匹配 JSON 对象
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // 验证结果
      if (!parsed.en || !parsed.zh) {
        throw new Error('Missing en or zh field');
      }

      return {
        en: parsed.en.trim(),
        zh: parsed.zh.trim(),
      };
    } catch (error) {
      console.error('JSON 解析失败:', content);
      throw new Error(`JSON 解析失败: ${error.message}`);
    }
  }

  /**
   * 使用指定的 provider 生成摘要
   */
  async summarizeWithProvider(title, description, eventType, provider) {
    switch (provider) {
      case 'newapi':
        return await this.summarizeWithNewAPI(title, description, eventType);
      case 'gemini':
        return await this.summarizeWithGemini(title, description, eventType);
      case 'mistral':
        return await this.summarizeWithMistral(title, description, eventType);
      default:
        throw new Error(`未知的 provider: ${provider}`);
    }
  }

  /**
   * 生成单个活动的摘要（带优先级回退）
   * @param {string} title - 活动标题
   * @param {string} description - 活动描述
   * @param {string} eventType - 活动类型
   * @returns {Promise<{en: string, zh: string, provider: string} | null>}
   */
  async summarize(title, description, eventType) {
    // 如果没有描述，返回 null
    if (!description || description.trim().length < 10) {
      return null;
    }

    const providers = this.getAvailableProviders();

    if (providers.length === 0) {
      console.error('❌ 没有可用的 AI 服务，请配置 NEWAPI_API_KEY, GEMINI_API_KEY 或 MISTRAL_API_KEY');
      return null;
    }

    for (const provider of providers) {
      try {
        const result = await this.summarizeWithProvider(title, description, eventType, provider);
        return {
          en: result.en,
          zh: result.zh,
          provider,
        };
      } catch (error) {
        console.warn(`⚠️  ${provider} 摘要生成失败，尝试下一个服务...`, error.message);
        continue;
      }
    }

    console.error('❌ 所有 AI 服务都失败了');
    return null;
  }

  /**
   * 批量生成活动摘要
   * @param {Array<Object>} events - 活动对象数组
   * @param {number} batchSize - 批次大小
   * @param {number} delayMs - 每批次之间的延迟（毫秒）
   * @param {Object} database - 可选的数据库实例，用于更新数据库
   * @returns {Promise<Array<Object>>} 添加了 summary_en 和 summary_zh 的活动数组
   */
  async summarizeEvents(events, batchSize = 5, delayMs = 2000, database = null) {
    if (!events || events.length === 0) {
      return events;
    }

    const providers = this.getAvailableProviders();
    if (providers.length === 0) {
      console.warn('⚠️  没有可用的摘要服务，跳过摘要生成');
      return events;
    }

    console.log(`\n📝 开始生成活动摘要...`);
    console.log(`📋 可用服务: ${providers.join(' → ')}`);
    console.log(`📊 待处理: ${events.length} 个活动\n`);

    const stats = {
      newapi: 0,
      gemini: 0,
      mistral: 0,
      skipped: 0,
      failed: 0,
    };

    const results = [];

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(events.length / batchSize);

      console.log(`\n📦 批次 ${batchNum}/${totalBatches}: 处理 ${batch.length} 个活动...`);

      // 串行处理当前批次
      for (let j = 0; j < batch.length; j++) {
        const event = batch[j];
        const globalIndex = i + j + 1;

        // 如果没有描述，跳过
        if (!event.description || event.description.trim().length < 10) {
          console.log(`  ⏭️  [${globalIndex}/${events.length}] 跳过（无描述）: ${event.title.substring(0, 40)}...`);
          stats.skipped++;
          results.push({
            ...event,
            summary_en: null,
            summary_zh: null,
          });
          continue;
        }

        try {
          const summary = await this.summarize(
            event.title,
            event.description,
            event.eventType || event.event_type
          );

          if (summary) {
            const providerIcon = {
              newapi: '🔷',
              gemini: '🔮',
              mistral: '🌪️',
            }[summary.provider] || '❓';

            console.log(`  ${providerIcon} [${globalIndex}/${events.length}] ${event.title.substring(0, 35)}...`);
            console.log(`     EN: ${summary.en.substring(0, 50)}...`);
            console.log(`     ZH: ${summary.zh}`);

            stats[summary.provider]++;
            results.push({
              ...event,
              summary_en: summary.en,
              summary_zh: summary.zh,
            });
          } else {
            stats.failed++;
            results.push({
              ...event,
              summary_en: null,
              summary_zh: null,
            });
          }

          // 批次内请求间隔
          if (j < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`  ❌ [${globalIndex}/${events.length}] 失败: ${event.title.substring(0, 40)}...`);
          stats.failed++;
          results.push({
            ...event,
            summary_en: null,
            summary_zh: null,
          });
        }
      }

      // 批次间延迟
      if (i + batchSize < events.length) {
        console.log(`  ⏳ 等待 ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // 显示统计信息
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

    // 如果提供了数据库实例，更新数据库中的摘要
    if (database) {
      console.log(`💾 更新数据库中的摘要...`);
      let updateCount = 0;

      for (const event of results) {
        if ((event.summary_zh || event.summary_en) && event.id) {
          try {
            await database.updateEventSummaries(
              event.id,
              event.summary_zh,
              event.summary_en
            );
            updateCount++;
          } catch (error) {
            console.warn(`  ⚠️  更新失败 (ID: ${event.id}): ${error.message}`);
          }
        }
      }

      console.log(`✅ 数据库更新完成: ${updateCount}/${results.length} 个活动\n`);
    }

    return results;
  }
}

module.exports = Summarizer;
