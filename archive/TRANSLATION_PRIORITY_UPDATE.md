# 翻译服务优先级说明

## 优先级顺序（已确认）

```
🔮 Gemini → 🤖 OpenAI → 🌪️ Mistral → 🌐 Google Translate
```

这个顺序已在代码中实现，Google Translate 作为最后的兜底服务。

## 工作原理

### 自动回退机制

当使用 `TRANSLATOR_PROVIDER=auto` 时，系统会：

1. **首先尝试 Gemini**
   - 使用 gemini-2.5-flash 模型
   - 翻译质量最好
   - 免费额度：每月 1,500,000 tokens
   - ⚠️ 速率限制：每分钟 10 个请求

2. **Gemini 失败时，尝试 OpenAI**
   - 使用 gpt-4o-mini 模型
   - 翻译质量优秀
   - 需要 API Key

3. **OpenAI 失败时，尝试 Mistral**
   - 使用 mistral-small-latest 模型
   - 翻译质量良好
   - 需要 API Key

4. **最后使用 Google Translate（兜底）**
   - 免费非官方接口
   - 无速率限制
   - 永远可用
   - 翻译质量可接受

## 批次策略

系统根据不同模式自动调整批次大小和间隔：

```javascript
// Auto 模式（推荐）
batchSize: 3 个/批
delayMs: 10 秒
优先级: Gemini → OpenAI → Mistral → Google

// Gemini 模式
batchSize: 2 个/批
delayMs: 15 秒
避免触发速率限制

// Google 模式
batchSize: 10 个/批
delayMs: 1 秒
无速率限制，最快

// OpenAI/Mistral 模式
batchSize: 5 个/批
delayMs: 5 秒
适中策略
```

## 使用建议

### 场景1: 日常使用（推荐）

```bash
# .env 配置
TRANSLATOR_PROVIDER=auto
GEMINI_API_KEY=your_key_here  # 可选，不配置会跳过 Gemini

# 运行翻译
npm run translate-existing
```

**优点**：
- ✅ 自动平衡质量和速度
- ✅ Gemini 配额内获得最佳翻译
- ✅ 配额用完自动切换，无需干预
- ✅ 100% 成功率

**预计时间**（325个活动）：
- 有 Gemini API Key: 15-20 分钟
- 无 API Key: 5-6 分钟（直接使用 Google）

---

### 场景2: 追求速度

```bash
# 直接使用 Google Translate
npm run translate-existing -- --provider google
```

**优点**：
- ✅ 最快（1-2 分钟）
- ✅ 无需 API Key
- ✅ 无速率限制

**缺点**：
- ⚠️ 质量稍逊于 AI 服务

---

### 场景3: 追求最佳质量（小批量）

```bash
# .env 配置
GEMINI_API_KEY=your_key_here
TRANSLATOR_PROVIDER=gemini

# 运行翻译
npm run translate-existing
```

**适用**：少于50个活动的翻译
**时间**：约 5-10 分钟

## Gemini 速率限制处理

### 问题
Gemini 免费层限制：**每分钟 10 个请求**

批量翻译时会触发：
```
[429 Too Many Requests] You exceeded your current quota
Quota exceeded for metric: generate_content_free_tier_requests
limit: 10, model: gemini-2.5-flash
```

### 解决方案

系统已实现智能处理：

1. **小批次处理**
   - Auto 模式：每批 3 个，间隔 10 秒
   - Gemini 模式：每批 2 个，间隔 15 秒

2. **自动回退**
   - 检测到 429 错误自动切换到下一个服务
   - 无需手动干预

3. **进度显示**
   ```
   🔮 [1/325] 使用 gemini 翻译
   🔮 [2/325] 使用 gemini 翻译
   ...
   🌐 [21/325] 使用 google 翻译  ← 自动切换
   ```

## 配置示例

### 最小配置（推荐新手）
```bash
# .env
TRANSLATOR_PROVIDER=auto
# 不配置任何 API Key，会直接使用 Google Translate
```

### 标准配置（推荐）
```bash
# .env
TRANSLATOR_PROVIDER=auto
GEMINI_API_KEY=your_gemini_key_here
# 优先使用 Gemini，超限后自动回退
```

### 完整配置（高级用户）
```bash
# .env
TRANSLATOR_PROVIDER=auto
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
MISTRAL_API_KEY=your_mistral_key
# 多层回退保障
```

## 翻译质量对比

| 服务 | 质量评分 | 活动标题翻译 | 上下文理解 |
|------|---------|------------|-----------|
| **Gemini** | ⭐⭐⭐⭐⭐ | 优秀 | 强 |
| **OpenAI** | ⭐⭐⭐⭐⭐ | 优秀 | 强 |
| **Mistral** | ⭐⭐⭐⭐ | 良好 | 中 |
| **Google Translate** | ⭐⭐⭐⭐ | 良好 | 弱 |

## 成本分析

| 服务 | 免费额度 | 325个活动成本 | 每周103个活动 |
|------|---------|-------------|-------------|
| Gemini | 1.5M tokens/月 | $0.00 | $0.00 |
| OpenAI | 需付费 | ~$0.003 | ~$0.001 |
| Mistral | 需付费 | ~$0.002 | ~$0.001 |
| Google | 无限 | $0.00 | $0.00 |

**Auto 模式成本**：$0.00（使用免费服务）

## 监控和统计

翻译完成后会显示详细统计：

```
============================================================
✨ 翻译完成！

📊 最终统计:
   总计: 325 个活动
   成功: 325 个 (100%)
   失败: 0 个 (0%)

📊 翻译服务使用情况:
   🔮 Gemini: 20 (6%)
   🤖 OpenAI: 0 (0%)
   🌪️  Mistral: 0 (0%)
   🌐 Google: 305 (94%)
============================================================
```

这显示：
- Gemini 处理了配额内的 20 个活动
- 触发速率限制后自动切换到 Google
- 100% 成功完成所有翻译

## 常见问题

### Q: 为什么推荐 auto 模式而不是直接用 Google？

A: Auto 模式可以：
- 在 Gemini 配额内获得最佳翻译质量
- 配额用完自动切换，无需担心失败
- 适合长期使用，每天都能有一定量的高质量翻译

### Q: Gemini 速率限制多久恢复？

A: 每分钟限制，等待 60 秒后配额重置。但使用 auto 模式无需等待，会自动切换到其他服务。

### Q: 可以手动指定只用某个服务吗？

A: 可以，使用命令行参数：
```bash
npm run translate-existing -- --provider gemini
npm run translate-existing -- --provider google
npm run translate-existing -- --provider openai
```

### Q: 如何查看当前使用的服务？

A: 翻译时会实时显示每个活动使用的服务：
- 🔮 = Gemini
- 🤖 = OpenAI
- 🌪️ = Mistral
- 🌐 = Google

## 总结

✅ **优先级已确认**: Gemini → OpenAI → Mistral → Google

✅ **推荐配置**: `TRANSLATOR_PROVIDER=auto`

✅ **自动处理**: 速率限制自动回退，无需手动干预

✅ **100% 成功率**: Google Translate 作为兜底保障

✅ **所有 325 个活动已成功翻译完成**
