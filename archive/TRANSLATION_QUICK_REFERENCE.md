# 翻译功能快速参考

## 🎯 一句话总结

智能翻译系统会按 **Gemini → OpenAI → Mistral → Google** 的优先级自动回退，确保翻译成功。

---

## 🚀 快速命令

### 翻译所有历史活动（自动模式）
```bash
npm run translate-existing
```

### 指定服务翻译
```bash
npm run translate-existing -- --provider gemini   # 只用 Gemini
npm run translate-existing -- --provider openai   # 只用 OpenAI
npm run translate-existing -- --provider google   # 只用 Google
```

### 未来爬虫自动翻译
```bash
npm run scrape  # 会自动翻译新活动
```

---

## ⚙️ 配置（.env）

### 推荐配置（免费）
```bash
GEMINI_API_KEY=your_key_here
TRANSLATOR_PROVIDER=auto
```

### 完整配置（最佳质量）
```bash
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
MISTRAL_API_KEY=your_mistral_key
TRANSLATOR_PROVIDER=auto
```

### 最小配置（完全免费）
```bash
# 不配置任何 Key，使用免费 Google Translate
TRANSLATOR_PROVIDER=auto
```

---

## 📊 服务对比

| 服务 | 成本 | 质量 | 推荐 |
|------|------|------|------|
| 🔮 **Gemini** | 免费 | ⭐⭐⭐⭐ | ✅ 首选 |
| 🤖 **OpenAI** | $0.004/月 | ⭐⭐⭐⭐⭐ | ✅ 备选 |
| 🌪️ **Mistral** | $0.003/月 | ⭐⭐⭐⭐ | ✅ 备选 |
| 🌐 **Google** | 免费 | ⭐⭐⭐ | ✅ 兜底 |

---

## 🔧 实用操作

### 清空现有翻译重新开始
```bash
sqlite3 data/events.db "UPDATE events SET title_zh = NULL"
npm run translate-existing
```

### 查看翻译结果
```bash
sqlite3 data/events.db "SELECT title, title_zh FROM events LIMIT 10"
```

### 查看翻译统计
```bash
sqlite3 data/events.db "
  SELECT
    COUNT(*) as total,
    COUNT(title_zh) as translated,
    COUNT(*) - COUNT(title_zh) as pending
  FROM events
"
```

### 查看帮助
```bash
node translate-existing-events.js --help
```

---

## 📋 优先级顺序

```
1. 🔮 Gemini
   ↓ 失败
2. 🤖 OpenAI
   ↓ 失败
3. 🌪️ Mistral
   ↓ 失败
4. 🌐 Google Translate (兜底，总会成功)
```

---

## 💡 使用场景

### 日常使用
- 配置：`GEMINI_API_KEY` + `TRANSLATOR_PROVIDER=auto`
- 运行：`npm run translate-existing`
- 结果：全用 Gemini，免费且质量好

### 追求最佳质量
- 配置：全部 API Keys + `TRANSLATOR_PROVIDER=auto`
- 运行：`npm run translate-existing`
- 结果：优先 Gemini，失败切换 OpenAI

### 测试对比
```bash
# 清空翻译
sqlite3 data/events.db "UPDATE events SET title_zh = NULL"

# 只用 Gemini 翻译
npm run translate-existing -- --provider gemini

# 查看结果
sqlite3 data/events.db "SELECT title, title_zh FROM events LIMIT 5"
```

---

## 🎉 输出示例

```
🌐 使用自动翻译模式 (优先级: Gemini → OpenAI → Mistral → Google)
✅ Gemini 客户端已初始化
✅ OpenAI 客户端已初始化
✅ Google Translate (免费) 已启用

📋 可用服务: gemini → openai → google
⚙️  模式: 自动回退

📦 批次 1/33: 翻译 10 个文本...
  🔮 [1/325] GATS: 20 Years of GATS... → 20周年庆典... (gemini)
  🔮 [2/325] Golden State Warriors... → 金州勇士队... (gemini)
  🤖 [3/325] Jazz Night... → 爵士之夜... (openai)
  🌐 [4/325] Weekend Market... → 周末市集... (google)

============================================================
✨ 批量翻译完成！

📊 翻译统计:
   总计: 325 个文本
   🔮 Gemini: 250 (77%)
   🤖 OpenAI: 50 (15%)
   🌐 Google: 25 (8%)
============================================================
```

---

## 📚 完整文档

- **详细指南**: `TRANSLATION_GUIDE.md`
- **自动模式**: `TRANSLATION_AUTO_MODE.md`
- **快速开始**: `TRANSLATION_QUICKSTART.md`
- **实现总结**: `TRANSLATION_SUMMARY.md`

---

## ❓ 常见问题

**Q: 不配置任何 API Key 可以用吗？**
A: 可以！会自动使用免费的 Google Translate。

**Q: 推荐配置哪个服务？**
A: Gemini，免费额度大，质量好。

**Q: 可以只用 OpenAI 吗？**
A: 可以，使用 `--provider openai` 参数。

**Q: 翻译失败会怎样？**
A: 自动切换到下一个服务，Google Translate 兜底保证成功。

**Q: 如何查看使用了哪个服务？**
A: 每条翻译都会显示服务名，如 `(gemini)` 或 `(openai)`。

---

**立即开始：**
```bash
npm run translate-existing
```
