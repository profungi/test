# 翻译服务速率限制说明

## 问题：Gemini 速率限制错误

```
Error: [429 Too Many Requests] You exceeded your current quota
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
limit: 10, model: gemini-2.5-flash
Please retry in 31s
```

## 原因

Gemini 免费层有严格的速率限制：
- **每分钟最多 10 个请求**
- **每天最多 1,500 个请求**

当使用批量翻译时，很容易超出这个限制。

## 各服务速率限制对比

| 服务 | 免费层速率限制 | 适合批量翻译 | 推荐度 |
|------|---------------|-------------|--------|
| **Google Translate (免费)** | 无限制 | ✅ 是 | ⭐⭐⭐⭐⭐ |
| **Gemini** | 10 req/min | ❌ 否 | ⭐⭐ |
| **OpenAI** | 3 req/min (免费层) | ❌ 否 | ⭐⭐ |
| **Mistral** | 5 req/min (免费层) | ❌ 否 | ⭐⭐ |

## 解决方案

### 方案1: 使用 Google Translate（推荐）

**优点**：
- ✅ 完全免费
- ✅ 无速率限制
- ✅ 翻译速度快
- ✅ 质量可接受（活动标题翻译足够好）

**配置**：
```bash
# 编辑 .env 文件
TRANSLATOR_PROVIDER=google
```

**使用**：
```bash
npm run translate-existing
```

**预计时间**：
- 325个活动
- 每批10个，间隔2秒
- 总计约 **1-2 分钟**

---

### 方案2: 使用 Gemini（较慢）

**优点**：
- ✅ AI 质量较好
- ✅ 理解上下文

**缺点**：
- ❌ 速率限制严格（每分钟10个）
- ❌ 需要等待时间长
- ❌ 容易触发限制

**配置**：
```bash
# 编辑 .env 文件
GEMINI_API_KEY=your_key_here
TRANSLATOR_PROVIDER=gemini
```

**使用**：
```bash
npm run translate-existing -- --provider gemini
```

**预计时间**：
- 325个活动
- 每批2个，间隔15秒
- 总计约 **40-45 分钟** ⏰

---

### 方案3: 自动模式（平衡）

**说明**：
- 先尝试 Gemini
- 遇到速率限制自动切换到 Google Translate
- 平衡质量和速度

**配置**：
```bash
# 编辑 .env 文件
GEMINI_API_KEY=your_key_here  # 可选
TRANSLATOR_PROVIDER=auto
```

**批次策略**：
- 每批5个
- 间隔8秒
- Gemini 失败自动切换到 Google

**预计时间**：
- 约 **8-10 分钟**

## 批次大小和间隔配置

脚本会根据翻译服务自动调整：

```javascript
// Gemini 模式
batchSize = 2      // 每批 2 个
delayMs = 15000    // 间隔 15 秒

// Auto 模式
batchSize = 5      // 每批 5 个
delayMs = 8000     // 间隔 8 秒

// Google/OpenAI/Mistral 模式
batchSize = 10     // 每批 10 个
delayMs = 2000     // 间隔 2 秒
```

## 推荐使用方法

### 场景1: 首次批量翻译（推荐）

```bash
# 使用 Google Translate - 快速且无限制
TRANSLATOR_PROVIDER=google npm run translate-existing
```

**时间**: 1-2 分钟 ⚡
**成本**: $0.00
**质量**: ⭐⭐⭐⭐

---

### 场景2: 追求最佳质量

```bash
# 第一步：用 Google 快速翻译所有活动
TRANSLATOR_PROVIDER=google npm run translate-existing

# 第二步：手动审核和修正重要活动的翻译
sqlite3 data/events.db "UPDATE events SET title_zh = '修正后的翻译' WHERE id = 123;"
```

---

### 场景3: 小批量翻译

如果只有少量活动需要翻译（<50个），可以使用 Gemini：

```bash
# 使用 Gemini - 质量更好
TRANSLATOR_PROVIDER=gemini npm run translate-existing
```

**时间**: 约 5-10 分钟
**成本**: $0.00（在免费额度内）
**质量**: ⭐⭐⭐⭐⭐

## 常见问题

### Q: 如何查看当前翻译进度？

```bash
# 查看已翻译数量
sqlite3 data/events.db "SELECT COUNT(*) FROM events WHERE title_zh IS NOT NULL AND title_zh <> '';"

# 查看未翻译数量
sqlite3 data/events.db "SELECT COUNT(*) FROM events WHERE title_zh IS NULL OR title_zh = '';"
```

### Q: 遇到 Gemini 速率限制怎么办？

**选项1**: 等待并重新运行
```bash
# 等待 1 分钟后重试
sleep 60 && npm run translate-existing
```

**选项2**: 切换到 Google Translate
```bash
# 立即切换到无限制的服务
TRANSLATOR_PROVIDER=google npm run translate-existing
```

### Q: 可以混合使用吗？

可以！分步骤执行：

```bash
# 步骤1: 先用 Google 翻译大部分
TRANSLATOR_PROVIDER=google npm run translate-existing

# 步骤2: 手动清除几个需要更好翻译的活动
sqlite3 data/events.db "UPDATE events SET title_zh = NULL WHERE id IN (1, 2, 3);"

# 步骤3: 用 Gemini 重新翻译这几个
TRANSLATOR_PROVIDER=gemini npm run translate-existing
```

### Q: 如何监控 API 使用情况？

**Gemini**:
- 访问 [Google AI Studio](https://aistudio.google.com/)
- 查看 Usage 页面

**OpenAI**:
- 访问 [OpenAI Usage Dashboard](https://platform.openai.com/usage)

## 速率限制详情

### Gemini 免费层
```
每分钟限制: 10 请求
每天限制: 1,500 请求
每月限制: 1,500,000 tokens
```

### OpenAI 免费层（需要充值）
```
每分钟限制: 3 请求
每天限制: 200 请求
```

### Google Translate（免费非官方接口）
```
速率限制: 无
使用限制: 无
成本: $0.00
```

## 最佳实践

### 1. 批量翻译 - 使用 Google Translate
```bash
# 快速、免费、无限制
TRANSLATOR_PROVIDER=google npm run translate-existing
```

### 2. 质量检查
```bash
# 抽查部分翻译结果
sqlite3 data/events.db "SELECT title, title_zh FROM events LIMIT 20;"
```

### 3. 手动修正（可选）
```bash
# 修正特定活动的翻译
sqlite3 data/events.db "UPDATE events SET title_zh = '更好的翻译' WHERE id = 123;"
```

### 4. 日常使用
```bash
# 爬虫会自动翻译新活动（使用配置的服务）
npm run scrape
```

## 总结

| 需求 | 推荐方案 | 命令 |
|-----|---------|------|
| **首次批量翻译** | Google Translate | `TRANSLATOR_PROVIDER=google npm run translate-existing` |
| **追求质量** | Google + 手动修正 | 先用 Google，后手动修正重要活动 |
| **小批量翻译** | Gemini | `TRANSLATOR_PROVIDER=gemini npm run translate-existing` |
| **日常爬虫** | Google Translate | 在 .env 设置 `TRANSLATOR_PROVIDER=google` |

**建议**：对于325个活动的批量翻译，使用 Google Translate 是最佳选择！
