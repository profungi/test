# 用户反馈功能 - 快速开始指南

## 🎉 新功能概览

已成功为湾区活动网站添加了以下功能：

### 1. 用户反馈组件 📝
- 在每个活动列表底部显示反馈小部件
- 用户可以快速点击 👍 或 👎 表达意见
- 点击 👎 后可以留言说明想看什么类型的活动

### 2. 用户偏好记忆 💾
- 自动记住用户的筛选选择（地区、类型、周、价格）
- 下次访问时自动应用保存的偏好
- 记录访问来源和次数

## 🚀 如何使用

### 启动网站

```bash
cd website
npm install  # 如果还没安装依赖
npm run dev
```

访问：
- 中文版：http://localhost:3000/zh
- 英文版：http://localhost:3000/en

### 测试反馈功能

1. 滚动到活动列表底部
2. 看到问题："这些活动对你有帮助吗？"
3. 点击 👍 表示有帮助（立即提交）
4. 或点击 👎 表示没帮助（会弹出评论框）
5. 在评论框输入你的想法，例如："更多户外活动"
6. 点击"提交"

### 测试偏好记忆

1. 使用筛选器选择：
   - 地区：San Francisco
   - 类型：Food & Drink
   - 周：This Week
   - 价格：Free

2. 关闭浏览器标签

3. 重新打开 http://localhost:3000/zh

4. 应该自动应用之前的筛选器设置！

## 📊 查看收集的反馈

### 查看所有反馈

```bash
cd /code
sqlite3 data/events.db "SELECT * FROM user_feedback ORDER BY created_at DESC;"
```

### 查看统计

```bash
sqlite3 data/events.db "
SELECT
  feedback_type,
  COUNT(*) as count
FROM user_feedback
GROUP BY feedback_type;
"
```

### 查看用户评论

```bash
sqlite3 data/events.db "
SELECT
  comment,
  locale,
  created_at
FROM user_feedback
WHERE comment IS NOT NULL AND comment != ''
ORDER BY created_at DESC;
"
```

## 📁 文件位置

### 如果需要修改反馈组件：
- 组件代码：`website/app/components/FeedbackWidget.tsx`
- 中文文案：`website/messages/zh.json` → "feedback" 部分
- 英文文案：`website/messages/en.json` → "feedback" 部分
- 样式：`website/app/globals.css`

### 如果需要修改 API：
- API 路由：`website/app/api/feedback/route.ts`

### 如果需要修改偏好功能：
- Hook 代码：`website/app/hooks/useUserPreferences.ts`

## 🎨 自定义反馈组件

### 修改文案

编辑 `website/messages/zh.json`：

```json
{
  "feedback": {
    "question": "你喜欢这些活动吗？",  // 改这里
    "commentPrompt": "告诉我们你的想法..."  // 改这里
  }
}
```

### 修改样式

编辑 `website/app/components/FeedbackWidget.tsx`：

```typescript
// 找到这行来修改背景颜色
className="bg-gradient-to-br from-blue-50 to-purple-50"

// 修改为其他颜色，例如：
className="bg-gradient-to-br from-green-50 to-teal-50"
```

### 修改位置

如果想在列表顶部也显示反馈组件，编辑 `website/app/[locale]/page.tsx`：

```typescript
// 在统计信息后添加
<div className="mb-6">
  <FeedbackSection eventsCount={events.length} />
</div>
```

## 🔍 调试

### 检查 localStorage

1. 打开浏览器开发者工具（F12）
2. 转到 Application 标签
3. 左侧选择 Local Storage → http://localhost:3000
4. 查找：
   - `bayAreaEventsPreferences` - 保存的偏好
   - `bayAreaEventsReferrer` - 来源记录

### 检查 API 请求

1. 打开浏览器开发者工具（F12）
2. 转到 Network 标签
3. 点击反馈按钮
4. 查看 `feedback` 请求
5. 检查 Request 和 Response

## 📝 详细文档

- 完整功能文档：`USER_FEEDBACK_FEATURE.md`
- 实施总结：`IMPLEMENTATION_SUMMARY.md`
- 测试指南：`website/test-feedback.md`

## ❓ 常见问题

**Q: 反馈组件不显示？**
A: 确保活动列表中有活动。组件只在有活动时显示。

**Q: 偏好没有被记住？**
A: 检查浏览器是否启用了 localStorage。在隐私模式下可能被禁用。

**Q: 提交反馈后显示错误？**
A: 检查数据库是否存在且有写入权限。运行 `./test-feedback-api.sh` 验证。

**Q: 如何清除保存的偏好？**
A: 在浏览器开发者工具中，Application → Local Storage → 删除对应的键。

## 🎯 下一步

现在你可以：

1. ✅ 收集真实用户的反馈
2. ✅ 了解用户最喜欢的活动类型
3. ✅ 分析用户的筛选习惯
4. ✅ 优化活动推荐算法

祝你使用愉快！如有问题，请参考详细文档或联系开发者。

---

**开发者**: Sculptor (AI Agent by Imbue)
**日期**: 2025-11-21
