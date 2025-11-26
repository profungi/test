# 翻译自动回退模式使用指南

## 🎯 新功能：智能翻译优先级回退

现在翻译模块支持**自动优先级回退**机制，会按顺序尝试多个翻译服务，直到成功为止！

## 📋 优先级顺序

```
🔮 Gemini → 🤖 OpenAI → 🌪️ Mistral → 🌐 Google Translate
```

### 为什么这样排序？

1. **🔮 Gemini** (优先级 1)
   - ✅ 免费额度大（每月 150 万 tokens）
   - ✅ 质量好，理解语境
   - ✅ 速度快
   - 💰 成本：$0.00（在免费额度内）

2. **🤖 OpenAI** (优先级 2)
   - ✅ 翻译质量最好
   - ✅ 自然流畅
   - 💰 成本：~$0.004/月（325个活动）

3. **🌪️ Mistral** (优先级 3)
   - ✅ 性价比高
   - ✅ 质量不错
   - 💰 成本：中等

4. **🌐 Google Translate** (优先级 4 - 兜底)
   - ✅ 永远可用（免费接口）
   - ✅ 速度快
   - ⚠️ 质量一般
   - 💰 成本：$0.00（免费）

## 🚀 快速开始

### 1. 自动模式（推荐）

**默认行为**：不需要任何配置！

```bash
npm run translate-existing
```

脚本会：
1. 检测你配置的 API Keys
2. 按优先级尝试翻译
3. 一个服务失败自动切换到下一个
4. 显示每个标题使用了哪个服务

**输出示例：**
```
🌐 开始批量翻译 325 个文本...
📋 可用服务: gemini → openai → google
⚙️  模式: 自动回退

📦 批次 1/33: 翻译 10 个文本...
  🔮 [1/325] GATS: 20 Years of GATS... → 20周年庆典... (gemini)
  🔮 [2/325] Golden State Warriors... → 金州勇士队2025/2026赛季... (gemini)
  🤖 [3/325] Jazz Night at SFJAZZ... → SFJAZZ中心爵士之夜... (openai)
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

### 2. 指定单一服务

如果你只想用某个特定服务：

```bash
# 只用 Gemini
npm run translate-existing -- --provider gemini

# 只用 OpenAI
npm run translate-existing -- --provider openai

# 只用 Google Translate
npm run translate-existing -- --provider google
```

## ⚙️ 配置

### 在 .env 文件中配置

```bash
# 方式 1: 使用自动模式（推荐）
TRANSLATOR_PROVIDER=auto

# 方式 2: 指定单一服务
TRANSLATOR_PROVIDER=gemini
# 或
TRANSLATOR_PROVIDER=openai
# 或
TRANSLATOR_PROVIDER=google

# API Keys（根据需要配置）
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
MISTRAL_API_KEY=your_mistral_key_here
GOOGLE_TRANSLATE_API_KEY=your_google_key_here  # 可选
```

### API Key 优先级建议

**推荐配置**：至少配置 Gemini，其他可选

```bash
# 最小配置（推荐）
GEMINI_API_KEY=your_key_here
TRANSLATOR_PROVIDER=auto

# 完整配置（最佳）
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
MISTRAL_API_KEY=your_mistral_key
TRANSLATOR_PROVIDER=auto
```

## 📊 成本对比

假设翻译 325 个活动标题（一次性）+ 每周 103 个新活动：

| 服务 | 一次性成本 | 月度成本 | 质量 | 推荐 |
|------|-----------|---------|------|------|
| **Gemini** | $0.00 | $0.00 | ⭐⭐⭐⭐ | ✅ 首选 |
| **OpenAI** | $0.003 | $0.004 | ⭐⭐⭐⭐⭐ | ✅ 备选 |
| **Mistral** | ~$0.002 | ~$0.003 | ⭐⭐⭐⭐ | ✅ 备选 |
| **Google Translate** | $0.00 | $0.00 | ⭐⭐⭐ | ✅ 兜底 |

**结论**：使用 auto 模式 + Gemini API，完全免费且质量好！

## 🔍 工作原理

### 单个文本翻译流程

```javascript
async translate(text) {
  // 尝试 Gemini
  try {
    return await translateWithGemini(text);
  } catch {
    // Gemini 失败，尝试 OpenAI
    try {
      return await translateWithOpenAI(text);
    } catch {
      // OpenAI 失败，尝试 Mistral
      try {
        return await translateWithMistral(text);
      } catch {
        // Mistral 失败，使用 Google Translate（总是成功）
        return await translateWithGoogle(text);
      }
    }
  }
}
```

### 批量翻译

每个文本**独立**尝试回退：
- 文本 A 可能用 Gemini
- 文本 B 可能用 OpenAI（如果 Gemini 失败）
- 文本 C 可能用 Google（如果前两个都失败）

这样确保**最大成功率**！

## 🎯 使用场景

### 场景 1: 日常使用（推荐）

```bash
# 配置 Gemini API Key
GEMINI_API_KEY=your_key_here
TRANSLATOR_PROVIDER=auto

# 运行
npm run translate-existing
```

**结果**：全部用 Gemini 翻译，免费且质量好

---

### 场景 2: 追求最佳质量

```bash
# 配置所有 API Keys
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
TRANSLATOR_PROVIDER=auto

# 运行
npm run translate-existing
```

**结果**：Gemini 优先，失败时自动切换到 OpenAI，质量有保证

---

### 场景 3: 完全免费

```bash
# 不配置任何 API Key
TRANSLATOR_PROVIDER=auto

# 运行
npm run translate-existing
```

**结果**：自动使用免费的 Google Translate

---

### 场景 4: 测试对比

```bash
# 测试 Gemini
npm run translate-existing -- --provider gemini

# 测试 OpenAI
npm run translate-existing -- --provider openai

# 对比结果
sqlite3 data/events.db "SELECT title, title_zh FROM events LIMIT 10"
```

## 🛠️ 故障排除

### Q: 所有服务都失败了怎么办？

A: 不会发生！Google Translate 免费接口是兜底方案，总会成功。

### Q: 想看每个服务的成功率？

A: 翻译完成后会自动显示统计：

```
📊 翻译统计:
   总计: 325 个文本
   🔮 Gemini: 250 (77%)
   🤖 OpenAI: 50 (15%)
   🌐 Google: 25 (8%)
```

### Q: 如何提高 Gemini 的使用率？

A: 确保：
1. GEMINI_API_KEY 配置正确
2. API Key 有足够的免费额度
3. 网络连接正常

### Q: 可以调整优先级顺序吗？

A: 可以！编辑 `src/utils/translator.js` 的第 82 行：

```javascript
// 当前优先级
const priority = ['gemini', 'openai', 'mistral', 'google'];

// 修改为你想要的顺序，例如：
const priority = ['openai', 'gemini', 'mistral', 'google'];
```

## 📝 最佳实践

1. **推荐配置**：
   ```bash
   GEMINI_API_KEY=your_key
   TRANSLATOR_PROVIDER=auto
   ```

2. **初次翻译历史数据**：
   ```bash
   npm run translate-existing
   ```

3. **日常爬虫**：
   ```bash
   npm run scrape  # 自动翻译新活动
   ```

4. **监控翻译质量**：
   - 查看统计信息
   - 抽查部分翻译结果
   - 必要时手动修正

5. **成本控制**：
   - 使用 Gemini（免费）
   - 设置每批延迟避免速率限制
   - 定期检查 API 使用量

## 🎉 总结

- ✅ **自动模式**是最佳选择
- ✅ 配置 **Gemini API Key** 即可免费使用
- ✅ 翻译会**自动回退**，确保成功
- ✅ 每个文本都会显示**使用的服务**
- ✅ 完成后有**详细统计**

立即体验：

```bash
npm run translate-existing
```

享受智能翻译带来的便利！🚀
