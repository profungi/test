# 🎯 Bay Area Events Scraper - 命令参考手册

> 最后更新：2025-11-05
> 版本：v1.5 (支持多review合并 + 交互式活动替换)

---

## 📋 目录

- [核心工作流程](#核心工作流程)
- [主要命令](#主要命令)
- [测试命令](#测试命令)
- [数据库命令](#数据库命令)
- [高级选项](#高级选项)
- [快速参考表](#快速参考表)

---

## 🔄 核心工作流程

### 标准流程

```bash
# 第1步：抓取活动
npm run scrape

# 第2步：手动审核 (编辑 ./output/review_*.json)
# 将想要发布的活动的 "selected" 改为 true

# 第3步：生成帖子 (两种方式)

## 方式A：交互式模式 (推荐，支持多review合并)
npm run generate-post

## 方式B：单文件模式
npm run generate-post ./output/review_2025-11-05_1430.json

# 第4步：发布到小红书
# 复制生成的内容到小红书，上传封面图片
```

### 反馈闭环流程 (可选)

```bash
# 初始化反馈数据库 (首次使用)
npm run init-feedback-db

# 生成帖子时自动记录到数据库
npm run generate-post

# 发布后收集反馈 (Sprint 2 - 开发中)
npm run collect-feedback post_2025-11-05T15-30

# 分析反馈数据 (Sprint 3 - 计划中)
npm run analyze-feedback --posts 4

# 调整权重优化 (Sprint 4 - 计划中)
npm run adjust-weights
```

---

## 📝 主要命令

### 1. 抓取活动

#### 方式A：抓取所有网站 - `npm run scrape`

**功能**：从所有网站抓取湾区活动信息，生成 review 文件供人工审核

**数据源**：
- Eventbrite
- Funcheap (周末免费活动)
- SF Station

**输出**：
- `./output/review_YYYY-MM-DD_HHMM.json` - 审核文件
- 包含 AI 分类、优先级评分、中文相关性判断

**使用示例**：
```bash
# 抓取所有网站
npm run scrape
# 或
npm run scrape-all-sites

# 抓取时指定 AI 提供商
npm run scrape -- --ai-provider gemini
npm run scrape -- --ai-provider claude
npm run scrape -- --ai-provider mistral
```

**抓取配置**：
- 时间范围：下周 (从下周一到下周日)
- 地理范围：Bay Area (SF, Oakland, San Jose 等)
- AI 分析：活动类型、优先级、中文相关性

---

#### 方式B：抓取单个数据源 (新功能)

**功能**：只从指定网站抓取，快速补充活动

**使用场景**：
- ✅ 备选活动不够，需要快速补充
- ✅ 只想要某一类活动（如免费活动）
- ✅ 调试特定 scraper

**命令**：

```bash
# 抓取 Eventbrite (推荐，活动质量高)
npm run scrape-eventbrite

# 抓取 Funcheap (免费活动多)
npm run scrape-funcheap

# 抓取 SF Station (本地活动)
npm run scrape-sfstation
```

**工作流程**：
1. 抓取指定网站的活动
2. AI 分类和去重
3. 生成 review 文件
4. 在 review 文件中标记 `selected: true`
5. 运行 `npm run generate-post`
6. **系统会自动合并本周的所有 review 文件**

**示例**：
```bash
# 第1次：抓取所有网站
npm run scrape
# → review_2025-11-05_1000.json (选了5个活动)

# 发现活动不够，快速补充
npm run scrape-funcheap
# → review_2025-11-05_1430.json (又选了3个)

# 生成帖子（自动合并）
npm run generate-post
# 系统自动合并同一周的2个review文件
```

---

### 2. 生成帖子 - `npm run generate-post`

**功能**：读取审核文件，生成短链接，翻译优化，输出小红书发布内容

#### 方式A：交互式模式 (v1.5 新功能，推荐)

```bash
npm run generate-post
```

**交互流程**：
1. 自动扫描 `./output` 目录的所有 review 文件
2. 按活动时间范围 (target_week) 分组显示
3. 选择要生成的时间段
4. 自动合并多个 review 文件
5. **智能去重** (80% title 相似度 + 地点匹配)
6. **最终确认界面** - 可以微调活动选择：
   - 移除不想要的活动
   - 从备选列表添加活动
   - 输入 `scrape` 查看如何抓取更多活动
7. 生成短链接和翻译内容

**示例输出**：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 已选择的活动 (8 个)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1. ✓ [music] SF Jazz Festival
    📍 San Francisco | 💰 Free | 📅 Saturday 11/10
...

💡 操作:
  • 继续: Enter  • 移除: 输入序号 (如: 2)  • 取消: n
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请选择: 2

✅ 已移除 1 个活动

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 可添加的备选活动 (15 个，按优先级排序)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [food] Oakland Night Market
   📍 Oakland Chinatown | 💰 Free | 📅 Friday 11/09 | ⭐ 8.8
...

添加备选活动? [序号/n/scrape]: 1
```

#### 方式B：单文件模式 (传统方式)

```bash
npm run generate-post ./output/review_2025-11-05_1430.json
```

**适用场景**：
- 只有一个 review 文件
- 不需要合并多个抓取结果

#### 高级选项

```bash
# 指定 AI 提供商
npm run generate-post -- --ai-provider gemini
npm run generate-post ./output/review_XXX.json --ai-provider claude

# 查看帮助
npm run generate-post -- --help
```

**输出文件**：
- `./output/weekly_events_YYYY-MM-DD_HHMM.txt` - 小红书发布内容
- `./output/cover_YYYY-MM-DD_HHMM.jpg` - 封面图片

**功能亮点**：
- ✅ 自动生成 Short.io 短链接
- ✅ AI 翻译优化（中文，适合小红书风格）
- ✅ 自动生成封面图片
- ✅ **自动记录到反馈数据库**
- ✅ **v1.5: 多 review 合并去重**
- ✅ **v1.5: 交互式活动替换**

---

### 3. 初始化反馈数据库 - `npm run init-feedback-db`

**功能**：初始化反馈闭环系统的数据库表结构

**使用场景**：
- 首次使用反馈系统
- 需要重新初始化数据库

**创建的表**：
- `posts` - 发布记录
- `event_performance` - 活动表现数据
- `weight_adjustments` - 权重调整历史
- `schema_version` - Schema 版本管理

**创建的视图**：
- `v_event_performance_summary` - 活动表现汇总
- `v_type_performance_ranking` - 类型表现排名

```bash
npm run init-feedback-db
```

**输出示例**：
```
🚀 开始初始化反馈系统数据库...

📊 连接到性能数据库
✅ 反馈系统表结构初始化完成

📋 验证表结构...
✅ 已创建的表:
   - event_performance
   - posts
   - weight_adjustments

✅ 已创建的视图:
   - v_event_performance_summary
   - v_type_performance_ranking

📌 Schema版本: 1.5
```

**注意**：
- `generate-post` 会自动初始化反馈系统
- 如果数据库已存在，会自动执行迁移

---

### 4. 验证环境 - `npm run validate`

**功能**：检查环境变量配置是否正确

```bash
npm run validate
```

**检查项目**：
- ✅ SHORTIO_API_KEY
- ✅ OPENAI_API_KEY (或其他 AI 提供商)
- ✅ GEMINI_API_KEY (可选)
- ✅ CLAUDE_API_KEY (可选)
- ✅ MISTRAL_API_KEY (可选)

---

## 🧪 测试命令

### 1. 测试封面生成 - `npm run test-cover`

**功能**：测试封面图片生成功能

```bash
npm run test-cover
```

**输出**：`./test_cover.jpg`

---

### 2. 测试最终选择界面 - `node test-final-selection.js`

**功能**：测试交互式活动替换功能 (v1.5 新功能)

```bash
node test-final-selection.js
```

**测试场景**：
- 3 个已选择的活动
- 4 个备选活动
- 测试移除功能
- 测试添加功能
- 测试 scrape 提示

---

### 3. 测试 Funcheap Scraper - `node test-funcheap-only.js`

**功能**：单独测试 Funcheap 抓取器

```bash
node test-funcheap-only.js
```

**用途**：调试 Funcheap 抓取问题

---

### 4. 测试类型定向抓取 - `node test-category-search.js` (v1.6 新功能)

**功能**：测试按类型（food-and-drink, festivals-fairs, holiday）定向抓取

```bash
node test-category-search.js
```

**测试内容**：
- 测试 Saratoga 的三种类型搜索
- 验证 French Holiday Market 是否能被找到
- 检查类型搜索 URL 是否有效

**示例输出**：
```
🧪 测试 Saratoga 类型定向抓取

🔍 测试类型: Food & Drink
📍 URL: https://www.eventbrite.com/d/ca--saratoga/food-and-drink--events/?start_date_keyword=next_week

✅ 找到 6 个 Food & Drink 活动:

1. French Holiday Market
   📍 Saratoga, CA
   📅 2025-11-15T18:00:00.000Z
   💰 Free
   🔗 https://www.eventbrite.com/e/french-holiday-market-tickets-1902205561039
   🎉🎉🎉 找到了！French Holiday Market！

🎯 SUCCESS: French Holiday Market 已找到！
```

---

## 💾 数据库命令

### 查看发布记录

```bash
sqlite3 ./data/events.db "
SELECT post_id, published_at, total_events, week_identifier
FROM posts
ORDER BY published_at DESC
LIMIT 5;
"
```

### 查看活动表现

```bash
sqlite3 ./data/events.db "
SELECT event_title, event_type, engagement_score, shortio_clicks
FROM event_performance
WHERE engagement_score > 0
ORDER BY engagement_score DESC
LIMIT 10;
"
```

### 查看类型表现排名

```bash
sqlite3 ./data/events.db "
SELECT * FROM v_type_performance_ranking;
"
```

### 查看 Schema 版本

```bash
sqlite3 ./data/events.db "
SELECT version, applied_at, description
FROM schema_version
ORDER BY applied_at DESC;
"
```

### 备份数据库

```bash
# 备份
cp ./data/events.db ./data/events_backup_$(date +%Y%m%d).db

# 导出 CSV
sqlite3 -header -csv ./data/events.db \
  "SELECT * FROM event_performance;" > performance_data.csv
```

---

## ⚙️ 高级选项

### AI 提供商选择

支持的 AI 提供商：
- `openai` - OpenAI GPT (默认)
- `gemini` - Google Gemini
- `claude` - Anthropic Claude
- `mistral` - Mistral AI

**使用方法**：

```bash
# 抓取时指定
npm run scrape -- --ai-provider gemini

# 生成帖子时指定
npm run generate-post -- --ai-provider claude
npm run generate-post ./output/review_XXX.json --ai-provider mistral

# 通过环境变量设置默认值
export AI_PROVIDER=gemini
npm run scrape
```

### 环境变量

在 `.env` 文件中配置：

```bash
# 必需
SHORTIO_API_KEY=your_shortio_key
OPENAI_API_KEY=your_openai_key

# 可选 (其他 AI 提供商)
GEMINI_API_KEY=your_gemini_key
CLAUDE_API_KEY=your_claude_key
MISTRAL_API_KEY=your_mistral_key

# 默认 AI 提供商
AI_PROVIDER=openai

# Short.io 配置
SHORTIO_DOMAIN=your_domain.short.gy
```

---

## 📊 快速参考表

| 命令 | 功能 | 输入 | 输出 |
|------|------|------|------|
| `npm run scrape` | 抓取所有网站 | - | `review_*.json` |
| `npm run scrape-all-sites` | 抓取所有网站 (别名) | - | `review_*.json` |
| `npm run scrape-eventbrite` | 只抓取 Eventbrite | - | `review_*.json` |
| `npm run scrape-funcheap` | 只抓取 Funcheap | - | `review_*.json` |
| `npm run scrape-sfstation` | 只抓取 SF Station | - | `review_*.json` |
| `npm run generate-post` | 生成帖子 (交互) | review 文件 | `weekly_events_*.txt` |
| `npm run generate-post <file>` | 生成帖子 (单文件) | review 文件路径 | `weekly_events_*.txt` |
| `npm run init-feedback-db` | 初始化数据库 | - | 数据库表 |
| `npm run validate` | 验证环境 | - | 环境检查结果 |
| `npm run test-cover` | 测试封面 | - | `test_cover.jpg` |
| `node test-final-selection.js` | 测试交互界面 | - | 交互测试 |

---

## 🎯 典型使用场景

### 场景1：每周发布流程

```bash
# 周一：抓取下周活动
npm run scrape

# 周二：审核并标记活动
# (编辑 review_*.json，设置 selected: true)

# 周三：生成帖子
npm run generate-post

# 在交互界面：
# 1. 选择时间段
# 2. 查看去重结果
# 3. 微调活动选择 (移除/添加)
# 4. 确认生成

# 周三：发布到小红书
# (复制内容 + 上传封面)
```

### 场景2：活动不够需要多次抓取

```bash
# 第1次抓取
npm run scrape
# 输出: review_2025-11-05_1000.json (30个活动)

# 选择了 5 个，还不够

# 第2次抓取
npm run scrape
# 输出: review_2025-11-05_1400.json (25个活动)

# 选择了 4 个

# 生成帖子 (自动合并)
npm run generate-post
# 系统会自动：
# 1. 找到同一周的 2 个 review
# 2. 合并已选择的 9 个活动
# 3. 智能去重
# 4. 最终确认
```

### 场景3：临时替换活动

```bash
# 生成帖子
npm run generate-post

# 在最终确认界面：
# 输入: 2  (移除第2个活动)
# 输入: 1  (从备选添加第1个)
# 输入: Enter (确认生成)

# 无需回去修改 review 文件！
```

### 场景4：备选不够需要重新抓取

```bash
# 生成帖子
npm run generate-post

# 在添加备选界面：
# 输入: scrape

# 系统显示提示：
# "npm run scrape-eventbrite"

# 按 Ctrl+C 退出
# 运行抓取命令
npm run scrape

# 标记新活动
# 重新生成
npm run generate-post
# 系统会自动合并所有 review
```

---

## 🔧 故障排除

### 问题1: 命令找不到

```bash
# 确认在项目根目录
pwd

# 重新安装依赖
npm install
```

### 问题2: 环境变量未配置

```bash
# 检查环境
npm run validate

# 创建 .env 文件
cp .env.example .env
# 编辑 .env 填入你的 API 密钥
```

### 问题3: 数据库表不存在

```bash
# 重新初始化
npm run init-feedback-db

# 或删除数据库重建
rm ./data/events.db
npm run init-feedback-db
```

### 问题4: 抓取失败

```bash
# 检查网络连接
curl -I https://www.eventbrite.com

# 查看错误日志
npm run scrape 2>&1 | tee scrape.log
```

---

## 📚 相关文档

- [README.md](./README.md) - 项目概述
- [FEEDBACK_LOOP_USAGE.md](./FEEDBACK_LOOP_USAGE.md) - 反馈闭环使用指南
- [FEEDBACK_LOOP_DESIGN.md](./FEEDBACK_LOOP_DESIGN.md) - 反馈闭环设计文档
- [SPRINT1.5_SUMMARY.md](./SPRINT1.5_SUMMARY.md) - v1.5 功能总结

---

## 💡 提示和技巧

1. **多次抓取策略**：如果一次抓取活动不够，直接再运行一次 `npm run scrape`，系统会自动合并

2. **优先级排序**：备选活动按 `priority` 分数排序，优先选择高分活动

3. **去重算法**：Title 相似度 ≥ 80% 且地点匹配，视为重复活动

4. **数据来源追踪**：v1.5 会记录每个活动来自哪个 review 文件和哪个网站，方便后续分析

5. **快捷键**：
   - `Enter` = 确认继续
   - `n` = 取消操作
   - `scrape` = 查看抓取提示

6. **批量操作**：
   - 移除多个：`1,3,5` 或 `1 3 5`
   - 添加多个：`1,2` 或 `1 2`

---

**版本历史**：
- v1.0 - 基础抓取和生成功能
- v1.5 - 多review合并、智能去重、交互式活动替换
- v2.0 (计划) - 反馈收集、分析和权重调整

**最后更新**: 2025-11-05
