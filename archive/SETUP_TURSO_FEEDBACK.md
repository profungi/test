# 设置 Turso Feedback 表

## 背景

为了在 Vercel 上收集用户反馈，我们需要将 `user_feedback` 表添加到 Turso 数据库中。

## 步骤

### 1. 在 Turso 中创建 user_feedback 表

在你的本地终端运行以下命令：

```bash
# 方式 1: 从导出的 SQL 文件导入
turso db shell bay-area-events < feedback_schema.sql

# 方式 2: 手动执行 SQL
turso db shell bay-area-events
```

然后在 Turso shell 中执行：

```sql
CREATE TABLE user_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  comment TEXT,
  filter_state TEXT,
  events_shown INTEGER,
  user_agent TEXT,
  referrer TEXT,
  locale TEXT,
  created_at TEXT NOT NULL,
  ip_hash TEXT
);

CREATE INDEX idx_feedback_type ON user_feedback(feedback_type);
CREATE INDEX idx_feedback_created ON user_feedback(created_at DESC);
CREATE INDEX idx_feedback_session ON user_feedback(session_id);
```

### 2. 验证表已创建

```bash
# 查看所有表
turso db shell bay-area-events ".tables"

# 应该看到: events  scraping_logs  user_feedback

# 查看 user_feedback 表结构
turso db shell bay-area-events ".schema user_feedback"
```

### 3. （可选）迁移本地历史 feedback 数据

如果你的本地 SQLite 数据库中有历史 feedback 数据想要保留：

```bash
# 导出本地 feedback 数据
sqlite3 data/events.db <<EOF
.mode insert user_feedback
SELECT * FROM user_feedback;
EOF > feedback_data.sql

# 导入到 Turso
turso db shell bay-area-events < feedback_data.sql
```

### 4. 测试 Feedback 功能

部署到 Vercel 后，测试 feedback 功能：

```bash
# 提交测试 feedback
curl -X POST https://your-vercel-app.vercel.app/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackType": "thumbs_up",
    "locale": "en",
    "eventsShown": 10
  }'

# 查看 Turso 中的数据
turso db shell bay-area-events "SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 5;"
```

## 代码变更说明

### 新增文件

1. **`website/lib/turso-feedback.ts`**
   - Turso feedback 数据库适配器
   - 提供 `saveFeedback()`, `getRecentFeedbackStats()`, `getTotalFeedbackStats()` 函数

2. **`feedback_schema.sql`**
   - user_feedback 表的 SQL schema
   - 用于导入到 Turso

3. **`SETUP_TURSO_FEEDBACK.md`**
   - 本文档

### 修改的文件

1. **`website/app/api/feedback/route.ts`**
   - 完全重写，移除了 `better-sqlite3` 依赖
   - 现在使用 `@/lib/turso-feedback` 模块
   - POST 和 GET 端点都使用 Turso

### 优势

✅ 不再依赖 `better-sqlite3`（解决 Vercel `__dirname` 错误）
✅ Feedback 数据保存到 Turso 云数据库
✅ 与主应用数据库在同一位置，方便管理
✅ 无需额外配置或费用（使用现有 Turso 实例）
✅ 完整的 feedback 功能（提交 + 统计）

## 故障排除

### 问题：表创建失败

确保你使用的是正确的数据库名称：

```bash
turso db list
# 找到 bay-area-events 数据库

turso db show bay-area-events
# 查看数据库详情
```

### 问题：权限错误

确认你的 auth token 有写权限：

```bash
# 重新生成 token
turso db tokens create bay-area-events

# 更新 Vercel 环境变量
# Vercel Dashboard → Settings → Environment Variables
# 更新 TURSO_AUTH_TOKEN
```

### 问题：Vercel 部署后仍然报错

检查 Vercel 环境变量：

```bash
# 确保这两个变量都已设置
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

重新部署：

```bash
# 在 Vercel Dashboard 中点击 "Redeploy"
# 或者 push 新的 commit 触发部署
```

## 完成确认

执行完成后，确认以下几点：

- [ ] Turso 中存在 `user_feedback` 表
- [ ] 表结构包含所有必要字段
- [ ] 索引已创建
- [ ] Vercel 环境变量已配置
- [ ] Vercel 重新部署成功
- [ ] 网站上可以提交 feedback
- [ ] Turso 中能看到新的 feedback 数据

## 下一步

部署成功后，你可以：

1. 在 Turso shell 中查询 feedback 统计：
   ```sql
   SELECT
     feedback_type,
     COUNT(*) as count,
     DATE(created_at) as date
   FROM user_feedback
   WHERE created_at >= datetime('now', '-7 days')
   GROUP BY feedback_type, date
   ORDER BY date DESC;
   ```

2. 访问 `/api/feedback` (GET) 查看统计数据

3. 定期分析用户反馈，改进网站体验
