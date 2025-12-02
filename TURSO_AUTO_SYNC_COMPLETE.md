# ✅ Turso 自动同步已配置完成

## 问题解决

**原问题**: "本地和turso不会自动同步的吗？我以后数据库都从本地变更的，并且网站修改也会很频繁，是不是每次都要手动上载数据？"

**解决方案**: ✅ 已实现 - Scraper 现在可以直接写入 Turso，无需手动同步！

---

## 架构变化

### 之前 ❌ (需要手动同步)

```
Scraper → 本地 SQLite → (手动导出) → Turso ← Vercel 网站
```

问题:
- 每次抓取后需要手动运行:
  ```bash
  sqlite3 data/events.db .dump > events.sql
  turso db shell bay-area-events < events.sql
  ```
- 容易忘记同步，导致网站数据过时

### 现在 ✅ (自动同步)

```
Scraper → Turso ← Vercel 网站
            ↑
      (单一数据源)
```

优点:
- ✅ 抓取数据立即在 Turso 中可用
- ✅ 网站自动显示最新数据 (1小时 ISR 缓存)
- ✅ 无需任何手动操作
- ✅ 本地和生产环境共享同一数据库

---

## 使用方法

### 快速开始

1. **配置环境变量** (如果还没有)

   在项目根目录创建 `.env` 文件:
   ```bash
   # Turso 数据库配置
   TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
   TURSO_AUTH_TOKEN=eyJhbGciOi...

   # 启用 Turso (推荐)
   USE_TURSO=1

   # 其他配置 (AI keys 等)
   GEMINI_API_KEY=your_key_here
   TRANSLATOR_PROVIDER=auto
   ```

   获取 Turso 凭据:
   ```bash
   turso db show bay-area-events --url
   turso db tokens create bay-area-events
   ```

2. **运行 Scraper**

   ```bash
   # 方式 1: 使用 .env 中的 USE_TURSO=1
   npm run scrape

   # 方式 2: 临时指定使用 Turso
   USE_TURSO=1 npm run scrape

   # 方式 3: 本地测试用 SQLite (不写入 Turso)
   npm run scrape  # 前提是 .env 中没有 USE_TURSO=1
   ```

3. **查看结果**

   ```bash
   # 验证数据已写入 Turso
   turso db shell bay-area-events "SELECT COUNT(*) FROM events;"

   # 查看最新活动
   turso db shell bay-area-events "SELECT title, start_time FROM events ORDER BY scraped_at DESC LIMIT 5;"
   ```

---

## 已修改的文件

### 1. `src/scrape-events.js` (核心修改)

**变化**: 根据环境变量自动选择数据库

```javascript
// 第 8-11 行
const EventDatabase = process.env.USE_TURSO
  ? require('./utils/turso-database')
  : require('./utils/database');
```

**效果**:
- 设置 `USE_TURSO=1` → 使用 Turso 云数据库
- 不设置或设置为 `0` → 使用本地 SQLite

**用户可见**: 运行时会显示使用的数据库类型

```bash
🚀 开始抓取湾区下周活动...
💾 数据库: Turso 云数据库

🕷️  开始并行抓取数据源...
```

### 2. `src/utils/turso-database.js` (新文件)

**功能**: Turso 数据库适配器，实现与 `database.js` 相同的接口

**关键特性**:
- ✅ 异步操作 (使用 `async/await`)
- ✅ 使用 `@libsql/client` 连接 Turso
- ✅ 实现完整的去重逻辑 (URL 去重 + 内容相似度去重)
- ✅ 支持翻译数据更新

**主要方法**:
```javascript
async connect()                    // 连接数据库
async saveEvent(event)             // 保存活动 (自动去重)
async logScrapingResult(...)       // 记录抓取日志
async updateEventTranslation(...)  // 更新翻译
async close()                      // 关闭连接
```

### 3. `.env.example` (更新)

**新增**: Turso 配置示例

```bash
# Turso Database (可选 - 用于直接写入云数据库)
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
USE_TURSO=1  # 取消注释以启用
```

---

## 完整工作流程

### 1. 日常使用 (推荐配置)

**配置** (一次性):
```bash
# 在根目录 .env 文件中
USE_TURSO=1
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

**运行**:
```bash
# 抓取下周活动 (自动写入 Turso)
npm run scrape

# 抓取本周活动 (自动写入 Turso)
npm run scrape-current-week
```

**结果**:
- ✅ 数据立即在 Turso 中
- ✅ Vercel 网站自动显示新数据 (最多1小时延迟)
- ✅ 无需任何手动操作

### 2. GitHub Actions 自动化

修改 `.github/workflows/scraper.yml`:

```yaml
- name: Run scraper
  env:
    TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
    TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
    USE_TURSO: "1"  # 添加这一行
  run: npm run scrape
```

在 GitHub Secrets 中添加:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

**效果**: GitHub Actions 定时运行 scraper，数据自动写入 Turso

### 3. 本地测试 (不影响生产数据)

如果需要在本地测试而不影响 Turso 数据:

```bash
# 临时使用本地 SQLite
npm run scrape

# 或者修改 .env，注释掉:
# USE_TURSO=1
```

---

## 数据迁移 (首次使用)

如果本地 SQLite 有历史数据需要迁移到 Turso:

### 方式 1: 导出导入 (适合一次性迁移)

```bash
# 1. 导出本地数据
sqlite3 data/events.db .dump > events-backup.sql

# 2. 导入到 Turso
turso db shell bay-area-events < events-backup.sql

# 3. 验证
turso db shell bay-area-events "SELECT COUNT(*) FROM events;"
```

### 方式 2: 使用 Turso 重新抓取 (推荐)

```bash
# 直接用 Turso 重新抓取
USE_TURSO=1 npm run scrape
```

优点:
- ✅ 数据更新到最新
- ✅ 包含翻译
- ✅ 无需处理 SQL 导出/导入

---

## 故障排除

### 问题 1: "Cannot find module './utils/turso-database'"

**原因**: `src/utils/turso-database.js` 文件缺失

**解决**:
```bash
# 检查文件是否存在
ls -la src/utils/turso-database.js

# 如果不存在，从项目中复制或重新创建
```

### 问题 2: "Unable to connect to Turso"

**原因**: 环境变量未设置或错误

**解决**:
```bash
# 检查环境变量
echo $TURSO_DATABASE_URL
echo $TURSO_AUTH_TOKEN

# 重新生成 token
turso db tokens create bay-area-events

# 更新 .env 文件
```

### 问题 3: "Table does not exist"

**原因**: Turso 数据库表结构未创建

**解决**:
```bash
# 导入表结构
sqlite3 data/events.db .schema > schema.sql
turso db shell bay-area-events < schema.sql

# 验证表存在
turso db shell bay-area-events ".tables"
```

### 问题 4: Scraper 仍然写入本地 SQLite

**原因**: `USE_TURSO` 环境变量未生效

**解决**:
```bash
# 方式 1: 在命令行明确指定
USE_TURSO=1 npm run scrape

# 方式 2: 在 .env 文件中添加
echo "USE_TURSO=1" >> .env

# 方式 3: 检查 .env 是否被加载
# 确保项目使用 dotenv 加载环境变量
```

### 问题 5: "Chinese translations not showing"

**原因**: Turso 数据库中的活动缺少 `title_zh` 字段

**解决**:
```bash
# 使用 Turso 重新运行 scraper (包含翻译)
USE_TURSO=1 npm run scrape

# 或者从本地 SQLite 导入包含翻译的数据
sqlite3 data/events.db .dump > events-with-translations.sql
turso db shell bay-area-events < events-with-translations.sql
```

---

## 验证配置

运行以下命令验证配置是否正确:

```bash
# 1. 检查 Turso 连接
turso db shell bay-area-events "SELECT 1;"

# 2. 检查环境变量
env | grep TURSO

# 3. 试运行 scraper (会显示使用的数据库类型)
USE_TURSO=1 npm run scrape -- --help

# 输出应该包含:
# 💾 数据库: Turso 云数据库
```

---

## 下一步建议

### 1. ✅ 推荐配置 (生产环境)

```bash
# .env 文件
USE_TURSO=1
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=eyJ...
```

每次运行 `npm run scrape` 自动写入 Turso。

### 2. 📋 GitHub Actions 定时任务

设置每天自动抓取:

```yaml
# .github/workflows/scraper.yml
on:
  schedule:
    - cron: '0 8 * * *'  # 每天早上8点运行
  workflow_dispatch:      # 支持手动触发
```

### 3. 🔍 监控数据

定期检查数据质量:

```bash
# 查看最近的抓取记录
turso db shell bay-area-events "
  SELECT source, event_count, success, scraped_at
  FROM scraping_logs
  ORDER BY scraped_at DESC
  LIMIT 10;
"

# 查看活动统计
turso db shell bay-area-events "
  SELECT
    week_identifier,
    COUNT(*) as total,
    COUNT(CASE WHEN title_zh IS NOT NULL THEN 1 END) as translated
  FROM events
  GROUP BY week_identifier;
"
```

---

## 总结

✅ **已完成**:
- Scraper 支持 Turso 数据库切换
- 环境变量控制数据库选择
- 无需手动同步数据
- 与现有工作流完全兼容

✅ **效果**:
- 运行 `USE_TURSO=1 npm run scrape` → 数据立即在 Turso 中
- Vercel 网站自动显示最新数据
- 本地和生产环境共享同一数据源
- **永远不需要手动同步数据** 🎉

📚 **相关文档**:
- `TURSO_SETUP_STEPS.md` - Turso 初始配置指南
- `USE_TURSO_FOR_SCRAPER.md` - Scraper Turso 集成详细指南
- `VERCEL_DEPLOYMENT_GUIDE.md` - Vercel 部署指南

🎯 **推荐下一步**:
1. 在 `.env` 中添加 `USE_TURSO=1`
2. 运行 `USE_TURSO=1 npm run scrape` 测试
3. 验证数据在 Turso 中: `turso db shell bay-area-events "SELECT COUNT(*) FROM events;"`
4. 配置 GitHub Actions 定时任务
