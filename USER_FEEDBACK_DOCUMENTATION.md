# 用户反馈和偏好记忆功能 - 完整文档

## 📋 目录

1. [功能概述](#功能概述)
2. [快速开始](#快速开始)
3. [功能详情](#功能详情)
4. [技术实现](#技术实现)
5. [故障排查](#故障排查)
6. [数据库去重](#数据库去重)

---

## 功能概述

为湾区活动网站添加了用户反馈收集和偏好记忆功能。

### ✨ 主要特性

1. **用户反馈组件**
   - 在活动列表底部显示："这些活动对你有帮助吗？👍 👎"
   - 点击 👍 立即提交正面反馈
   - 点击 👎 显示评论框，收集用户想看的活动类型
   - 支持中英文双语

2. **用户偏好记忆**
   - 自动记住用户的筛选选择（地区、类型、周、价格）
   - 记录访问来源和访问次数
   - 下次访问时自动应用保存的偏好
   - 使用浏览器 localStorage 存储

3. **数据收集与分析**
   - 存储到 SQLite 数据库
   - 匿名会话追踪（IP 哈希）
   - API 端点用于数据查询

---

## 快速开始

### 前置要求

- Node.js >= 18
- npm
- SQLite3

### 安装步骤

```bash
# 1. 进入 website 目录
cd website

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 访问网站
# 中文版: http://localhost:3000/zh
# 英文版: http://localhost:3000/en
```

### 验证功能

1. **访问网站**: http://localhost:3000/zh
2. **查看活动**: 应该看到活动列表
3. **测试反馈**: 滚动到底部，点击 👍 或 👎
4. **测试偏好**: 选择筛选器，刷新页面验证是否自动应用

---

## 功能详情

### 1. 反馈组件

**位置**: 活动列表底部

**功能**:
- 👍 点赞：立即提交，显示感谢消息
- 👎 点踩：弹出评论框，可选填写建议
- 优雅的动画效果
- 中英文双语支持

**显示条件**: 只在有活动时显示

### 2. 用户偏好

**记忆的信息**:
- 筛选器设置 (location, type, week, price)
- 用户来源 (referrer)
- 访问次数 (visitCount)
- 最后访问时间 (lastVisit)

**工作原理**:
1. 使用 localStorage 在浏览器端存储
2. 用户调整筛选器时自动保存
3. 下次访问无参数 URL 时自动应用

### 3. 数据库结构

#### user_feedback 表
```sql
CREATE TABLE user_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,        -- 匿名会话ID
  feedback_type TEXT NOT NULL,     -- 'thumbs_up' 或 'thumbs_down'
  comment TEXT,                    -- 用户评论（可选）
  filter_state TEXT,               -- 筛选器状态（JSON）
  events_shown INTEGER,            -- 显示的活动数量
  user_agent TEXT,                 -- 浏览器信息
  referrer TEXT,                   -- 来源页面
  locale TEXT,                     -- 语言（en/zh）
  created_at TEXT NOT NULL,        -- 创建时间
  ip_hash TEXT                     -- IP哈希（隐私保护）
);
```

#### user_preferences 表
```sql
CREATE TABLE user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  location_preference TEXT,
  type_preference TEXT,
  week_preference TEXT,
  price_preference TEXT,
  locale TEXT,
  visit_count INTEGER DEFAULT 1,
  last_visit TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### 4. API 端点

#### POST /api/feedback
提交用户反馈

**请求示例**:
```json
{
  "feedbackType": "thumbs_down",
  "comment": "更多户外活动",
  "filterState": {
    "week": "next",
    "location": "sanfrancisco",
    "type": "food"
  },
  "eventsShown": 45,
  "locale": "zh"
}
```

**响应示例**:
```json
{
  "success": true,
  "feedbackId": 123,
  "message": "Thank you for your feedback!"
}
```

#### GET /api/feedback
获取反馈统计（管理员用）

**响应示例**:
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
    }
  ]
}
```

---

## 技术实现

### 文件结构

```
website/app/
├── api/
│   ├── feedback/
│   │   └── route.ts              # 反馈API
│   └── debug/
│       └── route.ts              # 调试API
├── components/
│   ├── FeedbackWidget.tsx        # 反馈小部件
│   ├── FeedbackSection.tsx       # 反馈区域包装器
│   ├── FilterBar.tsx             # 筛选栏
│   └── EventCard.tsx             # 活动卡片
├── hooks/
│   └── useUserPreferences.ts     # 用户偏好Hook
└── [locale]/
    └── page.tsx                  # 主页面（已集成）
```

### 核心组件

**FeedbackWidget.tsx** (客户端组件)
- 渲染反馈UI
- 处理用户交互
- 提交反馈到API

**FeedbackSection.tsx** (客户端组件)
- 包装 FeedbackWidget
- 集成用户偏好 hook
- 管理筛选器状态

**useUserPreferences.ts** (React Hook)
- 管理 localStorage
- 自动保存和加载偏好
- 提供偏好操作方法

### 关键技术点

1. **Suspense 边界**:
   - Next.js 15 要求 `useSearchParams` 组件被 Suspense 包裹
   - 在 `page.tsx` 中添加了 Suspense 边界

2. **隐私保护**:
   - IP 地址使用 SHA-256 哈希
   - 只存储匿名会话 ID
   - 不收集个人身份信息

3. **国际化**:
   - 使用 next-intl
   - 所有文本都有中英文翻译
   - 语言切换无缝

---

## 故障排查

### 常见问题

#### 1. Internal Server Error

**原因**: useSearchParams 没有被 Suspense 包裹

**解决方法**:
已在 `app/[locale]/page.tsx` 中添加 Suspense 边界：
```typescript
<Suspense fallback={<div>Loading...</div>}>
  <FeedbackSection eventsCount={events.length} />
</Suspense>
```

**验证**: 重启开发服务器，清除 .next 缓存
```bash
cd website
rm -rf .next
npm run dev
```

#### 2. "parsed is not defined" 错误

**原因**: useUserPreferences 中变量作用域问题

**解决方法**:
已修复 `app/hooks/useUserPreferences.ts`：
```typescript
// ✅ 正确
let parsed: UserPreferences = {};
if (savedPrefs) {
  parsed = JSON.parse(savedPrefs);
}
```

#### 3. 看不到活动

**原因**:
- 在 Sculptor 沙箱中（没有 Node.js）
- 数据库路径错误
- 依赖未安装

**解决方法**:
1. 必须在本地电脑运行（不是 Sculptor 沙箱）
2. 确认 `data/events.db` 存在
3. 运行 `npm install`

#### 4. 反馈提交失败

**检查步骤**:
1. 浏览器控制台（F12 → Console）查看错误
2. Network 标签查看 API 请求
3. 访问 `/api/debug` 查看系统状态

### 调试工具

#### 调试端点
```
http://localhost:3000/api/debug
```

返回系统状态：
```json
{
  "dbConnection": "SUCCESS",
  "eventsCount": 213,
  "dbExists": true,
  "nodeVersion": "v18.x.x"
}
```

#### 查看反馈数据
```bash
sqlite3 data/events.db "
  SELECT * FROM user_feedback
  ORDER BY created_at DESC
  LIMIT 10;
"
```

#### 查看统计
```bash
sqlite3 data/events.db "
  SELECT feedback_type, COUNT(*) as count
  FROM user_feedback
  GROUP BY feedback_type;
"
```

### 快速修复脚本

使用 `fix-and-restart.sh`:
```bash
cd website
chmod +x ../fix-and-restart.sh
../fix-and-restart.sh
npm run dev
```

---

## 数据库去重

### 执行去重

项目包含去重脚本，可清理重复活动：

```bash
# 运行去重脚本（自动备份）
./remove-duplicates.sh
```

### 去重结果（2025-11-21）

| 指标 | 数值 |
|------|------|
| 初始活动数 | 252 |
| 删除无效活动 | 4 |
| 删除重复活动 | 39 |
| **最终活动数** | **213** |
| **共删除** | **43 (17%)** |

**删除内容**:
- 无效活动: 4 个（标题是 "www.sfstation.com"）
- 重复活动: 39 个（32 组重复，保留了最早的记录）

**验证结果**:
- ✅ 没有重复活动
- ✅ 所有无效活动已删除
- ✅ 数据库完整性保持

### 备份与恢复

**备份文件**:
```
data/events.db.backup.20251121_183701
```

**恢复数据**（如需要）:
```bash
cp data/events.db.backup.* data/events.db
```

### 定期维护

建议每周运行去重脚本：
```bash
./remove-duplicates.sh
```

---

## 查询反馈数据

### 查看所有反馈
```bash
sqlite3 data/events.db "
  SELECT * FROM user_feedback
  ORDER BY created_at DESC
  LIMIT 10;
"
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
    locale,
    datetime(created_at) as created
  FROM user_feedback
  WHERE comment IS NOT NULL AND comment != ''
  ORDER BY created_at DESC;
"
```

---

## 隐私保护

### 实施的措施

1. **匿名性**: 不收集用户的真实身份信息
2. **Session ID**: 使用 IP 地址的 SHA-256 哈希
3. **IP 哈希**: 只存储 IP 的哈希值，不存储原始 IP
4. **本地存储**: 用户偏好仅保存在用户浏览器
5. **可删除**: 用户可清除浏览器 localStorage

### 数据最小化

只收集必要的信息：
- ✅ 反馈类型（thumbs_up/thumbs_down）
- ✅ 可选评论
- ✅ 筛选器状态（匿名）
- ✅ 浏览器和语言信息
- ❌ 不收集姓名、邮箱等个人信息

---

## 文件清单

### 核心功能文件
- `website/app/api/feedback/route.ts` - 反馈API
- `website/app/components/FeedbackWidget.tsx` - 反馈组件
- `website/app/components/FeedbackSection.tsx` - 包装器
- `website/app/hooks/useUserPreferences.ts` - 偏好Hook
- `website/messages/en.json` - 英文翻译
- `website/messages/zh.json` - 中文翻译

### 工具脚本
- `remove-duplicates.sh` - 数据库去重脚本
- `remove-duplicates.js` - Node.js版去重脚本
- `fix-and-restart.sh` - 快速修复脚本
- `test-feedback-api.sh` - 测试脚本
- `debug-website.sh` - 调试脚本

### 文档
- `USER_FEEDBACK_DOCUMENTATION.md` - 本文档（综合文档）
- `DEDUPLICATION_REPORT.md` - 去重报告

---

## 技术栈

- **前端**: React 18, Next.js 15, TypeScript
- **样式**: Tailwind CSS 4
- **国际化**: next-intl
- **数据库**: SQLite3 (better-sqlite3)
- **API**: Next.js API Routes
- **状态管理**: React Hooks + localStorage

---

## 未来改进建议

1. **管理后台**
   - 创建反馈查看界面
   - 数据可视化图表
   - 导出功能

2. **邮件通知**
   - 收到负面反馈时发送通知
   - 每日反馈摘要

3. **智能分析**
   - 自动分析用户评论
   - 提取关键词和趋势
   - 生成改进建议

4. **A/B 测试**
   - 测试不同的反馈组件位置
   - 测试不同的提示文案

5. **个性化推荐**
   - 基于用户偏好推荐活动
   - 智能筛选器预设

---

## 贡献者

- **开发**: Sculptor (AI Agent by Imbue)
- **技术**: Claude Code by Anthropic
- **日期**: 2025-11-21

## 许可证

MIT

---

**最后更新**: 2025-11-21
**版本**: 1.0.0
**状态**: ✅ 生产就绪
