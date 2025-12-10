# 数据架构与同步策略

## 📊 数据分层

### 1. **Events 表**（活动数据）- 云端主库
```
Turso (主) ⟷ Local SQLite (副本)
```

**用途**: 存储抓取的活动信息
- ✅ **写入**: Scraper（在本地 Mac 运行，写入 Turso）
- ✅ **读取**: Website（从 Turso）、generate-post（从本地）
- ✅ **同步**: Turso → Local（单向）

**字段**:
```sql
id, title, title_zh, start_time, end_time, location, price,
description, description_detail, original_url, short_url,
source, event_type, priority, scraped_at, week_identifier
```

### 2. **Feedback 表**（反馈数据）- 本地独有
```
Local SQLite (唯一)
```

**用途**: 存储发布记录和表现数据
- ✅ **写入**: generate-post（本地运行）
- ✅ **读取**: 分析脚本（本地）
- ❌ **不同步**: 本地独有，永不上传到云端

**三个表**:
1. `posts` - 发布记录
2. `event_performance` - 活动表现（点击、点赞、收藏等）
3. `weight_adjustments` - AI 权重调整历史

### 3. **Review 文件**（临时文件）- 本地文件系统
```
./output/review_*.json
```

**用途**: Scraper 输出 → 人工审核 → generate-post 输入
- ✅ **创建**: Scraper
- ✅ **编辑**: 人工审核（选择活动）
- ✅ **读取**: generate-post
- ❌ **不需要同步**: 临时文件，用完可删除

## 🔄 推荐工作流程

### 基于你的需求：在本地 Mac 运行所有工具

```
┌─────────────────────────────────────────────────────────────┐
│  本地 Mac (你的开发机)                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Scraper (USE_TURSO=1)                                   │
│     ├─ 抓取活动                                              │
│     ├─ AI 分类                                               │
│     ├─ 翻译标题                                              │
│     └─ 保存到 Turso ──────────┐                             │
│                                │                             │
│  2. Sync (node sync-from-turso.js)                          │
│     └─ 从 Turso 同步 ←─────────┘                            │
│                                │                             │
│  3. Generate Post (本地 SQLite) │                            │
│     ├─ 读取 review 文件 ←──────┘                            │
│     ├─ 生成短链接                                            │
│     ├─ 生成发布内容                                          │
│     └─ 保存 feedback 数据 (本地)                             │
│                                                              │
│  4. Website (USE_TURSO=1)                                   │
│     └─ 从 Turso 读取活动数据                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘

       │                           │
       │                           │
       └────────── Turso ──────────┘
                 (云端主库)
```

## 🎯 推荐配置

### 本地 Mac 的 `.env` 文件

```bash
# 使用 Turso 作为主数据库
USE_TURSO=1
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...

# 翻译服务
TRANSLATOR_PROVIDER=auto
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Short.io (用于生成短链接)
SHORTIO_API_KEY=your_key_here
SHORTIO_DOMAIN=your_domain
```

### 容器的 `.env` 文件（可选）

如果你想在容器里运行，可以使用同样的配置。但基于你说"不想在容器里运行，太慢"，建议只在本地 Mac 运行。

## 🚀 使用步骤

### 步骤 1: 抓取活动（每周一次）

```bash
# 在本地 Mac 运行
node src/scrape-events.js

# 输出:
# - 活动保存到 Turso
# - 生成 review_*.json 文件在 ./output/
```

### 步骤 2: 同步到本地（可选）

```bash
# 如果 generate-post 需要从本地读取
node sync-from-turso.js

# 或者在 scraper 完成后自动同步
node src/scrape-events.js && node sync-from-turso.js
```

### 步骤 3: 人工审核

编辑 `./output/review_*.json`，将想发布的活动的 `selected` 改为 `true`

### 步骤 4: 生成发布内容

```bash
# 方式 1: 指定 review 文件
node src/generate-post.js ./output/review_2025-12-09.json

# 方式 2: 交互式选择
node src/generate-post.js

# 输出:
# - 生成发布内容
# - 创建短链接
# - 保存 feedback 数据到本地
```

### 步骤 5: 发布并收集反馈

1. 复制生成的内容到小红书
2. 手动收集 Short.io 点击数据
3. 手动收集小红书互动数据
4. 运行反馈收集脚本（如果有）

## 🔧 同步工具使用

### 基本用法

```bash
# 增量同步（默认，推荐）
node sync-from-turso.js

# 全量同步（重建本地数据库）
node sync-from-turso.js --full

# 预览模式（不实际写入）
node sync-from-turso.js --dry-run

# 只同步指定日期后的数据
node sync-from-turso.js --since 2025-12-01
```

### 同步策略

**增量同步**（推荐）:
- 基于 `scraped_at` 字段
- 只同步上次同步后的新数据
- 快速、安全

**全量同步**:
- 清空本地 events 表
- 重新导入所有 Turso 数据
- 用于修复数据不一致

**重要**: 同步**只影响 events 表**，不会触碰 feedback 表！

## ❓ FAQ

### Q: 为什么 feedback 数据不同步？

A: Feedback 数据是基于你本地发布和收集的反馈，具有本地独特性：
- 每个人的发布账号不同
- 短链接不同
- 反馈数据独立
- 不需要也不应该同步到云端

### Q: 如果我在多台机器上工作怎么办？

A:
- **Events 数据**: 通过 Turso 自动共享
- **Feedback 数据**: 每台机器独立，不共享
- **Review 文件**: 通过 Git 或其他方式手动同步

### Q: Website 应该从哪里读取数据？

A:
- **部署在 Vercel 等云平台**: 使用 Turso（快速、无需同步）
- **本地开发**: 可以用本地 SQLite（需要先同步）

推荐生产环境直接用 Turso，无需同步。

### Q: 什么时候需要同步？

A: 仅当你需要在本地使用 events 数据时：
1. generate-post 从本地读取
2. 本地分析脚本需要访问
3. 离线工作需要数据

如果 generate-post 可以从 Turso 读取，可以完全不需要同步。

### Q: 同步会覆盖我的 feedback 数据吗？

A: **不会！** 同步脚本只操作 `events` 表，完全不触碰：
- `posts`
- `event_performance`
- `weight_adjustments`

你的 feedback 数据是安全的。

### Q: 我应该多久同步一次？

A: 建议：
- **手动触发**: 当你需要运行 generate-post 之前
- **自动触发**: 在 scraper 完成后自动运行
- **不需要**: 如果 generate-post 直接从 Turso 读取

### Q: 同步失败怎么办？

A: 检查：
1. `.env` 中 Turso 配置是否正确
2. 网络连接是否正常
3. Turso 数据库是否可访问
4. 运行 `node sync-from-turso.js --dry-run` 预览

## 🎨 架构优势

### 当前设计的优点

1. **数据分离**:
   - 共享数据（events）在云端
   - 私有数据（feedback）在本地
   - 清晰明确，不会混淆

2. **灵活性**:
   - 可以在任何机器运行 scraper
   - Website 直接访问云端数据
   - 本地保留完整的发布历史

3. **安全性**:
   - Feedback 数据不会被意外覆盖
   - 同步是单向的，不会反向污染
   - 本地和云端职责清晰

4. **性能**:
   - Website 从 Turso 读取（快速）
   - 本地操作无需网络（快速）
   - 按需同步，不浪费资源

## 🔮 未来可能的改进

1. **自动触发同步**: 在 scraper 完成后自动运行同步
2. **增量推送**: 将本地的 short_url 推送回 Turso
3. **Webhook 通知**: Turso 数据更新时自动通知本地同步
4. **可视化面板**: 查看同步状态和数据统计

但目前的单向同步方案已经足够简单和可靠！
