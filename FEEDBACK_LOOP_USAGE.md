# 反馈闭环系统使用指南

> 本文档说明如何使用反馈闭环系统来优化活动推荐

---

## 📋 快速开始

### 前置要求

- ✅ 已完成基础系统的安装和配置
- ✅ 数据库文件存在: `./data/events.db`
- ✅ 至少发布过1次活动内容

### 安装步骤

#### 1. 初始化反馈系统数据库

```bash
npm run init-feedback-db
```

这会创建以下表:
- `posts` - 发布记录表
- `event_performance` - 活动表现记录表
- `weight_adjustments` - 权重调整历史表

**输出示例**:
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

📌 Schema版本: 1.0.0
   应用时间: 2025-11-01T12:00:00.000Z
   说明: Initial feedback loop schema

✨ 反馈系统数据库初始化完成！

💡 下一步:
   1. 运行 npm run generate-post 生成发布内容
   2. 发布后运行 npm run collect-feedback <post_id> 收集反馈
```

---

## 🔄 完整工作流程

### Phase 1: 生成发布内容 (自动记录)

#### 方式A: 交互式选择 (v1.5 新功能, 推荐)

如果你经常需要多次爬取才能凑够活动数量，使用交互式模式：

```bash
# 不带任何参数，启动交互式选择
npm run generate-post
```

系统会自动：
1. 扫描 `./output` 目录的所有 review 文件
2. 按活动时间范围 (`target_week`) 分组
3. 显示交互界面让你选择要生成的时间段
4. 自动合并多个 review 文件
5. 使用 80% title 相似度 + 地点匹配算法去重
6. 生成帖子并记录来源信息

**交互界面示例**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 发现以下周的爬取记录:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【第1组: 11/10 - 11/16】
  ✓ review_2025-11-03_1341.json
    爬取时间: 11/03 21:41 | 活动数: 38
  ✓ review_2025-11-03_1430.json
    爬取时间: 11/03 14:30 | 活动数: 25

【第2组: 11/17 - 11/23】
  ✓ review_2025-11-10_0900.json
    爬取时间: 11/10 09:00 | 活动数: 42

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请选择要生成帖子的时间段 [1-2]: 1

✅ 已选择「11/10 - 11/16」的 2 个review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 合并和去重结果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 来源review文件数: 2
📝 合并前活动总数: 63
🔄 去重后活动总数: 58
❌ 移除重复活动数: 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 准备生成帖子，共 58 个活动
```

#### 方式B: 单文件模式 (传统方式)

```bash
# 指定单个review文件
npm run generate-post ./output/review_2025-11-04_1530.json
```

**新增输出**:
```
... (原有的内容生成过程) ...

📊 发布记录已创建:
   Post ID: post_2025-11-04T15-30
   包含 8 个活动
   来源: 2 个review文件 (合并帖子)  ← v1.5 新增

✨ 内容生成完成！
📄 发布内容: ./output/weekly_events_2025-11-04_1530.txt
📱 现在可以复制内容到小红书发布了！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 下一步操作
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 📱 将内容发布到小红书
2. ⏰ 等待 2-3 天收集用户反馈
3. 📊 运行反馈收集: npm run collect-feedback post_2025-11-04T15-30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**幕后发生了什么**:
1. ✅ 在 `posts` 表创建发布记录
2. ✅ 记录来源 review 文件信息 (v1.5 新增)
3. ✅ 为每个活动在 `event_performance` 表创建记录
4. ✅ 记录每个活动的来源 review 和来源网站 (v1.5 新增)
5. ✅ 初始 `engagement_score` 设为 0
6. ✅ 记录所有活动的元数据 (类型、地点、价格等)

### Phase 2: 发布到小红书

1. 复制生成的文本到小红书
2. 上传封面图片
3. 发布
4. **记录小红书帖子URL** (后续需要)

### Phase 3: 收集反馈数据 (开发中)

**即将推出** - Sprint 2

```bash
npm run collect-feedback post_2025-11-04T15-30
```

交互式界面将引导你输入:
- Short.io 点击数据
- 小红书互动数据 (点赞/收藏/评论/分享)

### Phase 4: 分析反馈 (开发中)

**即将推出** - Sprint 3

```bash
npm run analyze-feedback --posts 4
```

生成详细分析报告，包括:
- 整体表现统计
- 按活动类型分析
- 按地理位置分析
- 按价格区间分析
- 权重调整建议

### Phase 5: 调整权重 (开发中)

**即将推出** - Sprint 4

```bash
npm run adjust-weights
```

根据分析报告自动调整权重，优化下次抓取。

---

## 🗄️ 数据库结构

### Posts 表

存储每次发布的基本信息

| 字段 | 类型 | 说明 |
|------|------|------|
| post_id | TEXT | 发布ID，如 `post_2025-11-04T15-30` |
| published_at | TEXT | 发布时间 (ISO 8601) |
| week_identifier | TEXT | 周标识，如 `2025-11-04_to_2025-11-10` |
| total_events | INTEGER | 包含的活动数量 |
| review_file_path | TEXT | 原审核文件路径 |
| output_file_path | TEXT | 生成的内容文件路径 |
| cover_image_path | TEXT | 封面图片路径 |
| xiaohongshu_url | TEXT | 小红书帖子链接 (可选) |
| **source_reviews** | **TEXT** | **v1.5: 来源review文件 (JSON数组)** |
| **is_merged_post** | **INTEGER** | **v1.5: 是否为合并帖子 (0/1)** |

**查询示例**:
```sql
-- 查看最近5次发布
SELECT post_id, published_at, total_events
FROM posts
ORDER BY published_at DESC
LIMIT 5;
```

### Event_Performance 表

存储每个活动的表现数据

| 字段 | 类型 | 说明 |
|------|------|------|
| post_id | TEXT | 关联的发布ID |
| event_title | TEXT | 活动标题 |
| event_type | TEXT | 活动类型 (market/festival/food等) |
| location_category | TEXT | 地理类别 (sanfrancisco/southbay等) |
| price_category | TEXT | 价格类别 (free/paid/expensive) |
| shortio_clicks | INTEGER | Short.io 点击次数 |
| xiaohongshu_likes | INTEGER | 小红书点赞数 |
| xiaohongshu_favorites | INTEGER | 小红书收藏数 |
| xiaohongshu_comments | INTEGER | 小红书评论数 |
| xiaohongshu_shares | INTEGER | 小红书分享数 |
| engagement_score | REAL | 综合参与度分数 |
| **source_review** | **TEXT** | **v1.5: 来源review文件名** |
| **source_website** | **TEXT** | **v1.5: 来源网站 (eventbrite/funcheap等)** |

**Engagement Score 计算公式**:
```
engagement_score =
  (shortio_clicks × 5.0) +
  (xiaohongshu_comments × 3.0) +
  (xiaohongshu_likes × 2.0) +
  (xiaohongshu_favorites × 2.0) +
  (xiaohongshu_shares × 4.0)
```

**查询示例**:
```sql
-- 查看某次发布的所有活动表现
SELECT
  event_title,
  event_type,
  shortio_clicks,
  xiaohongshu_likes,
  engagement_score
FROM event_performance
WHERE post_id = 'post_2025-11-04T15-30'
ORDER BY engagement_score DESC;
```

### Weight_Adjustments 表

存储权重调整历史

| 字段 | 类型 | 说明 |
|------|------|------|
| adjustment_id | TEXT | 调整ID |
| adjusted_at | TEXT | 调整时间 |
| based_on_posts | INTEGER | 基于多少次发布 |
| based_on_events | INTEGER | 基于多少个活动 |
| adjustments_json | TEXT | 详细调整内容 (JSON) |
| is_applied | INTEGER | 是否已应用 |

---

## 🔍 手动查询示例

### 查看所有发布记录

```bash
sqlite3 ./data/events.db "
SELECT
  post_id,
  published_at,
  total_events,
  week_identifier
FROM posts
ORDER BY published_at DESC;
"
```

### 查看活动表现排名

```bash
sqlite3 ./data/events.db "
SELECT
  event_title,
  event_type,
  location_category,
  engagement_score,
  shortio_clicks
FROM event_performance
WHERE engagement_score > 0
ORDER BY engagement_score DESC
LIMIT 10;
"
```

### 按类型统计表现

```bash
sqlite3 ./data/events.db "
SELECT * FROM v_type_performance_ranking;
"
```

---

## ⚙️ 配置说明

### 自动初始化

从 `generate-post.js` v1.1 开始，反馈系统会自动初始化:
- 首次运行时自动创建表结构
- 每次生成内容时自动保存发布记录
- 无需手动干预

### 数据存储

所有数据存储在: `./data/events.db`

数据库大小估算:
- 每次发布: ~2KB
- 每个活动记录: ~0.5KB
- 100次发布 (800个活动): ~600KB

### 备份

建议定期备份数据库:

```bash
# 备份数据库
cp ./data/events.db ./data/events_backup_$(date +%Y%m%d).db

# 导出CSV
sqlite3 -header -csv ./data/events.db "SELECT * FROM event_performance;" > performance_data.csv
```

---

## 🐛 故障排除

### 问题1: 发布记录保存失败

**错误信息**:
```
⚠️  保存发布记录失败: no such table: posts
   这不影响内容生成，但无法记录反馈数据
```

**解决方法**:
```bash
# 手动初始化数据库
npm run init-feedback-db
```

### 问题2: 查看数据库表是否存在

```bash
sqlite3 ./data/events.db ".tables"
```

应该看到:
```
event_performance  posts              weight_adjustments
events             scraping_logs
```

### 问题3: Schema版本检查

```bash
sqlite3 ./data/events.db "SELECT * FROM schema_version;"
```

输出:
```
1.0.0|2025-11-01T12:00:00.000Z|Initial feedback loop schema
```

---

## 📊 开发路线图

### ✅ Sprint 1 - 完成
- [x] 数据库Schema设计
- [x] performance-database.js 模块
- [x] generate-post.js 集成发布记录
- [x] 自动记录发布和活动数据

### ✅ Sprint 1.5 - 完成
- [x] 多review文件合并功能
- [x] 交互式review选择界面
- [x] 活动去重算法 (80% title + 地点)
- [x] 来源追踪系统 (review文件 + 网站)
- [x] 数据库扩展 (v1.5)

### 🚧 Sprint 2 - 进行中
- [ ] collect-feedback.js 交互式收集工具
- [ ] Short.io 点击数据输入
- [ ] 小红书互动数据输入
- [ ] 数据验证和保存

### 📅 Sprint 3 - 计划中
- [ ] analyze-feedback.js 分析引擎
- [ ] 生成分析报告
- [ ] 多维度统计
- [ ] 权重调整建议

### 📅 Sprint 4 - 计划中
- [ ] adjust-weights.js 权重调整器
- [ ] config-dynamic.json 动态配置
- [ ] 应用权重到抓取流程
- [ ] 完整闭环验证

---

## 💡 最佳实践

### 1. 数据收集频率

- **建议**: 发布后等待 2-3 天再收集反馈
- **原因**: 用户互动需要时间积累
- **最佳时机**: 发布后第3天晚上

### 2. 样本量要求

- **最小发布次数**: 4次
- **推荐发布次数**: 8次以上
- **时间跨度**: 至少1个月

### 3. 权重调整策略

- **初期 (1-3次发布)**: 不调整，收集基线数据
- **中期 (4-7次发布)**: 小幅调整 (±10%)
- **成熟期 (8次以上)**: 可以大幅调整 (±20%)

### 4. 数据质量

- ✅ 确保 Short.io 点击数据准确
- ✅ 从小红书APP直接查看互动数据
- ✅ 标记异常发布 (如发布时间不佳)
- ✅ 定期清理测试数据

---

## 📞 支持

遇到问题？

1. 查看 [FEEDBACK_LOOP_DESIGN.md](./FEEDBACK_LOOP_DESIGN.md) 详细设计文档
2. 查看 [ARCHITECTURE.md](./ARCHITECTURE.md) 系统架构
3. 提交 Issue 到 GitHub 仓库

---

**最后更新**: 2025-11-04
**文档版本**: v1.5
**新增功能**: 多review合并、交互式选择、活动去重、来源追踪
# 反馈闭环系统使用指南

> 本文档说明如何使用反馈闭环系统来优化活动推荐

---

## 📋 快速开始

### 前置要求

- ✅ 已完成基础系统的安装和配置
- ✅ 数据库文件存在: `./data/events.db`
- ✅ 至少发布过1次活动内容

### 安装步骤

#### 1. 初始化反馈系统数据库

```bash
npm run init-feedback-db
```

这会创建以下表:
- `posts` - 发布记录表
- `event_performance` - 活动表现记录表
- `weight_adjustments` - 权重调整历史表

**输出示例**:
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

📌 Schema版本: 1.0.0
   应用时间: 2025-11-01T12:00:00.000Z
   说明: Initial feedback loop schema

✨ 反馈系统数据库初始化完成！

💡 下一步:
   1. 运行 npm run generate-post 生成发布内容
   2. 发布后运行 npm run collect-feedback <post_id> 收集反馈
```

---

## 🔄 完整工作流程

### Phase 1: 生成发布内容 (自动记录)

#### 方式A: 交互式选择 (v1.5 新功能, 推荐)

如果你经常需要多次爬取才能凑够活动数量，使用交互式模式：

```bash
# 不带任何参数，启动交互式选择
npm run generate-post
```

系统会自动：
1. 扫描 `./output` 目录的所有 review 文件
2. 按活动时间范围 (`target_week`) 分组
3. 显示交互界面让你选择要生成的时间段
4. 自动合并多个 review 文件
5. 使用 80% title 相似度 + 地点匹配算法去重
6. 生成帖子并记录来源信息

**交互界面示例**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 发现以下周的爬取记录:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【第1组: 11/10 - 11/16】
  ✓ review_2025-11-03_1341.json
    爬取时间: 11/03 21:41 | 活动数: 38
  ✓ review_2025-11-03_1430.json
    爬取时间: 11/03 14:30 | 活动数: 25

【第2组: 11/17 - 11/23】
  ✓ review_2025-11-10_0900.json
    爬取时间: 11/10 09:00 | 活动数: 42

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请选择要生成帖子的时间段 [1-2]: 1

✅ 已选择「11/10 - 11/16」的 2 个review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 合并和去重结果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 来源review文件数: 2
📝 合并前活动总数: 63
🔄 去重后活动总数: 58
❌ 移除重复活动数: 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 准备生成帖子，共 58 个活动
```

#### 方式B: 单文件模式 (传统方式)

```bash
# 指定单个review文件
npm run generate-post ./output/review_2025-11-04_1530.json
```

**新增输出**:
```
... (原有的内容生成过程) ...

📊 发布记录已创建:
   Post ID: post_2025-11-04T15-30
   包含 8 个活动
   来源: 2 个review文件 (合并帖子)  ← v1.5 新增

✨ 内容生成完成！
📄 发布内容: ./output/weekly_events_2025-11-04_1530.txt
📱 现在可以复制内容到小红书发布了！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 下一步操作
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 📱 将内容发布到小红书
2. ⏰ 等待 2-3 天收集用户反馈
3. 📊 运行反馈收集: npm run collect-feedback post_2025-11-04T15-30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**幕后发生了什么**:
1. ✅ 在 `posts` 表创建发布记录
2. ✅ 记录来源 review 文件信息 (v1.5 新增)
3. ✅ 为每个活动在 `event_performance` 表创建记录
4. ✅ 记录每个活动的来源 review 和来源网站 (v1.5 新增)
5. ✅ 初始 `engagement_score` 设为 0
6. ✅ 记录所有活动的元数据 (类型、地点、价格等)

### Phase 2: 发布到小红书

1. 复制生成的文本到小红书
2. 上传封面图片
3. 发布
4. **记录小红书帖子URL** (后续需要)

### Phase 3: 收集反馈数据 (开发中)

**即将推出** - Sprint 2

```bash
npm run collect-feedback post_2025-11-04T15-30
```

交互式界面将引导你输入:
- Short.io 点击数据
- 小红书互动数据 (点赞/收藏/评论/分享)

### Phase 4: 分析反馈 (开发中)

**即将推出** - Sprint 3

```bash
npm run analyze-feedback --posts 4
```

生成详细分析报告，包括:
- 整体表现统计
- 按活动类型分析
- 按地理位置分析
- 按价格区间分析
- 权重调整建议

### Phase 5: 调整权重 (开发中)

**即将推出** - Sprint 4

```bash
npm run adjust-weights
```

根据分析报告自动调整权重，优化下次抓取。

---

## 🗄️ 数据库结构

### Posts 表

存储每次发布的基本信息

| 字段 | 类型 | 说明 |
|------|------|------|
| post_id | TEXT | 发布ID，如 `post_2025-11-04T15-30` |
| published_at | TEXT | 发布时间 (ISO 8601) |
| week_identifier | TEXT | 周标识，如 `2025-11-04_to_2025-11-10` |
| total_events | INTEGER | 包含的活动数量 |
| review_file_path | TEXT | 原审核文件路径 |
| output_file_path | TEXT | 生成的内容文件路径 |
| cover_image_path | TEXT | 封面图片路径 |
| xiaohongshu_url | TEXT | 小红书帖子链接 (可选) |
| **source_reviews** | **TEXT** | **v1.5: 来源review文件 (JSON数组)** |
| **is_merged_post** | **INTEGER** | **v1.5: 是否为合并帖子 (0/1)** |

**查询示例**:
```sql
-- 查看最近5次发布
SELECT post_id, published_at, total_events
FROM posts
ORDER BY published_at DESC
LIMIT 5;
```

### Event_Performance 表

存储每个活动的表现数据

| 字段 | 类型 | 说明 |
|------|------|------|
| post_id | TEXT | 关联的发布ID |
| event_title | TEXT | 活动标题 |
| event_type | TEXT | 活动类型 (market/festival/food等) |
| location_category | TEXT | 地理类别 (sanfrancisco/southbay等) |
| price_category | TEXT | 价格类别 (free/paid/expensive) |
| shortio_clicks | INTEGER | Short.io 点击次数 |
| xiaohongshu_likes | INTEGER | 小红书点赞数 |
| xiaohongshu_favorites | INTEGER | 小红书收藏数 |
| xiaohongshu_comments | INTEGER | 小红书评论数 |
| xiaohongshu_shares | INTEGER | 小红书分享数 |
| engagement_score | REAL | 综合参与度分数 |
| **source_review** | **TEXT** | **v1.5: 来源review文件名** |
| **source_website** | **TEXT** | **v1.5: 来源网站 (eventbrite/funcheap等)** |

**Engagement Score 计算公式**:
```
engagement_score =
  (shortio_clicks × 5.0) +
  (xiaohongshu_comments × 3.0) +
  (xiaohongshu_likes × 2.0) +
  (xiaohongshu_favorites × 2.0) +
  (xiaohongshu_shares × 4.0)
```

**查询示例**:
```sql
-- 查看某次发布的所有活动表现
SELECT
  event_title,
  event_type,
  shortio_clicks,
  xiaohongshu_likes,
  engagement_score
FROM event_performance
WHERE post_id = 'post_2025-11-04T15-30'
ORDER BY engagement_score DESC;
```

### Weight_Adjustments 表

存储权重调整历史

| 字段 | 类型 | 说明 |
|------|------|------|
| adjustment_id | TEXT | 调整ID |
| adjusted_at | TEXT | 调整时间 |
| based_on_posts | INTEGER | 基于多少次发布 |
| based_on_events | INTEGER | 基于多少个活动 |
| adjustments_json | TEXT | 详细调整内容 (JSON) |
| is_applied | INTEGER | 是否已应用 |

---

## 🔍 手动查询示例

### 查看所有发布记录

```bash
sqlite3 ./data/events.db "
SELECT
  post_id,
  published_at,
  total_events,
  week_identifier
FROM posts
ORDER BY published_at DESC;
"
```

### 查看活动表现排名

```bash
sqlite3 ./data/events.db "
SELECT
  event_title,
  event_type,
  location_category,
  engagement_score,
  shortio_clicks
FROM event_performance
WHERE engagement_score > 0
ORDER BY engagement_score DESC
LIMIT 10;
"
```

### 按类型统计表现

```bash
sqlite3 ./data/events.db "
SELECT * FROM v_type_performance_ranking;
"
```

---

## ⚙️ 配置说明

### 自动初始化

从 `generate-post.js` v1.1 开始，反馈系统会自动初始化:
- 首次运行时自动创建表结构
- 每次生成内容时自动保存发布记录
- 无需手动干预

### 数据存储

所有数据存储在: `./data/events.db`

数据库大小估算:
- 每次发布: ~2KB
- 每个活动记录: ~0.5KB
- 100次发布 (800个活动): ~600KB

### 备份

建议定期备份数据库:

```bash
# 备份数据库
cp ./data/events.db ./data/events_backup_$(date +%Y%m%d).db

# 导出CSV
sqlite3 -header -csv ./data/events.db "SELECT * FROM event_performance;" > performance_data.csv
```

---

## 🐛 故障排除

### 问题1: 发布记录保存失败

**错误信息**:
```
⚠️  保存发布记录失败: no such table: posts
   这不影响内容生成，但无法记录反馈数据
```

**解决方法**:
```bash
# 手动初始化数据库
npm run init-feedback-db
```

### 问题2: 查看数据库表是否存在

```bash
sqlite3 ./data/events.db ".tables"
```

应该看到:
```
event_performance  posts              weight_adjustments
events             scraping_logs
```

### 问题3: Schema版本检查

```bash
sqlite3 ./data/events.db "SELECT * FROM schema_version;"
```

输出:
```
1.0.0|2025-11-01T12:00:00.000Z|Initial feedback loop schema
```

---

## 📊 开发路线图

### ✅ Sprint 1 - 完成
- [x] 数据库Schema设计
- [x] performance-database.js 模块
- [x] generate-post.js 集成发布记录
- [x] 自动记录发布和活动数据

### ✅ Sprint 1.5 - 完成
- [x] 多review文件合并功能
- [x] 交互式review选择界面
- [x] 活动去重算法 (80% title + 地点)
- [x] 来源追踪系统 (review文件 + 网站)
- [x] 数据库扩展 (v1.5)

### 🚧 Sprint 2 - 进行中
- [ ] collect-feedback.js 交互式收集工具
- [ ] Short.io 点击数据输入
- [ ] 小红书互动数据输入
- [ ] 数据验证和保存

### 📅 Sprint 3 - 计划中
- [ ] analyze-feedback.js 分析引擎
- [ ] 生成分析报告
- [ ] 多维度统计
- [ ] 权重调整建议

### 📅 Sprint 4 - 计划中
- [ ] adjust-weights.js 权重调整器
- [ ] config-dynamic.json 动态配置
- [ ] 应用权重到抓取流程
- [ ] 完整闭环验证

---

## 💡 最佳实践

### 1. 数据收集频率

- **建议**: 发布后等待 2-3 天再收集反馈
- **原因**: 用户互动需要时间积累
- **最佳时机**: 发布后第3天晚上

### 2. 样本量要求

- **最小发布次数**: 4次
- **推荐发布次数**: 8次以上
- **时间跨度**: 至少1个月

### 3. 权重调整策略

- **初期 (1-3次发布)**: 不调整，收集基线数据
- **中期 (4-7次发布)**: 小幅调整 (±10%)
- **成熟期 (8次以上)**: 可以大幅调整 (±20%)

### 4. 数据质量

- ✅ 确保 Short.io 点击数据准确
- ✅ 从小红书APP直接查看互动数据
- ✅ 标记异常发布 (如发布时间不佳)
- ✅ 定期清理测试数据

---

## 📞 支持

遇到问题？

1. 查看 [FEEDBACK_LOOP_DESIGN.md](./FEEDBACK_LOOP_DESIGN.md) 详细设计文档
2. 查看 [ARCHITECTURE.md](./ARCHITECTURE.md) 系统架构
3. 提交 Issue 到 GitHub 仓库

---

**最后更新**: 2025-11-04
**文档版本**: v1.5
**新增功能**: 多review合并、交互式选择、活动去重、来源追踪
# 反馈闭环系统使用指南

> 本文档说明如何使用反馈闭环系统来优化活动推荐

---

## 📋 快速开始

### 前置要求

- ✅ 已完成基础系统的安装和配置
- ✅ 数据库文件存在: `./data/events.db`
- ✅ 至少发布过1次活动内容

### 安装步骤

#### 1. 初始化反馈系统数据库

```bash
npm run init-feedback-db
```

这会创建以下表:
- `posts` - 发布记录表
- `event_performance` - 活动表现记录表
- `weight_adjustments` - 权重调整历史表

**输出示例**:
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

📌 Schema版本: 1.0.0
   应用时间: 2025-11-01T12:00:00.000Z
   说明: Initial feedback loop schema

✨ 反馈系统数据库初始化完成！

💡 下一步:
   1. 运行 npm run generate-post 生成发布内容
   2. 发布后运行 npm run collect-feedback <post_id> 收集反馈
```

---

## 🔄 完整工作流程

### Phase 1: 生成发布内容 (自动记录)

#### 方式A: 交互式选择 (v1.5 新功能, 推荐)

如果你经常需要多次爬取才能凑够活动数量，使用交互式模式：

```bash
# 不带任何参数，启动交互式选择
npm run generate-post
```

系统会自动：
1. 扫描 `./output` 目录的所有 review 文件
2. 按活动时间范围 (`target_week`) 分组
3. 显示交互界面让你选择要生成的时间段
4. 自动合并多个 review 文件
5. 使用 80% title 相似度 + 地点匹配算法去重
6. 生成帖子并记录来源信息

**交互界面示例**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 发现以下周的爬取记录:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【第1组: 11/10 - 11/16】
  ✓ review_2025-11-03_1341.json
    爬取时间: 11/03 21:41 | 活动数: 38
  ✓ review_2025-11-03_1430.json
    爬取时间: 11/03 14:30 | 活动数: 25

【第2组: 11/17 - 11/23】
  ✓ review_2025-11-10_0900.json
    爬取时间: 11/10 09:00 | 活动数: 42

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请选择要生成帖子的时间段 [1-2]: 1

✅ 已选择「11/10 - 11/16」的 2 个review

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 合并和去重结果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 来源review文件数: 2
📝 合并前活动总数: 63
🔄 去重后活动总数: 58
❌ 移除重复活动数: 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 准备生成帖子，共 58 个活动
```

#### 方式B: 单文件模式 (传统方式)

```bash
# 指定单个review文件
npm run generate-post ./output/review_2025-11-04_1530.json
```

**新增输出**:
```
... (原有的内容生成过程) ...

📊 发布记录已创建:
   Post ID: post_2025-11-04T15-30
   包含 8 个活动
   来源: 2 个review文件 (合并帖子)  ← v1.5 新增

✨ 内容生成完成！
📄 发布内容: ./output/weekly_events_2025-11-04_1530.txt
📱 现在可以复制内容到小红书发布了！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 下一步操作
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 📱 将内容发布到小红书
2. ⏰ 等待 2-3 天收集用户反馈
3. 📊 运行反馈收集: npm run collect-feedback post_2025-11-04T15-30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**幕后发生了什么**:
1. ✅ 在 `posts` 表创建发布记录
2. ✅ 记录来源 review 文件信息 (v1.5 新增)
3. ✅ 为每个活动在 `event_performance` 表创建记录
4. ✅ 记录每个活动的来源 review 和来源网站 (v1.5 新增)
5. ✅ 初始 `engagement_score` 设为 0
6. ✅ 记录所有活动的元数据 (类型、地点、价格等)

### Phase 2: 发布到小红书

1. 复制生成的文本到小红书
2. 上传封面图片
3. 发布
4. **记录小红书帖子URL** (后续需要)

### Phase 3: 收集反馈数据 (开发中)

**即将推出** - Sprint 2

```bash
npm run collect-feedback post_2025-11-04T15-30
```

交互式界面将引导你输入:
- Short.io 点击数据
- 小红书互动数据 (点赞/收藏/评论/分享)

### Phase 4: 分析反馈 (开发中)

**即将推出** - Sprint 3

```bash
npm run analyze-feedback --posts 4
```

生成详细分析报告，包括:
- 整体表现统计
- 按活动类型分析
- 按地理位置分析
- 按价格区间分析
- 权重调整建议

### Phase 5: 调整权重 (开发中)

**即将推出** - Sprint 4

```bash
npm run adjust-weights
```

根据分析报告自动调整权重，优化下次抓取。

---

## 🗄️ 数据库结构

### Posts 表

存储每次发布的基本信息

| 字段 | 类型 | 说明 |
|------|------|------|
| post_id | TEXT | 发布ID，如 `post_2025-11-04T15-30` |
| published_at | TEXT | 发布时间 (ISO 8601) |
| week_identifier | TEXT | 周标识，如 `2025-11-04_to_2025-11-10` |
| total_events | INTEGER | 包含的活动数量 |
| review_file_path | TEXT | 原审核文件路径 |
| output_file_path | TEXT | 生成的内容文件路径 |
| cover_image_path | TEXT | 封面图片路径 |
| xiaohongshu_url | TEXT | 小红书帖子链接 (可选) |
| **source_reviews** | **TEXT** | **v1.5: 来源review文件 (JSON数组)** |
| **is_merged_post** | **INTEGER** | **v1.5: 是否为合并帖子 (0/1)** |

**查询示例**:
```sql
-- 查看最近5次发布
SELECT post_id, published_at, total_events
FROM posts
ORDER BY published_at DESC
LIMIT 5;
```

### Event_Performance 表

存储每个活动的表现数据

| 字段 | 类型 | 说明 |
|------|------|------|
| post_id | TEXT | 关联的发布ID |
| event_title | TEXT | 活动标题 |
| event_type | TEXT | 活动类型 (market/festival/food等) |
| location_category | TEXT | 地理类别 (sanfrancisco/southbay等) |
| price_category | TEXT | 价格类别 (free/paid/expensive) |
| shortio_clicks | INTEGER | Short.io 点击次数 |
| xiaohongshu_likes | INTEGER | 小红书点赞数 |
| xiaohongshu_favorites | INTEGER | 小红书收藏数 |
| xiaohongshu_comments | INTEGER | 小红书评论数 |
| xiaohongshu_shares | INTEGER | 小红书分享数 |
| engagement_score | REAL | 综合参与度分数 |
| **source_review** | **TEXT** | **v1.5: 来源review文件名** |
| **source_website** | **TEXT** | **v1.5: 来源网站 (eventbrite/funcheap等)** |

**Engagement Score 计算公式**:
```
engagement_score =
  (shortio_clicks × 5.0) +
  (xiaohongshu_comments × 3.0) +
  (xiaohongshu_likes × 2.0) +
  (xiaohongshu_favorites × 2.0) +
  (xiaohongshu_shares × 4.0)
```

**查询示例**:
```sql
-- 查看某次发布的所有活动表现
SELECT
  event_title,
  event_type,
  shortio_clicks,
  xiaohongshu_likes,
  engagement_score
FROM event_performance
WHERE post_id = 'post_2025-11-04T15-30'
ORDER BY engagement_score DESC;
```

### Weight_Adjustments 表

存储权重调整历史

| 字段 | 类型 | 说明 |
|------|------|------|
| adjustment_id | TEXT | 调整ID |
| adjusted_at | TEXT | 调整时间 |
| based_on_posts | INTEGER | 基于多少次发布 |
| based_on_events | INTEGER | 基于多少个活动 |
| adjustments_json | TEXT | 详细调整内容 (JSON) |
| is_applied | INTEGER | 是否已应用 |

---

## 🔍 手动查询示例

### 查看所有发布记录

```bash
sqlite3 ./data/events.db "
SELECT
  post_id,
  published_at,
  total_events,
  week_identifier
FROM posts
ORDER BY published_at DESC;
"
```

### 查看活动表现排名

```bash
sqlite3 ./data/events.db "
SELECT
  event_title,
  event_type,
  location_category,
  engagement_score,
  shortio_clicks
FROM event_performance
WHERE engagement_score > 0
ORDER BY engagement_score DESC
LIMIT 10;
"
```

### 按类型统计表现

```bash
sqlite3 ./data/events.db "
SELECT * FROM v_type_performance_ranking;
"
```

---

## ⚙️ 配置说明

### 自动初始化

从 `generate-post.js` v1.1 开始，反馈系统会自动初始化:
- 首次运行时自动创建表结构
- 每次生成内容时自动保存发布记录
- 无需手动干预

### 数据存储

所有数据存储在: `./data/events.db`

数据库大小估算:
- 每次发布: ~2KB
- 每个活动记录: ~0.5KB
- 100次发布 (800个活动): ~600KB

### 备份

建议定期备份数据库:

```bash
# 备份数据库
cp ./data/events.db ./data/events_backup_$(date +%Y%m%d).db

# 导出CSV
sqlite3 -header -csv ./data/events.db "SELECT * FROM event_performance;" > performance_data.csv
```

---

## 🐛 故障排除

### 问题1: 发布记录保存失败

**错误信息**:
```
⚠️  保存发布记录失败: no such table: posts
   这不影响内容生成，但无法记录反馈数据
```

**解决方法**:
```bash
# 手动初始化数据库
npm run init-feedback-db
```

### 问题2: 查看数据库表是否存在

```bash
sqlite3 ./data/events.db ".tables"
```

应该看到:
```
event_performance  posts              weight_adjustments
events             scraping_logs
```

### 问题3: Schema版本检查

```bash
sqlite3 ./data/events.db "SELECT * FROM schema_version;"
```

输出:
```
1.0.0|2025-11-01T12:00:00.000Z|Initial feedback loop schema
```

---

## 📊 开发路线图

### ✅ Sprint 1 - 完成
- [x] 数据库Schema设计
- [x] performance-database.js 模块
- [x] generate-post.js 集成发布记录
- [x] 自动记录发布和活动数据

### ✅ Sprint 1.5 - 完成
- [x] 多review文件合并功能
- [x] 交互式review选择界面
- [x] 活动去重算法 (80% title + 地点)
- [x] 来源追踪系统 (review文件 + 网站)
- [x] 数据库扩展 (v1.5)

### 🚧 Sprint 2 - 进行中
- [ ] collect-feedback.js 交互式收集工具
- [ ] Short.io 点击数据输入
- [ ] 小红书互动数据输入
- [ ] 数据验证和保存

### 📅 Sprint 3 - 计划中
- [ ] analyze-feedback.js 分析引擎
- [ ] 生成分析报告
- [ ] 多维度统计
- [ ] 权重调整建议

### 📅 Sprint 4 - 计划中
- [ ] adjust-weights.js 权重调整器
- [ ] config-dynamic.json 动态配置
- [ ] 应用权重到抓取流程
- [ ] 完整闭环验证

---

## 💡 最佳实践

### 1. 数据收集频率

- **建议**: 发布后等待 2-3 天再收集反馈
- **原因**: 用户互动需要时间积累
- **最佳时机**: 发布后第3天晚上

### 2. 样本量要求

- **最小发布次数**: 4次
- **推荐发布次数**: 8次以上
- **时间跨度**: 至少1个月

### 3. 权重调整策略

- **初期 (1-3次发布)**: 不调整，收集基线数据
- **中期 (4-7次发布)**: 小幅调整 (±10%)
- **成熟期 (8次以上)**: 可以大幅调整 (±20%)

### 4. 数据质量

- ✅ 确保 Short.io 点击数据准确
- ✅ 从小红书APP直接查看互动数据
- ✅ 标记异常发布 (如发布时间不佳)
- ✅ 定期清理测试数据

---

## 📞 支持

遇到问题？

1. 查看 [FEEDBACK_LOOP_DESIGN.md](./FEEDBACK_LOOP_DESIGN.md) 详细设计文档
2. 查看 [ARCHITECTURE.md](./ARCHITECTURE.md) 系统架构
3. 提交 Issue 到 GitHub 仓库

---

**最后更新**: 2025-11-04
**文档版本**: v1.5
**新增功能**: 多review合并、交互式选择、活动去重、来源追踪
