# 快速入门指南

## 📋 常用命令

### 数据库配置
```bash
# 检查当前数据库配置
npm run check-db

# 检查环境变量
npm run check-env
```

### 抓取活动
```bash
# 抓取下周活动（默认）
npm run scrape

# 抓取本周活动
npm run scrape-current-week

# 抓取下周活动
npm run scrape-next-week
```

### 翻译管理
```bash
# 翻译数据库中缺失的中文标题
npm run translate-missing

# 使用特定翻译服务
TRANSLATOR_PROVIDER=openai npm run translate-missing
```

### 数据同步
```bash
# 增量同步（从 Turso 同步到本地）
npm run sync-from-turso

# 全量同步（重建本地数据库）
npm run sync-full

# 预览同步（不实际写入）
npm run sync-preview
```

### 生成发布内容
```bash
# 交互式生成
npm run generate-post

# 指定 review 文件
npm run generate-post ./output/review_2025-12-09.json
```

## 🔧 推荐工作流程

### 方案 A: 全部使用 Turso（推荐）

```bash
# 1. 配置 .env
cat > .env << EOF
USE_TURSO=1
TURSO_DATABASE_URL=你的_turso_url
TURSO_AUTH_TOKEN=你的_token
TRANSLATOR_PROVIDER=auto
GEMINI_API_KEY=你的_key
EOF

# 2. 抓取活动（写入 Turso）
npm run scrape

# 3. 翻译缺失的标题（更新 Turso）
npm run translate-missing

# 4. 生成发布内容（从 Turso 读取）
npm run generate-post

# 5. Website 部署（从 Turso 读取）
cd website && npm run build
```

### 方案 B: 使用本地数据库

```bash
# 1. 不设置 USE_TURSO，或者注释掉
# .env 文件中删除或注释: # USE_TURSO=1

# 2. 抓取活动（写入本地）
npm run scrape

# 3. 翻译缺失的标题（更新本地）
npm run translate-missing

# 4. 生成发布内容（从本地读取）
npm run generate-post
```

### 方案 C: 混合模式（Scraper 用 Turso，本地工作需要同步）

```bash
# 1. 在 .env 中设置 USE_TURSO=1

# 2. 抓取活动（写入 Turso）
npm run scrape

# 3. 同步到本地（供本地工具使用）
npm run sync-from-turso

# 4. 生成发布内容（从本地读取）
# 临时切换到本地数据库
USE_TURSO= npm run generate-post

# 或者修改 generate-post 也支持 Turso
```

## 🎯 每周发布流程

```bash
# 周一：抓取下周活动
npm run scrape

# 检查翻译是否完整
npm run check-db

# 如有缺失，翻译
npm run translate-missing

# （可选）同步到本地
npm run sync-from-turso

# 人工审核
# 编辑 ./output/review_*.json 文件
# 将想发布的活动 selected 改为 true

# 生成发布内容
npm run generate-post

# 复制内容到小红书发布

# 收集反馈数据（一周后）
npm run collect-feedback
```

## 📊 数据库说明

### Events 表（活动数据）
- **主库**: Turso（云端）
- **副本**: Local SQLite（本地）
- **同步**: 单向 Turso → Local
- **用途**: 存储抓取的活动信息

### User Feedback 表（用户反馈数据）
- **主库**: Turso（云端）
- **副本**: Local SQLite（本地）
- **同步**: 单向 Turso → Local
- **用途**: 存储网站用户的点赞和反馈
- **来源**: Website 用户交互

### 本地独有 Feedback 表
- **位置**: Local SQLite（仅本地）
- **不同步**: 本地独有数据
- **用途**: 发布记录（posts）、点击数据（event_performance）、AI 权重调整（weight_adjustments）

### Review 文件
- **位置**: `./output/review_*.json`
- **用途**: 人工审核临时文件
- **不需要同步**: 用完可删除

## 🔍 故障排除

### 问题: scraper 使用了错误的数据库

**检查配置**:
```bash
npm run check-db
```

**解决方案**:
- 确认 `.env` 文件中 `USE_TURSO` 的设置
- 确认 Turso 配置正确（URL 和 Token）

### 问题: 翻译失败（速率限制）

**解决方案**:
```bash
# 使用更慢的速率（脚本自动处理）
npm run translate-missing

# 或切换到 OpenAI
TRANSLATOR_PROVIDER=openai npm run translate-missing
```

### 问题: 同步失败

**检查连接**:
```bash
# 预览模式测试
npm run sync-preview
```

**解决方案**:
- 确认 Turso 配置正确
- 检查网络连接
- 查看错误信息

### 问题: Feedback 数据丢失

**确认**:
Feedback 数据只在本地，不会被同步覆盖。

**检查**:
```bash
sqlite3 data/events.db "SELECT COUNT(*) FROM posts;"
sqlite3 data/events.db "SELECT COUNT(*) FROM event_performance;"
```

## 📚 更多文档

- [数据架构详解](./DATA_ARCHITECTURE.md)
- [数据库配置指南](./DATABASE_CONFIG.md)
- [翻译指南](./TRANSLATION_GUIDE.md)
- [主 README](./README.md)

## 💡 小贴士

1. **首次使用**: 运行 `npm run check-db` 确认配置
2. **定期同步**: 每周 scrape 后同步一次即可
3. **备份数据**: Feedback 数据很重要，定期备份本地数据库
4. **测试翻译**: 先用 `--dry-run` 预览同步结果
5. **查看日志**: Scraper 和同步都有详细的进度日志

## ⚡ 快捷命令速查

| 命令 | 说明 |
|------|------|
| `npm run scrape` | 抓取活动 |
| `npm run translate-missing` | 翻译缺失标题 |
| `npm run sync-from-turso` | 同步数据 |
| `npm run generate-post` | 生成发布内容 |
| `npm run check-db` | 检查配置 |
| `npm run sync-preview` | 预览同步 |
| `npm run sync-full` | 全量同步 |

## 🚀 开始使用

```bash
# 1. 检查配置
npm run check-db

# 2. 抓取活动
npm run scrape

# 3. 查看结果
ls -lh output/review_*.json

# 4. 开始工作！
```
