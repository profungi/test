# 用户反馈功能测试指南

## 测试步骤

### 1. 启动开发服务器

```bash
cd website
npm run dev
```

### 2. 测试用户反馈组件

1. 打开浏览器访问 `http://localhost:3000/zh` (中文) 或 `http://localhost:3000/en` (英文)
2. 滚动到活动列表底部
3. 应该看到反馈组件，显示：
   - "这些活动对你有帮助吗？" (中文) 或 "Are these events helpful to you?" (英文)
   - 👍 和 👎 按钮

#### 测试 👍 (点赞)
1. 点击 👍 按钮
2. 应该立即提交并显示感谢消息
3. 检查浏览器开发者工具的 Network 标签，确认 POST 请求成功

#### 测试 👎 (点踩)
1. 刷新页面
2. 点击 👎 按钮
3. 应该显示评论输入框
4. 输入一些文字，例如 "更多户外活动"
5. 点击"提交"按钮
6. 应该显示感谢消息
7. 检查浏览器开发者工具确认请求成功

### 3. 测试用户偏好记忆

#### 测试筛选器记忆
1. 在筛选栏中选择：
   - Location: San Francisco
   - Type: Food & Drink
   - Week: This Week
   - Price: Free
2. 查看 URL 是否更新了参数
3. 打开浏览器开发者工具 → Application → Local Storage
4. 查找 `bayAreaEventsPreferences` 键
5. 应该看到保存的偏好设置（JSON格式）
6. 关闭浏览器标签页
7. 重新打开 `http://localhost:3000/zh` (不带任何URL参数)
8. 应该自动应用之前保存的筛选器设置

#### 测试来源记录
1. 从不同的网站链接访问页面（或者在开发者工具中手动设置 `document.referrer`）
2. 检查 Local Storage 中的 `bayAreaEventsReferrer` 键
3. 应该记录了第一次访问的来源

#### 测试访问计数
1. 多次访问页面
2. 检查 Local Storage 中的 `visitCount` 字段
3. 应该随着访问次数增加

### 4. 验证数据库记录

#### 查看提交的反馈
```bash
cd /code
sqlite3 data/events.db "SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 5;"
```

应该看到刚才提交的反馈记录。

#### 查看反馈统计
```bash
sqlite3 data/events.db "
SELECT
  feedback_type,
  COUNT(*) as count
FROM user_feedback
GROUP BY feedback_type;
"
```

#### 查看用户评论
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

### 5. 测试 API 端点

#### 测试 POST /api/feedback
```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackType": "thumbs_up",
    "comment": "Great events!",
    "filterState": {
      "week": "next",
      "location": "sanfrancisco"
    },
    "eventsShown": 45,
    "locale": "en"
  }'
```

应该返回：
```json
{
  "success": true,
  "feedbackId": <number>,
  "message": "Thank you for your feedback!"
}
```

#### 测试 GET /api/feedback (查看统计)
```bash
curl http://localhost:3000/api/feedback
```

应该返回反馈统计数据。

### 6. 测试多语言

1. 访问英文版 `http://localhost:3000/en`
2. 验证所有文本都是英文
3. 切换到中文版 `http://localhost:3000/zh`
4. 验证所有文本都是中文
5. 确认切换语言时保留了筛选参数

## 预期结果

✅ **反馈组件**
- 显示在活动列表底部
- 样式美观，有渐变背景
- 按钮有悬停效果和动画
- 提交成功后显示感谢消息

✅ **用户偏好**
- 筛选器选择被保存到 localStorage
- 重新访问时自动应用保存的筛选器
- 记录访问次数和来源

✅ **数据库**
- 反馈数据正确保存
- IP 被哈希处理，保护隐私
- 包含完整的上下文信息（筛选器、活动数量等）

✅ **双语支持**
- 所有文本都有中英文翻译
- 语言切换无缝

## 常见问题

### Q: 反馈组件不显示？
A: 确保活动列表中有活动。组件只在有活动时显示。

### Q: localStorage 数据看不到？
A: 检查浏览器是否阻止了 localStorage。在隐私模式/无痕模式下 localStorage 可能被禁用。

### Q: API 返回 500 错误？
A: 检查数据库文件是否存在且有写入权限。确保 `data/events.db` 可访问。

### Q: 偏好没有被自动应用？
A: 这是正常的，只有在 URL 没有参数时才会应用保存的偏好。如果 URL 有参数，会优先使用 URL 参数。

## 性能检查

- [ ] 首次加载时间 < 2秒
- [ ] 反馈提交响应 < 500ms
- [ ] localStorage 读写不阻塞 UI
- [ ] 动画流畅，无卡顿

## 安全检查

- [ ] IP 地址被哈希，不存储原始值
- [ ] 没有存储任何个人身份信息
- [ ] API 有基本的输入验证
- [ ] 评论长度限制在 500 字符
