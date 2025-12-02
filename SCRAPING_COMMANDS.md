# 爬虫命令使用指南

## 快速开始

### 爬取本周活动 (本周一到本周日)

```bash
npm run scrape-current-week
```

### 爬取下周活动 (下周一到下周日) - 默认

```bash
npm run scrape
# 或
npm run scrape-next-week
```

## 命令详解

### 1. 基本命令

| 命令 | 描述 | 等价命令 |
|------|------|----------|
| `npm run scrape` | 爬取下周活动 (默认) | `npm run scrape-next-week` |
| `npm run scrape-current-week` | 爬取本周活动 | `npm run scrape -- --week current` |
| `npm run scrape-next-week` | 爬取下周活动 | `npm run scrape -- --week next` |

### 2. 高级选项

#### 指定 AI 提供商

```bash
# 使用 Gemini (推荐,免费)
npm run scrape-current-week -- --ai-provider gemini

# 使用 OpenAI
npm run scrape-current-week -- --ai-provider openai

# 使用 Claude
npm run scrape-current-week -- --ai-provider claude
```

#### 组合多个选项

```bash
# 爬取本周活动,使用 Gemini AI
npm run scrape -- --week current --ai-provider gemini

# 爬取下周活动,使用 OpenAI
npm run scrape -- --week next --ai-provider openai
```

### 3. 查看帮助

```bash
npm run scrape -- --help
```

## 工作流程

### 典型使用场景 1: 爬取本周活动

```bash
# 1. 爬取本周活动
npm run scrape-current-week

# 2. 查看生成的审核文件
# 文件位于: output/review_YYYY-MM-DD_HHMM.json

# 3. 编辑审核文件,选择要发布的活动
# 将 "selected": false 改为 "selected": true

# 4. 生成小红书发布内容
npm run generate-post output/review_2024-12-01_1430.json
```

### 典型使用场景 2: 爬取下周活动 (周日提前准备)

```bash
# 1. 每周日运行,爬取下周活动
npm run scrape

# 2. 审核并生成发布内容 (同上)
npm run generate-post output/review_YYYY-MM-DD_HHMM.json
```

## 时间范围说明

### 本周 (current)
- **周一到周日**,以当前日期所在的周为准
- 例如: 今天是 2024年12月3日 (周二)
  - 本周范围: 2024-12-02 (周一) 到 2024-12-08 (周日)

### 下周 (next)
- **下周一到下周日**
- 例如: 今天是 2024年12月3日 (周二)
  - 下周范围: 2024-12-09 (周一) 到 2024-12-15 (周日)

## 常见问题

### Q: 我应该爬取本周还是下周?

**答**: 取决于你的发布节奏:

- **本周**: 适合即时发布,抓取当前正在进行或即将开始的活动
- **下周**: 适合提前规划,通常在周末抓取下周活动,给用户足够的准备时间

### Q: 可以同时爬取本周和下周吗?

**答**: 可以,分别运行两次命令:

```bash
# 先爬本周
npm run scrape-current-week

# 再爬下周
npm run scrape-next-week
```

两次抓取会生成不同的审核文件,互不影响。

### Q: 爬取的数据会保存在哪里?

**答**:
- **数据库**: `data/events.db` - 所有抓取的活动都会存储在这里
- **审核文件**: `output/review_*.json` - 供人工选择的候选活动
- **最终发布**: `output/final_post_*.json` - 生成的小红书发布内容

### Q: 如何验证爬取了哪些日期的活动?

**答**: 查看日志输出,会显示:

```
[Time Range] Today is: 2024-12-03 (Tuesday)
[Time Range] Current week range: 2024-12-02 to 2024-12-08
Target week (current): 2024-12-02_to_2024-12-08
```

## 环境配置

确保 `.env` 文件中配置了必要的 API keys:

```bash
# AI 提供商 (至少配置一个)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here

# 翻译提供商 (推荐 auto,自动回退)
TRANSLATOR_PROVIDER=auto
```

## 自动化建议

### 使用 GitHub Actions 每周自动爬取

可以在 `.github/workflows/scraper.yml` 中配置:

```yaml
on:
  schedule:
    # 每周日午夜 UTC (太平洋时间周六下午5点)
    - cron: '0 0 * * 0'
```

### 使用 crontab 本地定时爬取

```bash
# 编辑 crontab
crontab -e

# 每周日上午 10 点爬取下周活动
0 10 * * 0 cd /path/to/project && npm run scrape-next-week
```

## 输出示例

成功运行后会看到:

```
🚀 开始抓取湾区本周活动...

🕷️  开始并行抓取数据源...

开始抓取: Eventbrite
开始抓取: SF Station
开始抓取: Funcheap Weekend
✅ Eventbrite: 234 个活动
✅ SF Station: 89 个活动
✅ Funcheap Weekend: 156 个活动

🔍 去重后剩余 387 个活动

🌐 开始翻译活动标题...

✨ 抓取完成！
📝 请审核文件: output/review_2024-12-03_1142.json
⏭️  下一步运行: npm run generate-post "output/review_2024-12-03_1142.json"
```

---

**提示**: 如果遇到问题,可以运行 `npm run scrape -- --help` 查看完整的帮助信息。
