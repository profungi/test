# 活动标题翻译功能使用指南

## 概述

本项目已集成自动翻译功能，可将英文活动标题翻译成中文，支持双语网站显示。

## 功能特点

- ✅ 支持 Google Translate 和 OpenAI GPT 两种翻译服务
- ✅ 在爬虫流程中自动翻译新活动
- ✅ 提供脚本翻译历史活动
- ✅ 前端自动根据语言显示对应标题
- ✅ 翻译失败自动降级显示英文

## 快速开始

### 1. 配置翻译服务

在 `.env` 文件中配置：

```bash
# 选择翻译服务提供商（google 或 openai）
TRANSLATOR_PROVIDER=google

# 如果使用 Google Translate API（可选，不设置会使用免费服务）
GOOGLE_TRANSLATE_API_KEY=your_google_api_key_here

# 如果使用 OpenAI（需要付费）
OPENAI_API_KEY=your_openai_api_key_here
```

**推荐：使用 Google Translate（免费）**

Google Translate 提供每月 50 万字符的免费额度，对于本项目完全足够：
- 每周约 103 个活动
- 每个标题约 50 字符
- 每月使用约 20,000 字符（远低于 500,000 限额）

### 2. 翻译现有活动

运行以下命令翻译数据库中已有的 325 个活动：

```bash
npm run translate-existing
```

**输出示例：**
```
🚀 开始翻译历史活动标题...
✅ 已连接到数据库
📋 找到 325 个需要翻译的活动

📦 批次 1/33: 处理 10 个活动...
  ✓ [1/325] ID 1: GATS: 20 Years of GATS → 20周年庆典...
  ✓ [2/325] ID 2: Golden State Warriors 2025/2026 Season → 金州勇士队 2025/2026 赛季...
  ...

✨ 翻译完成！
📊 最终统计:
   总计: 325 个活动
   成功: 325 个 (100%)
   失败: 0 个 (0%)
```

### 3. 新活动自动翻译

从现在开始，每次运行爬虫时会自动翻译新活动：

```bash
npm run scrape
```

翻译会在 **AI 分类之后** 自动执行，输出类似：

```
🌐 开始翻译活动标题...
📦 批次 1/11: 翻译 10 个文本...
  ✓ [1/103] Weekend Market at Ferry Building → 渡轮大厦周末市集...
  ✓ [2/103] Jazz Night at SFJAZZ Center → SFJAZZ中心爵士之夜...
  ...
✨ 批量翻译完成！成功: 103/103
```

## 高级用法

### 切换翻译服务

**使用 Google Translate（推荐）：**
```bash
npm run translate-existing
# 或
TRANSLATOR_PROVIDER=google npm run translate-existing
```

**使用 OpenAI GPT：**
```bash
npm run translate-existing -- --provider openai
# 或
TRANSLATOR_PROVIDER=openai npm run translate-existing
```

### 只翻译未翻译的活动

脚本会自动跳过已翻译的活动（`title_zh` 不为空），可以多次运行：

```bash
npm run translate-existing
```

如果第一次翻译有部分失败，重新运行会只翻译失败的那些。

### 查看帮助信息

```bash
node translate-existing-events.js --help
```

## 前端显示逻辑

网站前端会根据用户语言自动选择显示的标题：

```typescript
// 中文用户 → 显示中文标题（如果有），否则显示英文
const displayTitle = locale === 'zh' && event.title_zh
  ? event.title_zh
  : event.title;
```

## 数据库结构

新增字段 `title_zh`：

```sql
ALTER TABLE events ADD COLUMN title_zh TEXT;
```

迁移会在首次运行时自动执行。

## 成本估算

### Google Translate（推荐）
- ✅ **免费额度**：每月 50 万字符
- 你的使用量：每月约 20,000 字符
- **成本：$0.00**（完全免费）

### OpenAI GPT-4o-mini
- 输入：$0.150 / 1M tokens
- 输出：$0.600 / 1M tokens
- 每个标题约 70 tokens
- 每周 103 个活动 ≈ 7,210 tokens
- **成本：约 $0.001/周，$0.004/月**

## 故障排除

### 翻译失败

如果翻译失败，脚本会：
1. 显示错误信息
2. 继续处理其他活动
3. 统计显示失败数量

失败的活动会保留英文标题，不影响正常显示。

### 速率限制

脚本默认配置：
- 每批 10 个活动
- 批次间隔 1 秒

如果遇到速率限制，可以在脚本中调整参数。

### 数据库迁移

如果数据库没有 `title_zh` 字段，会在首次运行爬虫或连接数据库时自动添加：

```
🔄 Migrating database: adding title_zh column...
✅ Migration complete: title_zh column added
```

## 工作流程

### 完整流程图

```
爬取活动
    ↓
去重处理
    ↓
AI 分类和优先级排序
    ↓
【翻译标题】← 新增步骤
    ↓
生成人工审核文件（含中英文）
    ↓
人工审核确认
    ↓
发布到小红书
```

### 为什么在 AI 分类之后翻译？

1. **节省成本**：只翻译经过筛选的优质活动（~100个），不是全部（~300+）
2. **提升审核体验**：人工审核时可以看到中英文对照
3. **容错性好**：翻译失败不影响主流程
4. **批量高效**：可以批量处理，提高效率

## 注意事项

1. **网络要求**：翻译需要访问外部 API，确保网络连接正常
2. **API 密钥**：如使用付费服务，确保 API 密钥有效且有余额
3. **翻译质量**：建议人工审核时检查翻译质量，必要时手动修正
4. **幂等性**：脚本可以多次运行，已翻译的活动会自动跳过

## 相关文件

- `src/utils/translator.js` - 翻译服务模块
- `src/utils/database.js` - 数据库迁移逻辑
- `src/scrape-events.js` - 爬虫流程集成
- `translate-existing-events.js` - 历史数据翻译脚本
- `website/app/components/EventCard.tsx` - 前端显示组件
- `website/lib/types.ts` - TypeScript 类型定义

## 支持

如有问题，请查看：
- 主 README: `README.md`
- 架构文档: `ARCHITECTURE.md`
