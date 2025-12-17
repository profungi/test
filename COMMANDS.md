# 📋 命令大全

本文档列出所有可用的命令和脚本，按功能分类整理。

## 📑 目录
- [主要工作流程](#主要工作流程)
- [数据库管理](#数据库管理)
- [翻译工具](#翻译工具)
- [调试和测试](#调试和测试)
- [网站开发](#网站开发)
- [工具脚本](#工具脚本)

---

## 主要工作流程

### 1. 抓取活动（第一步）

```bash
# 基本抓取（使用默认 AI provider）
npm run scrape

# 抓取本周活动
npm run scrape-current-week
# 或
npm run scrape -- --week current

# 抓取下周活动（默认）
npm run scrape-next-week
# 或
npm run scrape -- --week next

# 指定 AI provider
npm run scrape -- --ai-provider openai   # 使用 OpenAI（默认）
npm run scrape -- --ai-provider gemini   # 使用 Google Gemini
npm run scrape -- --ai-provider claude   # 使用 Anthropic Claude
npm run scrape -- --ai-provider mistral  # 使用 Mistral AI

# 使用 Turso 云数据库（生产环境）
USE_TURSO=1 npm run scrape

# 查看帮助
npm run scrape -- --help
```

**输出**: `output/review_YYYY-MM-DD_HHMM.json`

**流程**:
1. 并行抓取 Eventbrite、SF Station、Funcheap
2. 内存去重 + 过滤无效活动（节省翻译 token）
   - 过滤标题为网站域名的无效活动（如 www.sfstation.com）
3. 翻译活动标题（添加 `title_zh` 字段）
4. 生成 AI 摘要（添加 `summary_en`, `summary_zh` 字段）
5. 数据库去重和保存
6. AI 分类和优先级排序
7. 生成审核 JSON 文件

### 2. 生成小红书内容（第二步）

```bash
# 基本生成（使用审核后的 JSON 文件）
npm run generate-post "./output/review_2024-09-19_1430.json"

# 指定 AI provider
npm run generate-post "./output/review_2024-09-19_1430.json" -- --ai-provider claude
```

**输出**:
- `output/weekly_events_YYYY-MM-DD_HHMM.txt` - 小红书发布内容
- `output/weekly_events_YYYY-MM-DD_HHMM_metadata.json` - 元数据
- `output/covers/cover_YYYY-MM-DD_HHMM_XXX.png` - 封面图片

### 3. 生成英文帖子（Reddit & Nextdoor）

```bash
# 交互式生成
npm run generate-english

# 会提示你:
# 1. 输入周标识符（如: 2025-11-10_to_2025-11-16）
# 2. 选择平台（1=Reddit, 2=Nextdoor, 3=两者）
```

**输出**:
- `output/events_reddit_YYYY-MM-DD_HHMM.md` - Reddit 格式（Markdown）
- `output/events_nextdoor_YYYY-MM-DD_HHMM.txt` - Nextdoor 格式（纯文本）

---

## 数据库管理

### Turso 云数据库同步

```bash
# 从 Turso 同步到本地（增量）
npm run sync-from-turso

# 完整同步（清空本地后重新同步）
npm run sync-full

# 差异同步（同步数据并删除本地多余记录）
npm run sync-diff

# 预览同步操作（不实际修改）
npm run sync-preview

# 旧的同步命令（已弃用，使用 sync-from-turso 代替）
npm run sync-database
```

**同步模式说明**:
- `sync-from-turso`: 增量同步，只添加和更新，不删除本地多余的记录
- `sync-full`: 完整同步，先清空本地数据库再同步所有数据
- `sync-diff`: 差异同步，同步所有数据并删除 Turso 中不存在的本地记录

### 去重工具

```bash
# Turso 数据库去重（预览模式）
npm run remove-duplicates-preview
# 或
node remove-duplicates-turso.js --dry-run

# Turso 数据库去重（实际执行）
npm run remove-duplicates
# 或
USE_TURSO=1 node remove-duplicates-turso.js

# 按标题去重（而不是 URL）
npm run remove-duplicates-by-title
# 或
node remove-duplicates-turso.js --dedupe-by=normalized_title

# 本地数据库去重
node remove-duplicates-turso.js
```

### ID 迁移和修复

```bash
# 修复本地数据库 ID（使其与 Turso 一致）
node migrate-local-ids.js --confirm

# 测试 ID 迁移逻辑
node test-id-migration.js

# 修复 event_performance 表的 event_id 关联
node fix-performance-event-ids.js --confirm

# 测试性能数据去重逻辑
node test-dedup-performance.js
```

### 数据库清理

```bash
# 清空所有活动
node scripts/clear-all-events.js

# 清空下周活动
node scripts/clear-next-week-events.js

# 清空整个数据库（危险！）
node scripts/clear-database.js
```

---

## AI 摘要生成

### 批量生成摘要

为已有活动生成 AI 摘要（本周和下周）：

```bash
# 生成摘要（直接写入 Turso 数据库）
npm run generate-summaries

# 查看帮助
node generate-summaries.js --help
```

**说明**:
- 使用 NewAPI → Gemini → Mistral 的优先级顺序
- 生成中英文双语摘要
- 跳过已有摘要的活动
- 完成后运行 `npm run sync-from-turso` 同步到本地

**环境变量**:
```bash
# NewAPI（优先）
NEWAPI_API_KEY=your_key
NEWAPI_BASE_URL=https://api.newapi.pro/v1
NEWAPI_MODEL=gpt-4o-mini

# Gemini（备选）
GEMINI_API_KEY=your_key

# Mistral（备选）
MISTRAL_API_KEY=your_key
```

详细文档：[AI 摘要功能](docs/features/AI_SUMMARY_FEATURE.md)

---

## 翻译工具

### 翻译缺失的标题

```bash
# 翻译本地数据库中缺失的中文标题
npm run translate-missing
# 或
node translate-missing.js

# 翻译 Turso 数据库中缺失的中文标题
USE_TURSO=1 npm run translate-missing
# 或
USE_TURSO=1 node translate-missing.js

# 指定翻译服务
TRANSLATOR_PROVIDER=gemini node translate-missing.js
TRANSLATOR_PROVIDER=openai node translate-missing.js
```

### 翻译现有活动

```bash
# 翻译现有活动的标题
npm run translate-existing
# 或
node translate-existing-events.js
```

### 修复错误翻译

```bash
# 修复包含 "THOUGHT" 等 AI 思考过程的翻译
node fix-thought-translations.js

# 清理英文翻译（删除无效的英文翻译）
npm run clean-english-translations
# 或
node clean-english-translations.js
```

---

## 调试和测试

### AI 翻译测试

```bash
# 测试 Gemini 模型
npm run test-gemini
# 或
node test-gemini-models.js

# 测试翻译功能
npm run test-translation
# 或
node test-translation.js
```

### 数据库检查

```bash
# 检查数据库配置
npm run check-db
# 或
node scripts/check-db-config.js

# 检查环境变量
npm run check-env
# 或
bash scripts/check-env.sh

# 查看数据库内容
sqlite3 data/events.db ".tables"
sqlite3 data/events.db "SELECT * FROM events LIMIT 10;"
sqlite3 data/events.db "SELECT * FROM event_performance LIMIT 10;"
```

### 单一数据源抓取

```bash
# 只抓取 Eventbrite
npm run scrape-eventbrite
# 或
node scrape-single-source.js eventbrite

# 只抓取 Funcheap
npm run scrape-funcheap
# 或
node scrape-single-source.js funcheap

# 只抓取 SF Station
npm run scrape-sfstation
# 或
node scrape-single-source.js sfstation

# 抓取所有网站（等同于 npm run scrape）
npm run scrape-all-sites
```

---

## 网站开发

### 启动网站

```bash
# 进入网站目录
cd website

# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

**访问地址**:
- 中文版: http://localhost:3000/zh
- 英文版: http://localhost:3000/en

### 初始化反馈数据库

```bash
# 初始化反馈系统数据库表
npm run init-feedback-db
# 或
node init-feedback-db.js

# 初始化用户反馈表
npm run init-user-feedback-db
# 或
node init-user-feedback-db.js
```

### 收集反馈

```bash
# 收集用户反馈（即将推出）
npm run collect-feedback
# 或
node collect-feedback.js
```

---

## 工具脚本

### 环境验证

```bash
# 验证环境配置
npm run validate

# 运行设置脚本
node setup.js
```

### 同步测试

```bash
# 测试同步功能
bash scripts/test-sync.sh
```

### 开发模式

```bash
# 启动开发模式（监听文件变化）
npm run dev
```

---

## 环境变量

### 核心配置

```bash
# 数据库选择
USE_TURSO=1                    # 使用 Turso 云数据库（生产）
                              # 不设置则使用本地 SQLite（开发）

# Turso 数据库凭证
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=eyJ...
```

### AI 服务配置

```bash
# AI Provider 选择
AI_PROVIDER=openai            # 默认：openai
                             # 可选：gemini, claude, mistral

# 翻译服务选择
TRANSLATOR_PROVIDER=auto      # 默认：auto（自动回退）
                             # 可选：gemini, openai, mistral, google

# API Keys（至少配置一个）
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
CLAUDE_API_KEY=sk-ant-...
MISTRAL_API_KEY=...

# NewAPI（用于 AI 摘要，优先使用）
NEWAPI_API_KEY=...
NEWAPI_BASE_URL=https://api.newapi.pro/v1
NEWAPI_MODEL=gpt-4o-mini
```

### 其他服务

```bash
# Short.io 短链接服务
SHORTIO_API_KEY=...

# 环境模式
NODE_ENV=production          # 生产模式
NODE_ENV=development         # 开发模式
```

---

## 常用工作流程示例

### 场景 1: 每周抓取活动并发布到小红书

```bash
# 1. 抓取下周活动（使用 Turso 数据库）
USE_TURSO=1 npm run scrape

# 2. 人工审核
# 编辑 output/review_YYYY-MM-DD_HHMM.json
# 将想要的活动的 "selected" 改为 true

# 3. 生成小红书内容
npm run generate-post "./output/review_YYYY-MM-DD_HHMM.json"

# 4. 复制 output/weekly_events_YYYY-MM-DD_HHMM.txt 到小红书发布
```

### 场景 2: 修复本地和 Turso ID 不一致

```bash
# 1. 备份数据库（自动）
# 2. 测试迁移逻辑
node test-id-migration.js

# 3. 执行迁移
node migrate-local-ids.js --confirm

# 4. 修复 event_performance 关联
node fix-performance-event-ids.js --confirm
```

### 场景 3: 翻译缺失的中文标题

```bash
# 1. 检查 Turso 数据库中缺失翻译的活动
USE_TURSO=1 node translate-missing.js

# 2. 同步到本地
npm run sync-from-turso

# 3. 检查修复是否成功
sqlite3 data/events.db "SELECT id, title, title_zh FROM events WHERE title_zh IS NULL LIMIT 10;"
```

### 场景 4: 去重 Turso 数据库

```bash
# 1. 预览去重操作（不实际删除）
npm run remove-duplicates-preview

# 2. 确认后执行去重
npm run remove-duplicates

# 3. 同步到本地
npm run sync-from-turso
```

### 场景 5: 生成英文帖子

```bash
# 1. 查看本周活动的周标识符
sqlite3 data/events.db "SELECT DISTINCT week_identifier FROM events ORDER BY week_identifier DESC LIMIT 5;"

# 2. 生成英文帖子
npm run generate-english
# 输入周标识符（如: 2025-11-10_to_2025-11-16）
# 选择平台（1=Reddit, 2=Nextdoor, 3=两者）

# 3. 查看生成的文件
ls -lh output/events_reddit_*.md
ls -lh output/events_nextdoor_*.txt
```

---

## 故障排除命令

### 数据库问题

```bash
# 查看数据库表结构
sqlite3 data/events.db ".schema events"
sqlite3 data/events.db ".schema event_performance"

# 统计数据
sqlite3 data/events.db "SELECT COUNT(*) FROM events;"
sqlite3 data/events.db "SELECT COUNT(*) FROM event_performance;"

# 查找重复活动
sqlite3 data/events.db "SELECT original_url, COUNT(*) as count FROM events GROUP BY original_url HAVING count > 1;"
```

### 翻译问题

```bash
# 查找缺失翻译
sqlite3 data/events.db "SELECT COUNT(*) FROM events WHERE title_zh IS NULL OR title_zh = '';"

# 查找错误翻译（包含 THOUGHT 等关键词）
sqlite3 data/events.db "SELECT id, title, title_zh FROM events WHERE title_zh LIKE '%THOUGHT%' OR title_zh LIKE '%思考：%';"

# 修复错误翻译
node fix-thought-translations.js
```

### API 问题

```bash
# 测试 Gemini API
npm run test-gemini

# 测试翻译 API
npm run test-translation

# 检查环境变量
npm run check-env
```

---

## GitHub Actions

### 自动抓取配置

GitHub Actions 每周日 UTC 16:00（PST 08:00）自动运行，使用以下配置：

```yaml
env:
  USE_TURSO: 1                          # 使用 Turso 数据库
  TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
  TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
  SHORTIO_API_KEY: ${{ secrets.SHORTIO_API_KEY }}
  AI_PROVIDER: ${{ secrets.AI_PROVIDER || 'openai' }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
```

### 手动触发

1. 访问 GitHub Actions 页面
2. 选择 "Weekly Bay Area Events Scraper"
3. 点击 "Run workflow"
4. 可选：启用 debug 模式

---

## 快速参考

### 最常用命令

```bash
# 抓取活动（Turso）
USE_TURSO=1 npm run scrape

# 生成小红书内容
npm run generate-post "./output/review_*.json"

# 同步数据库
npm run sync-from-turso

# 翻译缺失标题
USE_TURSO=1 npm run translate-missing

# 启动网站
cd website && npm run dev
```

### package.json 中的所有命令

```bash
npm run start                           # 主入口（已弃用）
npm run scrape                          # 抓取下周活动
npm run scrape-current-week             # 抓取本周活动
npm run scrape-next-week                # 抓取下周活动
npm run scrape-eventbrite               # 只抓取 Eventbrite
npm run scrape-funcheap                 # 只抓取 Funcheap
npm run scrape-sfstation                # 只抓取 SF Station
npm run scrape-all-sites                # 抓取所有网站
npm run generate-post                   # 生成小红书内容
npm run generate-english                # 生成英文帖子
npm run test-english                    # 测试英文生成器
npm run test-cover                      # 测试封面生成
npm run validate                        # 验证环境
npm run dev                             # 开发模式
npm run init-feedback-db                # 初始化反馈数据库
npm run init-user-feedback-db           # 初始化用户反馈表
npm run fix-eventbrite-data             # 修复 Eventbrite 数据
npm run sync-database                   # 同步数据库（旧）
npm run sync-from-turso                 # 从 Turso 同步（增量）
npm run sync-full                       # 完整同步
npm run sync-diff                       # 差异同步（删除本地多余记录）
npm run sync-preview                    # 预览同步
npm run generate-summaries              # 生成 AI 摘要
npm run translate-missing               # 翻译缺失标题
npm run check-db                        # 检查数据库配置
npm run check-env                       # 检查环境变量
npm run collect-feedback                # 收集反馈
npm run translate-existing              # 翻译现有活动
npm run clean-english-translations      # 清理英文翻译
npm run test-gemini                     # 测试 Gemini
npm run test-translation                # 测试翻译
npm run remove-duplicates               # 去重（Turso）
npm run remove-duplicates-preview       # 去重预览
npm run remove-duplicates-by-title      # 按标题去重
```

---

## 文档参考

- **README.md**: 项目总览和快速开始
- **ARCHITECTURE.md**: 系统架构详解
- **COMMANDS.md**: 本文档，命令大全
- **docs/**: 详细功能文档
  - `DATA_ARCHITECTURE.md`: 数据架构
  - `DATABASE_CONFIG.md`: 数据库配置
  - `TRANSLATION_GUIDE.md`: 翻译指南
  - `features/AI_SUMMARY_FEATURE.md`: AI 摘要功能
  - `features/USER_FEEDBACK_DOCUMENTATION.md`: 用户反馈功能

---

**最后更新**: 2024-12-17
