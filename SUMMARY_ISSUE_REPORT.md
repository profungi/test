# Summary 功能问题排查报告

## 问题描述

活动的一句话总结（summary_zh 和 summary_en）没有在 Turso 数据库中显示。

## 排查结果

### ✅ 代码逻辑正确

1. **Summary 生成模块存在** (`src/utils/summarizer.js`)
   - 功能：为每个活动生成中英文双语摘要
   - 字段：`summary_zh`（中文）和 `summary_en`（英文）
   - AI 提供商支持：NewAPI → Gemini → Mistral（自动回退）

2. **抓取流程集成正确** (`src/scrape-events.js:111`)
   ```javascript
   // 第6步：生成AI摘要
   const summarizedEvents = await this.summarizer.summarizeEvents(
     translatedEvents,
     5,    // 每批处理 5 个
     2000, // 每批间隔 2 秒
     this.database // ✅ 已传入数据库实例
   );
   ```

3. **数据库更新方法存在** (`src/utils/turso-database.js:216`)
   ```javascript
   async updateEventSummaries(eventId, summaryZh, summaryEn) {
     await this.client.execute({
       sql: 'UPDATE events SET summary_zh = ?, summary_en = ? WHERE id = ?',
       args: [summaryZh, summaryEn, eventId]
     });
   }
   ```

4. **前端显示逻辑正确** (`website/app/components/EventCard.tsx:54-56`)
   ```typescript
   const displaySummary = locale === 'zh'
     ? (event.summary_zh || event.description)
     : (event.summary_en || event.description);
   ```

### ❌ 发现的问题

**GitHub Actions 工作流缺少 Summary 生成所需的 API 密钥**

位置：`.github/workflows/weekly-scrape.yml:58-73`

**问题分析：**
- Summary 生成器需要以下 API 密钥之一：
  - `NEWAPI_API_KEY` + `NEWAPI_BASE_URL` + `NEWAPI_MODEL`（优先）
  - `GEMINI_API_KEY`（备选）
  - `MISTRAL_API_KEY`（备选）

- 当前 GitHub Actions 配置只包含：
  - `OPENAI_API_KEY`（用于 AI 分类，不用于 Summary）
  - `GEMINI_API_KEY`（已配置，但可能没有在 GitHub Secrets 中设置）
  - `CLAUDE_API_KEY`（用于 AI 分类，不用于 Summary）

- **如果没有可用的 API 密钥，Summarizer 会跳过所有活动：**
  ```javascript
  const providers = this.getAvailableProviders();
  if (providers.length === 0) {
    console.warn('⚠️  没有可用的摘要服务，跳过摘要生成');
    return events; // 直接返回，不生成 summary
  }
  ```

## 解决方案

### ✅ 已修复

**1. 修改 GitHub Actions 配置** (`.github/workflows/weekly-scrape.yml:68-72`)

添加了以下环境变量：
```yaml
# Summary生成所需的API密钥（优先级：NewAPI → Gemini → Mistral）
NEWAPI_API_KEY: ${{ secrets.NEWAPI_API_KEY }}
NEWAPI_BASE_URL: ${{ secrets.NEWAPI_BASE_URL }}
NEWAPI_MODEL: ${{ secrets.NEWAPI_MODEL }}
MISTRAL_API_KEY: ${{ secrets.MISTRAL_API_KEY }}
```

**2. 优化 Summary 提示词** (`src/utils/summarizer.js:68-114`)

改进点：
- ✅ 强调从 description 中提取信息，不重复标题
- ✅ 明确禁止包含日期、时间、地点、价格
- ✅ 提供具体示例和优先级指导
- ✅ 添加湾区本地化要求

**提示词对比：**

改进前：
```
要求：
1. 提炼关键亮点
2. 语气活泼有趣
3. 中文：15-25个汉字
4. 英文：20-30个单词
```

改进后：
```
【提取重点】
从description中寻找以下信息（优先级从高到低）：
1. **数字亮点**：200+摊位、50位艺术家
2. **特色内容**：印度舞蹈表演、BBQ烧烤
3. **独特元素**：获奖艺术家、现场DJ
4. **活动氛围**：家庭友好、宠物友好

【严格禁止】
❌ 重复标题中已有的信息
❌ 包含日期、时间、地点、价格
❌ 使用空泛词汇："社区活动"、"各种"
```

### 📋 需要手动配置

**在 GitHub Repository Settings 中添加以下 Secrets：**

推荐方案（选一个即可）：

**方案 1：使用 Gemini（推荐，免费额度充足）**
```
GEMINI_API_KEY = your_gemini_api_key
```

**方案 2：使用 NewAPI（性价比高）**
```
NEWAPI_API_KEY = your_newapi_key
NEWAPI_BASE_URL = https://api.newapi.pro/v1
NEWAPI_MODEL = gpt-4o-mini
```

**方案 3：使用 Mistral**
```
MISTRAL_API_KEY = your_mistral_key
```

### 📝 配置步骤

1. **进入 GitHub Repository**
   ```
   https://github.com/[your-username]/[your-repo]/settings/secrets/actions
   ```

2. **点击 "New repository secret"**

3. **添加至少一个 API 密钥**（推荐 Gemini）
   - Name: `GEMINI_API_KEY`
   - Value: 你的 Gemini API Key
   - 获取方式：https://aistudio.google.com/app/apikey

4. **下次自动抓取时会生成 Summary**

## 验证方法

### 检查本地数据库

```bash
# 查看有多少活动缺少 summary
sqlite3 data/events.db "SELECT COUNT(*) FROM events WHERE summary_en IS NULL;"

# 查看最近添加的 summary
sqlite3 data/events.db "SELECT title, summary_zh, summary_en FROM events WHERE summary_zh IS NOT NULL LIMIT 5;"
```

### 检查 Turso 数据库

```bash
# 查看 Turso 中缺少 summary 的活动
turso db shell bay-area-events "SELECT COUNT(*) FROM events WHERE summary_en IS NULL;"
```

### 手动运行 Summary 生成

```bash
# 为本周和下周活动生成 summary
npm run generate-summaries

# 运行后检查日志，应该看到：
# ✅ 找到 X 个需要生成摘要的活动
# 🔮 [1/X] Oakland Diwali Festival...
#    EN: 30+ classical Indian dancers...
#    ZH: 30+印度古典舞者表演...
```

### 检查 GitHub Actions 日志

下次自动抓取后，查看日志中是否包含：

```
✅ NewAPI 客户端已初始化 (model: gpt-4o-mini)
或
✅ Gemini 客户端已初始化 (summarizer)

📝 开始生成活动摘要...
📋 可用服务: newapi (或 gemini/mistral)
```

## 预期效果

配置完成后：

1. **自动抓取时**：
   - 每个活动会自动生成中英文摘要
   - 摘要会保存到 Turso 数据库
   - 前端会优先显示摘要，没有摘要时回退到原始描述

2. **摘要示例**：
   ```json
   {
     "title": "Oakland Diwali Festival",
     "summary_en": "30+ classical Indian dancers, live sitar music, South Asian food vendors, henna art & fireworks",
     "summary_zh": "30+印度古典舞者表演、现场西塔琴音乐、南亚美食摊位、海娜彩绘和烟花秀"
   }
   ```

3. **用户体验**：
   - 中文用户看到 `summary_zh`
   - 英文用户看到 `summary_en`
   - 摘要不重复标题、时间、地点等已显示信息
   - 摘要突出活动核心亮点，吸引用户点击

## 相关文件

- `src/utils/summarizer.js` - Summary 生成模块
- `generate-summaries.js` - 批量生成脚本
- `.github/workflows/weekly-scrape.yml` - GitHub Actions 配置
- `docs/features/AI_SUMMARY_FEATURE.md` - Summary 功能文档

## 总结

**问题根源**：GitHub Actions 缺少 Summary 生成所需的 API 密钥配置

**解决方案**：
1. ✅ 已修复 GitHub Actions 配置（添加环境变量）
2. ✅ 已优化 Summary 提示词质量
3. ⏳ 需要在 GitHub Secrets 中配置 API 密钥

**下一步**：在 GitHub Repository Settings 中添加 `GEMINI_API_KEY` 或其他 API 密钥，下次自动抓取时会自动生成 Summary。
