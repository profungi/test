# 🚀 Quick Start - English Posts Generator

## 一分钟快速开始

### 1️⃣ 查看示例输出

```bash
node demo-english-posts.js
```

这会展示 Reddit 和 Nextdoor 的帖子格式示例。

### 2️⃣ 生成真实帖子

```bash
npm run generate-english
```

或者：

```bash
node generate-english-posts.js
```

### 3️⃣ 按提示操作

```
输入周标识符: 2025-11-10_to_2025-11-16
选择平台:
  1. Reddit
  2. Nextdoor
  3. 两者都生成
输入选择: 3
```

### 4️⃣ 查看生成的文件

```
output/events_reddit_2025-11-14_1234.md
output/events_nextdoor_2025-11-14_1234.txt
```

### 5️⃣ 发布到平台

打开文件，复制内容，粘贴到对应平台即可！

---

## 🔍 查看有哪些周的数据

```bash
sqlite3 data/events.db "SELECT DISTINCT week_identifier FROM events ORDER BY week_identifier DESC LIMIT 5;"
```

---

## 📚 详细文档

- **完整指南**: `ENGLISH_POSTS_GUIDE.md`
- **实现细节**: `ENGLISH_POSTS_IMPLEMENTATION.md`

---

## 💡 关键特点

✅ **无需翻译** - 直接使用英文原文
✅ **无需短链接** - 使用原始 URL
✅ **包含所有活动** - 不限制 `selected` 状态
✅ **两种格式** - Reddit (Markdown) 和 Nextdoor (文本)
✅ **无长度限制** - 可以包含很多活动

---

## 🎯 平台建议

### Reddit (r/BayArea)
- 标题简洁："Bay Area Events This Week (Nov 10-16)"
- 周四晚或周五早发布
- 中性、信息型语气

### Nextdoor
- 友好开场："Hi neighbors!"
- 周四下午或周五上午发布
- 强调免费和家庭活动

---

**就这么简单！** 🎉
