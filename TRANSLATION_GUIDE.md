# 翻译指南

## 速率限制优化策略

### Gemini API 限制
- **免费版限制**: 15 RPM (Requests Per Minute)
- **我们的策略**: ~10 请求/分钟（留有 33% 安全边距）

### 智能速率控制

#### 1. **批次大小和延迟**
```bash
# Gemini/auto 模式（保守）
- 批次大小: 5 个/批
- 批次间隔: 5 秒
- 批次内延迟: 200ms
- 实际速率: 约 10 请求/分钟

# 其他服务（宽松）
- 批次大小: 10 个/批
- 批次间隔: 1 秒
- 实际速率: 约 600 请求/分钟
```

#### 2. **串行 vs 并行**
- ✅ **串行处理**: 一个接一个发送请求，精确控制速率
- ❌ **并行处理**: 同时发送多个请求，容易触发限制

#### 3. **指数退避重试**
```
尝试 1: 延迟 5000ms
尝试 2: 延迟 10000ms (2x)
尝试 3: 延迟 20000ms (4x)
```

### 使用示例

#### 翻译缺失的标题
```bash
# 本地数据库 + Gemini（自动慢速模式）
node translate-missing.js

# 本地数据库 + OpenAI（快速模式）
TRANSLATOR_PROVIDER=openai node translate-missing.js

# Turso 数据库 + Gemini
USE_TURSO=1 node translate-missing.js
```

#### 运行 scraper
```bash
# 抓取下周活动（默认）
node src/scrape-events.js

# 抓取本周活动
node src/scrape-events.js --week current
```

### 预期时间

对于 116 条缺失翻译：

| 服务 | 批次大小 | 延迟 | 预计时间 |
|------|---------|------|---------|
| Gemini | 5 | 5s | ~12 分钟 |
| OpenAI | 10 | 1s | ~2 分钟 |
| Mistral | 10 | 1s | ~2 分钟 |

### 故障排除

#### 问题: 仍然遇到 429 错误
**解决方案**:
1. 等待 1 分钟后重试
2. 减少批次大小: 修改 `translate-missing.js` 中的 `batchSize = 3`
3. 增加延迟: 修改 `delayMs = 10000` (10秒)

#### 问题: 翻译速度太慢
**解决方案**:
1. 使用 OpenAI 或 Mistral 代替 Gemini
2. 设置 `TRANSLATOR_PROVIDER=openai`

#### 问题: 部分翻译失败
**解决方案**:
- 脚本会自动重试最多 3 次
- 失败的翻译会保持原文
- 可以重新运行脚本，只会处理仍然缺失的翻译

### API 密钥配置

在 `.env` 文件中设置:
```bash
# 至少配置一个
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
MISTRAL_API_KEY=your_key_here

# 翻译服务选择
TRANSLATOR_PROVIDER=auto  # 或 gemini, openai, mistral, google
```

### 技术细节

#### 为什么串行更好？
```javascript
// ❌ 并行 - 可能触发速率限制
await Promise.all([translate(1), translate(2), translate(3)]);

// ✅ 串行 - 精确控制速率
for (const item of items) {
  await translate(item);
  await sleep(200); // 可控延迟
}
```

#### 速率计算
```
Gemini 配置:
- 5 个请求/批次
- 200ms 批次内延迟 = 每批 (5 * 200ms) = 1 秒
- 5 秒批次间延迟
- 总时间/批 = 1s + 5s = 6s
- 速率 = 5 请求 / 6 秒 = 0.83 请求/秒 = 50 请求/分钟

实际更保守因为还有网络延迟和处理时间。
```
