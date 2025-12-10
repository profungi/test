# 翻译功能快速开始

## ✅ 已完成的工作

1. ✅ 创建了翻译模块 (`src/utils/translator.js`)
2. ✅ 数据库已添加 `title_zh` 字段
3. ✅ 爬虫流程已集成自动翻译
4. ✅ 前端已更新显示中文标题
5. ✅ 创建了历史数据翻译脚本

## 🚀 立即使用

### 步骤 1: 翻译现有的 325 个活动

```bash
npm run translate-existing
```

**预计时间：** 约 3-5 分钟（使用免费 Google Translate）

**预期输出：**
```
🚀 开始翻译历史活动标题...
✅ 已连接到数据库
📋 找到 325 个需要翻译的活动

🌐 开始批量翻译 325 个文本 (使用 google)...

📦 批次 1/33: 翻译 10 个文本...
  ✓ [1/325] GATS: 20 Years of GATS... → 20周年庆典...
  ✓ [2/325] Golden State Warriors 2025/2026 Season... → 金州勇士队2025/2026赛季...
  ...

✨ 翻译完成！
📊 最终统计:
   总计: 325 个活动
   成功: 325 个 (100%)
   失败: 0 个 (0%)
```

### 步骤 2: 验证翻译结果

查看数据库中的翻译：

```bash
sqlite3 data/events.db "SELECT title, title_zh FROM events LIMIT 5"
```

### 步骤 3: 测试网站显示

进入网站目录并启动开发服务器：

```bash
cd website
npm run dev
```

访问中文版本（`/zh`），应该能看到中文标题。

## 📝 环境变量配置（可选）

如果你想使用官方 Google Translate API 或 OpenAI，在 `.env` 文件中配置：

```bash
# 默认使用免费 Google Translate（无需配置）
TRANSLATOR_PROVIDER=google

# 如果有 Google Translate API Key（可选）
GOOGLE_TRANSLATE_API_KEY=your_key_here

# 或使用 OpenAI（需要付费）
TRANSLATOR_PROVIDER=openai
OPENAI_API_KEY=your_openai_key_here
```

**注意：** 不配置任何 API Key 也能工作，会使用免费的 Google Translate 服务！

## 🔄 未来的爬虫自动翻译

从现在开始，每次运行爬虫都会自动翻译新活动：

```bash
npm run scrape
```

翻译会在 AI 分类后自动执行，无需额外操作。

## 🎯 翻译服务对比

| 服务 | 成本 | 质量 | 配置 |
|------|------|------|------|
| **Google Translate（免费）** | $0.00/月 | ⭐⭐⭐⭐ | 无需配置 ✅ |
| Google Translate（官方） | $0.00/月（50万字符内） | ⭐⭐⭐⭐ | 需要 API Key |
| OpenAI GPT-4o-mini | ~$0.004/月 | ⭐⭐⭐⭐⭐ | 需要 API Key |

**推荐：** 使用免费 Google Translate，完全够用！

## ❓ 常见问题

### Q: 翻译失败怎么办？
A: 翻译失败的活动会保留英文标题，不影响显示。可以重新运行脚本重试。

### Q: 如何只翻译部分活动？
A: 脚本会自动跳过已有中文标题的活动，可以安全地多次运行。

### Q: 翻译质量不好怎么办？
A: 可以：
1. 切换到 OpenAI（质量更好但收费）
2. 在数据库中手动修改 `title_zh` 字段

### Q: 如何查看翻译进度？
A: 脚本会实时显示翻译进度，包括批次号、成功/失败数量等。

## 📚 完整文档

更多详细信息，请查看：
- **完整指南**: `TRANSLATION_GUIDE.md`
- **主文档**: `README.md`
- **架构说明**: `ARCHITECTURE.md`

## 🎉 开始翻译吧！

运行这个命令开始：

```bash
npm run translate-existing
```

就这么简单！
