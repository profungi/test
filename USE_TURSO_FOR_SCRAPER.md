# 配置 Scraper 使用 Turso 数据库

## 为什么需要这个改动？

**问题**: 本地 SQLite 和 Turso 不会自动同步，每次爬取数据后需要手动导入到 Turso。

**解决方案**: 让 Scraper 直接写入 Turso，实现自动同步。

---

## 配置步骤

### 1. 安装 Turso 客户端库

```bash
# 在项目根目录
npm install @libsql/client
```

### 2. 配置环境变量

在根目录的 `.env` 文件中添加（如果还没有）:

```bash
# Turso 数据库配置
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...

# 翻译 API (保持原有配置)
GEMINI_API_KEY=your_key_here
TRANSLATOR_PROVIDER=auto
```

### 3. 修改 scraper 使用 Turso

✅ **已完成配置** - scraper 已支持 Turso 数据库切换！

`src/scrape-events.js` 现在会根据环境变量自动选择数据库:

```javascript
// 根据环境变量选择数据库: Turso (生产) 或 SQLite (本地测试)
const EventDatabase = process.env.USE_TURSO
  ? require('./utils/turso-database')
  : require('./utils/database');
```

**使用方法:**

```bash
# 写入 Turso 云数据库 (推荐)
USE_TURSO=1 npm run scrape

# 写入本地 SQLite (测试用)
npm run scrape
```

**永久启用 Turso:**

在根目录的 `.env` 文件中添加:
```bash
USE_TURSO=1
```

这样每次运行 `npm run scrape` 都会直接写入 Turso。

---

## 工作流程

### 新的工作流程 ✅

```
1. 运行 scraper → 直接写入 Turso
   npm run scrape

2. 数据立即在 Turso 中可用

3. Vercel 网站自动显示新数据 (1小时 ISR 缓存)
```

### 旧的工作流程 ❌ (不再需要)

```
1. 运行 scraper → 写入本地 SQLite
2. 导出数据: sqlite3 data/events.db .dump > events.sql
3. 导入 Turso: turso db shell bay-area-events < events.sql
4. 等待 Vercel ISR 缓存刷新
```

---

## 初次迁移

如果这是第一次切换到 Turso，需要：

### 1. 确保 Turso 中有表结构

```bash
# 如果还没有导入过数据，先导入一次
sqlite3 data/events.db .dump > initial-schema.sql
turso db shell bay-area-events < initial-schema.sql
```

### 2. 验证表结构

```bash
turso db shell bay-area-events ".tables"
turso db shell bay-area-events ".schema events"
```

应该看到 `events` 和 `scraping_logs` 表。

### 3. 测试 Scraper

```bash
# 使用 Turso 运行一次测试
USE_TURSO=1 npm run scrape

# 验证数据
turso db shell bay-area-events "SELECT COUNT(*) FROM events;"
```

---

## GitHub Actions 配置

如果使用 GitHub Actions 自动运行 scraper:

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

并在 GitHub Secrets 中添加:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

---

## 本地开发 vs 生产环境

### 策略 1: 完全使用 Turso (推荐)

**优点**:
- ✅ 本地和生产完全一致
- ✅ 无需手动同步
- ✅ 可以多台电脑共享数据

**缺点**:
- ⚠️  需要网络连接

**配置**:
```bash
# .env
USE_TURSO=1
```

### 策略 2: 本地用 SQLite，生产用 Turso

**优点**:
- ✅ 本地开发快速（无网络延迟）
- ✅ 离线开发

**缺点**:
- ❌ 需要手动同步数据到 Turso
- ❌ 本地和生产数据可能不一致

**配置**:
```bash
# 本地开发
npm run scrape  # 使用 SQLite

# 部署到生产前
sqlite3 data/events.db .dump > sync.sql
turso db shell bay-area-events < sync.sql
```

---

## 故障排除

### 问题 1: "Unable to connect to Turso"

检查环境变量:
```bash
echo $TURSO_DATABASE_URL
echo $TURSO_AUTH_TOKEN
```

重新生成 token:
```bash
turso db tokens create bay-area-events
```

### 问题 2: "Table does not exist"

运行 schema 迁移:
```bash
sqlite3 data/events.db .schema > schema.sql
turso db shell bay-area-events < schema.sql
```

### 问题 3: 数据重复

Turso 版本的去重逻辑已实现，使用相同的算法。

---

## 推荐配置

**最佳实践**:

1. ✅ Scraper 直接写入 Turso (`USE_TURSO=1`)
2. ✅ GitHub Actions 使用 Turso
3. ✅ 本地测试也使用 Turso（保持一致性）
4. ✅ 保留本地 SQLite 仅用于备份

这样你就**永远不需要手动同步数据**了！🎉
