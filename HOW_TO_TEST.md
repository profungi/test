# 🧪 重构测试指南（快速版）

## ✅ 已完成的重构

1. **去重逻辑** - src/scrape-events.js ✅
2. **AI故障转移** - src/utils/ai-service.js ✅
3. **翻译器备选** - src/formatters/translator.js ✅
4. **URL缩短重试** - src/utils/url-shortener.js ✅

---

## 🚀 快速测试（3步）

### 步骤1：运行单元测试

```bash
# 测试去重逻辑
node test-deduplication.js

# 测试翻译模式
node test-translator-patterns.js
```

**预期结果**：
- ✅ 去重测试：应该显示 "🎉 测试通过！去重逻辑正确"
- ✅ 翻译测试：应该显示 "📊 测试结果: 6/6 通过"

---

### 步骤2：运行完整抓取流程

```bash
npm run scrape
```

**预期看到的日志**：
```
🚀 开始抓取湾区活动...
🕷️  开始并行抓取数据源...
...
🔄 开始去重处理...
  ✅ 内存去重: X → Y
  ✅ 数据库去重: Y → Z
...
🤖 Trying AI provider: mistral
Classification completed using mistral (mistral-small-latest)
...
✨ 抓取完成！
📝 请审核文件: ./output/review_YYYY-MM-DD_HHMM.json
```

**验证点**：
- [ ] 去重日志格式清晰（不再有复杂的"URL去重"和"内容去重"分开）
- [ ] AI分类成功（JSON解析不再报错）
- [ ] 生成review文件

---

### 步骤3：测试翻译和生成

```bash
# 在review文件中选择几个活动（设置 "selected": true）
# 然后运行：
npm run generate-post "./output/review_YYYY-MM-DD_HHMM.json"
```

**预期看到**：
```
📝 开始生成小红书发布内容...
✅ 读取审核文件成功，共选择了 X 个活动
🔗 开始生成短链接...
🌐 开始翻译和优化内容...
📱 生成小红书发布内容...
...
✨ 内容生成完成！
📄 发布内容: ./output/weekly_events_YYYY-MM-DD_HHMM.txt
```

**验证点**：
- [ ] 短链接生成或重试正常
- [ ] 翻译的标题包含中文（如：🛒 Ferry Plaza Farmers Market 渡轮广场农夫市集）
- [ ] 特殊活动描述正确（Halloween/Diwali等）
- [ ] 生成的内容格式正确

---

## 🔍 详细验证

### 验证1：去重逻辑是否正确

查看抓取日志中的去重部分：

```bash
npm run scrape 2>&1 | grep -A 10 "开始去重处理"
```

应该看到：
- ✅ 只有一个"去重:"日志（不再分"URL去重"和"内容去重"）
- ✅ 统计清晰：原始 → 内存去重后 → 最终唯一

---

### 验证2：AI故障转移是否工作

如果你有多个AI provider配置，可以故意设置一个无效key：

```bash
# 设置Mistral的key为无效值
export MISTRAL_API_KEY="sk-invalid-test"
export AI_PROVIDER=mistral

npm run scrape 2>&1 | grep "🤖\|❌"
```

应该看到：
```
🤖 Trying AI provider: mistral
❌ mistral failed: ...
🤖 Trying AI provider: [下一个provider]
```

**不应该看到**：
- ❌ 无限递归
- ❌ "_skipFallback" 相关错误
- ❌ "tryFallbackProvider" 相关错误

---

### 验证3：翻译模式是否匹配

查看生成的内容文件：

```bash
cat output/weekly_events_*.txt
```

检查：
- [ ] 标题格式：emoji + 英文 + 中文（如：🎃 Halloween Party 万圣节派对）
- [ ] Halloween活动描述包含：服装比赛、南瓜雕刻等
- [ ] Diwali活动描述包含：印度舞蹈、点灯仪式等
- [ ] 音乐会包含艺术家名

---

### 验证4：URL缩短重试是否正确

查看生成日志：

```bash
npm run generate-post "output/review_*.json" 2>&1 | grep "重试\|生成短链接"
```

正常情况应该看到：
```
   生成短链接: https://xyz.short.io/aBcD (代码: aBcD, 标签: free, SF)
```

如果有冲突（很少见），应该看到：
```
   重试 1/5: Path aBcD already exists
   生成短链接: https://xyz.short.io/XyZ1 (代码: XyZ1)
```

---

## 🐛 常见问题

### 问题1：AI分类JSON解析失败

**以前的错误**：
```
Failed to classify batch X: Unexpected token '```'
```

**现在应该修复了**。如果还有，检查：
```bash
# 查看 ai-classifier.js 第176-182行
grep -A 8 "清理可能的markdown" src/utils/ai-classifier.js
```

应该看到清理markdown的代码。

---

### 问题2：翻译没有中文

**可能原因**：AI翻译失败，使用了fallback

**检查**：
```bash
npm run generate-post "output/review_*.json" 2>&1 | grep "translation_quality"
```

如果显示 `translation_quality: 'fallback'`，说明用了fallback。

**解决**：
1. 检查AI provider配置
2. fallback现在已增强，应该也能生成基本的中文翻译

---

### 问题3：测试文件找不到

```bash
# 确认文件存在
ls -lh test-*.js

# 应该看到：
# test-deduplication.js
# test-translator-patterns.js
```

如果不存在，文件在仓库根目录，确保你在正确的目录下运行。

---

## ✅ 测试清单

完成测试后，请在这里打勾：

- [ ] test-deduplication.js 运行通过
- [ ] test-translator-patterns.js 运行通过
- [ ] npm run scrape 成功完成
- [ ] 去重日志格式正确
- [ ] AI分类不报JSON错误
- [ ] npm run generate-post 成功完成
- [ ] 翻译的标题包含中文
- [ ] 特殊活动描述正确
- [ ] 短链接生成正常
- [ ] 完整流程端到端测试通过

---

## 📞 需要帮助？

如果遇到问题：

1. **查看详细日志**：
   ```bash
   npm run scrape 2>&1 | tee scrape.log
   ```

2. **检查特定模块**：
   ```bash
   # 去重
   grep "去重" scrape.log

   # AI分类
   grep "Classification\|AI provider" scrape.log

   # 翻译
   grep "翻译" scrape.log
   ```

3. **回退代码**（如果需要）：
   ```bash
   git log --oneline -5  # 查看最近提交
   git checkout HEAD~1   # 回退到上一个提交
   ```

---

**重构完成时间**：2025-10-18
**提交hash**：c3ee958 (修改4个可优化的点)

🎉 **祝测试顺利！**
