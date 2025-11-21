# 用户反馈和偏好记忆功能

## 概述

本文档介绍了新增的用户反馈收集和偏好记忆功能。

## 功能特性

### 1. 用户反馈组件 (FeedbackWidget)

在每个活动列表底部显示反馈组件，收集用户对活动内容的反馈。

**位置**: `website/app/components/FeedbackWidget.tsx`

**功能**:
- 👍 👎 点赞/点踩按钮
- 点击 👎 后弹出评论框，收集用户想看的活动类型
- 支持中英文双语
- 提交后显示感谢消息
- 优雅的动画效果

**显示条件**:
- 只在有活动显示时出现
- 显示在活动列表底部

### 2. 用户偏好记忆 (useUserPreferences Hook)

自动记住用户的筛选偏好，提升用户体验。

**位置**: `website/app/hooks/useUserPreferences.ts`

**记忆的信息**:
- 筛选器设置 (location, type, week, price)
- 用户来源 (referrer)
- 访问次数
- 最后访问时间

**工作原理**:
1. 使用 `localStorage` 在浏览器端存储用户偏好
2. 用户下次访问时，如果 URL 没有参数，自动应用保存的偏好
3. 每次用户调整筛选器时自动保存

### 3. 数据库表结构

#### user_feedback 表
存储用户反馈数据

```sql
CREATE TABLE user_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,              -- 用户会话ID（匿名）
  feedback_type TEXT NOT NULL,           -- 'thumbs_up' 或 'thumbs_down'
  comment TEXT,                          -- 用户的文字反馈（可选）
  filter_state TEXT,                     -- JSON格式的过滤器状态
  events_shown INTEGER,                  -- 显示的活动数量
  user_agent TEXT,                       -- 浏览器信息
  referrer TEXT,                         -- 来源页面
  locale TEXT,                           -- 语言（en/zh）
  created_at TEXT NOT NULL,              -- 创建时间
  ip_hash TEXT                           -- IP的哈希值（隐私保护）
);
```

#### user_preferences 表
存储用户偏好统计（用于分析）

```sql
CREATE TABLE user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,       -- 用户会话ID
  location_preference TEXT,              -- 最常用的location
  type_preference TEXT,                  -- 最常用的event type
  week_preference TEXT,                  -- this_week 或 next_week
  price_preference TEXT,                 -- 价格偏好
  locale TEXT,                           -- 语言偏好
  visit_count INTEGER DEFAULT 1,         -- 访问次数
  last_visit TEXT NOT NULL,              -- 最后访问时间
  created_at TEXT NOT NULL               -- 首次访问时间
);
```

### 4. API 端点

**POST /api/feedback**
提交用户反馈

请求体:
```json
{
  "feedbackType": "thumbs_up" | "thumbs_down",
  "comment": "用户评论（可选）",
  "filterState": {
    "week": "next",
    "location": "sanfrancisco",
    "type": "food",
    "price": "free"
  },
  "eventsShown": 45,
  "locale": "zh"
}
```

响应:
```json
{
  "success": true,
  "feedbackId": 123,
  "message": "Thank you for your feedback!"
}
```

**GET /api/feedback**
获取反馈统计（管理员用）

响应:
```json
{
  "recentStats": [
    {
      "feedback_type": "thumbs_up",
      "count": 25,
      "date": "2025-11-21"
    }
  ],
  "totalStats": [
    {
      "feedback_type": "thumbs_up",
      "count": 150
    },
    {
      "feedback_type": "thumbs_down",
      "count": 12
    }
  ]
}
```

## 文件结构

```
/code/
├── init-user-feedback-db.js          # 数据库初始化脚本
├── website/
│   ├── app/
│   │   ├── api/
│   │   │   └── feedback/
│   │   │       └── route.ts          # API路由
│   │   ├── components/
│   │   │   ├── FeedbackWidget.tsx    # 反馈小部件
│   │   │   └── FeedbackSection.tsx   # 反馈区域包装器
│   │   ├── hooks/
│   │   │   └── useUserPreferences.ts # 用户偏好Hook
│   │   └── [locale]/
│   │       └── page.tsx              # 主页面（已集成）
│   ├── messages/
│   │   ├── en.json                   # 英文翻译
│   │   └── zh.json                   # 中文翻译
│   └── app/globals.css               # 全局样式（包含动画）
```

## 安装和使用

### 1. 初始化数据库

首次使用前需要创建反馈表：

```bash
# 方法1: 使用SQL命令（已完成）
sqlite3 data/events.db < init-user-feedback-db.sql

# 方法2: 使用Node脚本
npm run init-user-feedback-db
```

### 2. 启动网站

```bash
cd website
npm run dev
```

### 3. 测试功能

1. 访问 http://localhost:3000/zh 或 http://localhost:3000/en
2. 查看活动列表
3. 滚动到底部查看反馈组件
4. 点击 👍 或 👎 测试反馈提交
5. 调整筛选器，刷新页面，验证偏好是否被记住

## 隐私保护

- **匿名性**: 不收集用户的真实身份信息
- **Session ID**: 使用 IP 地址的 SHA-256 哈希作为匿名会话 ID
- **IP 哈希**: 只存储 IP 的哈希值，不存储原始 IP
- **本地存储**: 用户偏好仅保存在用户浏览器的 localStorage 中
- **可删除**: 用户可以清除浏览器 localStorage 删除所有本地偏好

## 查询反馈数据

### 查看所有反馈

```bash
sqlite3 data/events.db "SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 10;"
```

### 查看反馈统计

```bash
sqlite3 data/events.db "
SELECT
  feedback_type,
  COUNT(*) as count,
  DATE(created_at) as date
FROM user_feedback
GROUP BY feedback_type, DATE(created_at)
ORDER BY date DESC;
"
```

### 查看用户评论

```bash
sqlite3 data/events.db "
SELECT
  comment,
  filter_state,
  locale,
  created_at
FROM user_feedback
WHERE comment IS NOT NULL AND comment != ''
ORDER BY created_at DESC;
"
```

## 未来优化建议

1. **管理后台**: 创建一个简单的管理界面查看反馈统计
2. **邮件通知**: 当收到新的 👎 反馈时发送通知
3. **A/B 测试**: 测试不同的反馈组件位置和文案
4. **反馈分析**: 自动分析用户评论，提取关键词和趋势
5. **个性化推荐**: 基于用户偏好历史提供个性化活动推荐

## 技术栈

- **前端**: React 18, Next.js 15, TypeScript
- **样式**: Tailwind CSS 4
- **国际化**: next-intl
- **数据库**: SQLite3 (better-sqlite3)
- **API**: Next.js API Routes

## 贡献者

- Sculptor (AI Agent by Imbue)
- Powered by Claude Code

## 许可证

MIT
