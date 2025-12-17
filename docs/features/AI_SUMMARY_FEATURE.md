# AI 活动摘要功能

## 功能概述

为避免版权问题，使用 AI 生成活动描述的摘要，替代原始描述显示在网站上。

### 主要特性

1. **多 AI 提供商支持**
   - NewAPI (优先) - OpenAI 兼容 API
   - Google Gemini (备选)
   - Mistral AI (备选)
   - 自动回退机制：失败时自动尝试下一个提供商

2. **双语摘要**
   - 中文摘要：15-25 字，活泼有趣的风格
   - 英文摘要：20-30 词，突出活动亮点

3. **预处理架构**
   - 在抓取流程中生成，而非实时生成
   - 存储在数据库中，减少 API 调用
   - 支持批量补充历史数据

---

## 快速开始

### 环境配置

在 `.env` 文件中添加以下配置：

```bash
# NewAPI 配置（优先使用）
NEWAPI_API_KEY=your_newapi_key_here
NEWAPI_BASE_URL=https://api.newapi.pro/v1
NEWAPI_MODEL=gpt-4o-mini

# 备选：Gemini
GEMINI_API_KEY=your_gemini_key_here

# 备选：Mistral
MISTRAL_API_KEY=your_mistral_key_here
```

### 数据库迁移

首次使用需要添加摘要字段：

```bash
# 运行迁移脚本（Turso 和本地 SQLite）
node scripts/migrate-add-summary-columns.js
```

### 批量生成摘要

为本周和下周已有活动生成摘要：

```bash
npm run generate-summaries
```

---

## 工作原理

### 抓取流程集成

摘要生成已集成到抓取流程中，在翻译之后、存储之前执行：

```
1. 并行抓取 (Eventbrite, SF Station, Funcheap)
2. 内存去重 + 过滤无效活动
3. 翻译活动标题 (title_zh)
4. ✨ 生成 AI 摘要 (summary_en, summary_zh)
5. 数据库去重和保存
6. AI 分类和优先级排序
7. 生成审核 JSON 文件
```

### 数据库字段

新增两个字段到 `events` 表：

| 字段 | 类型 | 说明 |
|------|------|------|
| `summary_en` | TEXT | 英文摘要 (20-30 词) |
| `summary_zh` | TEXT | 中文摘要 (15-25 字) |

### 前端显示逻辑

```typescript
// 优先显示摘要，如果没有则回退到原始描述
const displaySummary = locale === 'zh'
  ? (event.summary_zh || event.description)
  : (event.summary_en || event.description);
```

---

## 命令参考

### 批量生成摘要

```bash
# 为本周和下周活动生成摘要
npm run generate-summaries

# 查看帮助
node generate-summaries.js --help
```

**输出示例**：
```
📅 本周: 2024-12-16_to_2024-12-22
📅 下周: 2024-12-23_to_2024-12-29

📊 找到 25 个需要生成摘要的活动

📦 批次 1/5: 处理 5 个活动...
  🔷 [1/25] ID 123: Annual Holiday Market at...
     EN: Celebrate the season with 150+ local artisans...
     ZH: 150+本地工匠汇聚，手工艺品、美食、现场音乐！
```

### 同步数据

生成摘要后同步到本地：

```bash
# 增量同步
npm run sync-from-turso

# 差异同步（删除 Turso 中不存在的本地记录）
npm run sync-diff
```

---

## API 提供商配置

### NewAPI (推荐)

使用 OpenAI 兼容 API，性价比高：

```bash
NEWAPI_API_KEY=your_key
NEWAPI_BASE_URL=https://api.newapi.pro/v1
NEWAPI_MODEL=gpt-4o-mini  # 或其他支持的模型
```

文档：https://docs.newapi.pro/

### Google Gemini

Google 的 AI 服务：

```bash
GEMINI_API_KEY=your_key
```

### Mistral AI

法国 AI 公司的服务：

```bash
MISTRAL_API_KEY=your_key
```

---

## Prompt 设计

摘要生成使用以下提示策略：

1. **风格要求**
   - 活泼有趣，吸引眼球
   - 突出数字亮点（如"200个摊位"）
   - 提及特色元素（乐队、餐车、圣诞老人等）

2. **长度控制**
   - 中文：15-25 个汉字
   - 英文：20-30 个单词

3. **输出格式**
   ```json
   {
     "en": "English summary here...",
     "zh": "中文摘要..."
   }
   ```

---

## 技术实现

### 核心文件

| 文件 | 说明 |
|------|------|
| `src/utils/summarizer.js` | AI 摘要生成模块 |
| `generate-summaries.js` | 批量生成脚本 |
| `scripts/migrate-add-summary-columns.js` | 数据库迁移脚本 |

### Summarizer 类

```javascript
const Summarizer = require('./src/utils/summarizer');

const summarizer = new Summarizer();

// 单个活动摘要
const result = await summarizer.summarize(title, description, eventType);
// result: { en: '...', zh: '...', provider: 'newapi' }

// 批量处理
const events = await summarizer.summarizeEvents(events, batchSize, delayMs);
```

### 错误处理

- 自动在提供商之间切换
- 批量处理带有延迟，避免速率限制
- 失败的活动会被跳过，不影响其他活动

---

## 故障排除

### 摘要未生成

1. **检查 API 配置**
   ```bash
   npm run check-env
   ```

2. **测试 AI 服务**
   ```bash
   npm run test-gemini
   npm run test-translation
   ```

3. **查看缺失摘要的活动**
   ```bash
   sqlite3 data/events.db "SELECT COUNT(*) FROM events WHERE summary_en IS NULL;"
   ```

### 摘要质量问题

1. **重新生成特定活动**
   - 在数据库中将 `summary_en` 和 `summary_zh` 设为 NULL
   - 重新运行 `npm run generate-summaries`

2. **调整 Prompt**
   - 修改 `src/utils/summarizer.js` 中的 `buildPrompt()` 方法

### 前端未显示摘要

1. **确认数据库已同步**
   ```bash
   npm run sync-from-turso
   ```

2. **检查 API 返回的数据**
   - 确认 `summary_en` 和 `summary_zh` 字段存在

---

## 相关文档

- [命令大全](../../COMMANDS.md) - 所有可用命令
- [数据架构](../DATA_ARCHITECTURE.md) - 数据流设计
- [翻译指南](../TRANSLATION_GUIDE.md) - 翻译 API 配置
- [去重指南](../setup/DEDUPLICATION_GUIDE.md) - 数据去重功能

---

**最后更新**: 2024-12-17
