# User Feedback 同步功能实施总结

## ✅ 已完成

### 功能实现
sync-from-turso.js 现在同步两个表：
1. **events 表**（活动数据）
2. **user_feedback 表**（用户反馈数据）✨ 新增

### 使用方法

**增量同步**（推荐）：
```bash
npm run sync-from-turso
```
只同步新的数据，基于：
- Events: `scraped_at` 时间戳
- Feedback: `created_at` 时间戳

**全量同步**：
```bash
node sync-from-turso.js --full
```
清空本地表，重新导入所有数据

**预览模式**：
```bash
npm run sync-preview
```
查看将要同步什么数据，不实际写入

### 技术细节

**user_feedback 表结构**：
```sql
CREATE TABLE user_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL,     -- 'thumbs_up' 或 'thumbs_down'
  comment TEXT,
  filter_state TEXT,
  events_shown INTEGER,
  user_agent TEXT,
  referrer TEXT,
  locale TEXT,
  created_at TEXT NOT NULL,
  ip_hash TEXT
);
```

**同步策略**：
- 唯一标识：使用 Turso 的 `id`（AUTOINCREMENT）
- 增量判断：基于 `created_at` 时间戳
- 冲突处理：Upsert（存在则更新，不存在则插入）
- 保留 id：插入时保留 Turso 的原始 id

**数据流**：
```
Website 用户交互
    ↓
写入 Turso (user_feedback)
    ↓
sync-from-turso.js
    ↓
本地 SQLite (user_feedback 副本)
    ↓
本地分析脚本可以使用
```

### 修改的文件

1. **sync-from-turso.js**
   - 添加 6 个新方法处理 user_feedback
   - 更新主流程同时处理两个表
   - 更新帮助文档

2. **QUICK_START.md**
   - 更新数据库说明部分
   - 区分 user_feedback（同步）和本地独有 feedback 表

3. **docs/DATA_ARCHITECTURE.md**
   - 添加 user_feedback 作为新的数据层
   - 更新数据分层结构

4. **SYNC_INVESTIGATION_REPORT.md** (新建)
   - 详细的问题调查分析
   - 技术方案对比
   - 实施记录

### 输出示例

运行同步时你会看到：
```
═══════════════════════════════════════
🔄 Turso → Local 数据同步
═══════════════════════════════════════

📋 同步配置:
   模式: 增量同步
   预览模式: 否

📅 上次同步时间:
   Events: 2025-12-09T10:30:00.000Z
   Feedback: 2025-12-08T15:20:00.000Z

📡 正在从 Turso 获取数据...
   ✅ Events: 15 条记录
   ✅ Feedback: 8 条记录

📋 Events 数据预览:
   1. Holiday Market at Union Square
      地点: Union Square
      时间: 2025-12-15T12:00:00
      来源: sfstation
      抓取: 2025-12-10T08:00:00

   ... 还有 10 条记录

📋 User Feedback 数据预览:
   1. thumbs_up
      Session: a1b2c3d4e5f6
      Locale: en
      Events shown: 50
      时间: 2025-12-10T10:15:00

   ... 还有 3 条记录

💾 正在同步 Events 到本地数据库...
💾 正在同步 User Feedback 到本地数据库...

✅ 同步完成！

📊 Events 同步统计:
   新增: 12 条
   更新: 3 条
   跳过: 0 条
   失败: 0 条

📊 User Feedback 同步统计:
   新增: 7 条
   更新: 1 条
   跳过: 0 条
   失败: 0 条

═══════════════════════════════════════
```

## 📊 数据库状态

### 同步的表（Turso → Local）
1. ✅ **events** - 活动数据
2. ✅ **user_feedback** - 用户反馈（网站点赞）

### 本地独有的表（不同步）
1. **posts** - 发布记录
2. **event_performance** - 活动表现数据
3. **weight_adjustments** - AI 权重调整

## 🎯 下一步

### 立即可用
你现在可以：
1. 运行 `npm run sync-from-turso` 同步数据
2. 在本地查询和分析 user_feedback 数据
3. 使用增量同步定期更新数据

### 待实现（根据调查报告）
1. 创建支持 Turso 的 remove-duplicates 脚本
2. 改进去重逻辑（使用 original_url）
3. Schema 优化（长期改进）

## 📝 注意事项

1. **Turso 配置必需**：需要在 .env 中配置：
   ```bash
   TURSO_DATABASE_URL=libsql://your-db.turso.io
   TURSO_AUTH_TOKEN=your_token
   ```

2. **本地表结构必需**：确保本地数据库有 user_feedback 表
   - 运行 `node init-user-feedback-db.js` 创建表（如果还没有）

3. **id 冲突**：
   - 本地 user_feedback 表的 id 会与 Turso 保持一致
   - 不要在本地手动插入 user_feedback 数据
   - 所有 feedback 应该由 website 写入 Turso

4. **同步频率**：
   - 用户反馈数据通常不需要高频同步
   - 建议：每天或每周同步一次即可
   - 或者在需要分析数据时手动同步

## 🔍 验证

检查同步是否成功：
```bash
# 查看本地 user_feedback 数据量
sqlite3 data/events.db "SELECT COUNT(*) FROM user_feedback;"

# 查看最新的 feedback
sqlite3 data/events.db "SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 5;"

# 按类型统计
sqlite3 data/events.db "SELECT feedback_type, COUNT(*) FROM user_feedback GROUP BY feedback_type;"
```

## 📚 相关文档

- [同步调查报告](./SYNC_INVESTIGATION_REPORT.md) - 详细的问题分析
- [快速入门](./QUICK_START.md) - 使用指南
- [数据架构](./docs/DATA_ARCHITECTURE.md) - 架构说明
