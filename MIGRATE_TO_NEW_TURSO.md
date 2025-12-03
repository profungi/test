# 迁移到新的 Turso 数据库（Vercel 集成）

## 背景

你在 Vercel 面板通过 Turso 集成创建了新的 Turso 数据库。现在需要：
1. 将数据从本地 SQLite 迁移到新的 Turso 数据库
2. 更新项目配置使用新的凭据

---

## 步骤 1: 拉取新的环境变量

在你的**本地 Mac** 终端运行：

```bash
cd /path/to/your/project/website
vercel env pull .env.development.local
```

这会创建 `.env.development.local` 文件，包含 Vercel 自动配置的 Turso 凭据。

查看凭据：
```bash
cat .env.development.local | grep TURSO
```

你会看到：
```
TURSO_DATABASE_URL=libsql://your-new-database.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

**记下这两个值**，后面需要用。

---

## 步骤 2: 连接到新的 Turso 数据库

### 方式 A: 使用 Vercel 提供的数据库名称

如果 Vercel 已经创建了数据库，查看数据库名称：

```bash
# 从 URL 中提取数据库名称
# 例如: libsql://vercel-bay-area-events-xxx.turso.io
# 数据库名称就是: vercel-bay-area-events-xxx
```

### 方式 B: 查看你的 Turso 数据库列表

如果你在 Vercel 面板里用的是新注册的 Turso 账号，先登录：

```bash
turso auth login
# 输入新的 Turso 账号凭据

# 列出所有数据库
turso db list
```

---

## 步骤 3: 创建表结构

在新的 Turso 数据库中创建表。

从项目根目录（`/path/to/your/project`）运行：

```bash
# 假设新数据库名称是 vercel-bay-area-events（替换成实际名称）
NEW_DB_NAME="vercel-bay-area-events"

# 导入表结构
turso db shell $NEW_DB_NAME < complete_schema.sql
```

验证表已创建：
```bash
turso db shell $NEW_DB_NAME ".tables"
# 应该看到: events  scraping_logs  user_feedback
```

---

## 步骤 4: 导出本地数据

从本地 SQLite 导出数据：

```bash
# 导出 events 表
sqlite3 data/events.db <<EOF
.output events_data.sql
.mode insert events
SELECT * FROM events;
.quit
EOF

# 导出 scraping_logs 表
sqlite3 data/events.db <<EOF
.output scraping_logs_data.sql
.mode insert scraping_logs
SELECT * FROM scraping_logs;
.quit
EOF
```

查看导出了多少数据：
```bash
wc -l events_data.sql
wc -l scraping_logs_data.sql
```

---

## 步骤 5: 导入数据到新 Turso 数据库

```bash
NEW_DB_NAME="vercel-bay-area-events"  # 替换成实际名称

# 导入 events 数据
turso db shell $NEW_DB_NAME < events_data.sql

# 导入 scraping_logs 数据
turso db shell $NEW_DB_NAME < scraping_logs_data.sql
```

验证数据已导入：
```bash
turso db shell $NEW_DB_NAME "SELECT COUNT(*) FROM events;"
turso db shell $NEW_DB_NAME "SELECT COUNT(*) FROM scraping_logs;"

# 查看最近的活动
turso db shell $NEW_DB_NAME "SELECT title, start_time, week_identifier FROM events ORDER BY scraped_at DESC LIMIT 5;"
```

---

## 步骤 6: 更新本地环境变量

更新 `website/.env.local` 使用新的凭据：

```bash
# 编辑 website/.env.local
nano website/.env.local
```

替换为新的值（从 `.env.development.local` 复制）：
```bash
TURSO_DATABASE_URL=libsql://your-new-database.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

---

## 步骤 7: 本地测试

测试本地开发环境是否正常工作：

```bash
cd website
npm run dev
```

访问 `http://localhost:3000`，确认：
- ✅ 能看到活动列表
- ✅ 活动数据正确（包含中文翻译）
- ✅ 切换语言正常

---

## 步骤 8: 部署到 Vercel

Vercel 上的环境变量已经自动配置好了（通过 Turso 集成），所以只需要 push 代码：

```bash
git push origin sculptor/setup-vercel-deployment
```

Vercel 会自动部署。

---

## 步骤 9: 验证 Vercel 部署

部署完成后：

1. **访问你的 Vercel 网站**
   - 检查是否能看到活动
   - 检查中英文切换是否正常

2. **测试 Feedback 功能**
   - 点击 👍 或 👎
   - 检查是否成功

3. **验证数据已保存**
   ```bash
   NEW_DB_NAME="vercel-bay-area-events"
   turso db shell $NEW_DB_NAME "SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 5;"
   ```

---

## 步骤 10: 配置 Scraper 使用新数据库

如果你想让 scraper 直接写入新的 Turso 数据库，更新根目录的 `.env` 文件：

```bash
# 编辑项目根目录的 .env
nano .env
```

更新：
```bash
USE_TURSO=1
TURSO_DATABASE_URL=libsql://your-new-database.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

测试 scraper：
```bash
npm run scrape
# 应该显示: 💾 数据库: Turso 云数据库
```

---

## 故障排除

### 问题 1: turso 命令找不到数据库

```bash
# 确认你登录的是正确的账号
turso auth whoami

# 如果不对，重新登录
turso auth login
```

### 问题 2: 导入数据时报错 "table already exists"

```bash
# 删除并重新创建数据库（谨慎！）
turso db destroy $NEW_DB_NAME
turso db create $NEW_DB_NAME

# 重新导入 schema
turso db shell $NEW_DB_NAME < complete_schema.sql
```

### 问题 3: Vercel 部署后仍然没有数据

检查 Vercel 环境变量：
- Settings → Environment Variables
- 确认 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN` 正确
- 确认应用于 Production, Preview, Development

然后 Redeploy：
- Deployments → 最新部署 → 右侧 "..." → Redeploy

### 问题 4: 本地开发连接新数据库失败

检查 `website/.env.local`：
```bash
cat website/.env.local | grep TURSO
```

确保 URL 和 token 正确。

---

## 清理旧文件（可选）

迁移成功后，可以删除导出的数据文件：

```bash
rm events_data.sql
rm scraping_logs_data.sql
rm .env.development.local  # 已经复制到 .env.local 了
```

---

## 总结

完成后，你的架构是：

```
Scraper (本地/GitHub Actions) → 新 Turso 数据库 ← Vercel Website
                                      ↑
                              (单一数据源)
```

- ✅ Vercel 自动配置的 Turso 数据库
- ✅ 所有数据已迁移
- ✅ Feedback 功能正常
- ✅ 本地和生产环境使用同一数据库

下次运行 scraper 时，数据会直接写入新的 Turso 数据库，Vercel 网站自动显示最新数据。
