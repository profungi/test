# 代码重构测试指南

## 📋 重构总结

完成了4个模块的重构，改进了代码结构和可维护性：

1. **去重逻辑** (src/scrape-events.js)
2. **AI故障转移** (src/utils/ai-service.js)
3. **翻译器备选** (src/formatters/translator.js)
4. **URL缩短重试** (src/utils/url-shortener.js)

**代码统计**：
- 修改了4个文件
- +361 行新代码
- -248 行旧代码
- 净增加113行（主要是配置和注释）

---

## 🧪 测试方案

### ✅ 测试1：基础语法检查

```bash
# 检查所有修改的文件语法
node -c src/scrape-events.js
node -c src/utils/ai-service.js
node -c src/formatters/translator.js
node -c src/utils/url-shortener.js

# 如果都没报错，说明语法正确
```

---

### ✅ 测试2：抓取流程测试（测试去重逻辑）

```bash
# 运行完整的抓取流程
npm run scrape

# 预期结果：
# ✅ 看到"🔄 开始去重处理..."
# ✅ 看到"📝 去重: [活动标题]"的日志
# ✅ 看到"✅ 内存去重: X → Y"
# ✅ 看到"✅ 数据库去重: Y → Z"
# ✅ 最后生成 output/review_*.json 文件
```

**验证点**：
- [ ] 去重日志格式清晰
- [ ] 相同URL的活动被去重
- [ ] 相同标题+时间+地点的活动被去重
- [ ] 生成的review文件包含唯一的活动

---

### ✅ 测试3：AI故障转移测试

**场景A：主provider成功**
```bash
# 设置使用Mistral（假设配置正确）
export AI_PROVIDER=mistral
npm run scrape

# 预期结果：
# ✅ 看到"🤖 Trying AI provider: mistral"
# ✅ AI分类成功，没有fallback
```

**场景B：主provider失败，fallback成功**
```bash
# 设置一个无效的API key测试fallback
export MISTRAL_API_KEY=invalid_key_test
export AI_PROVIDER=mistral
npm run scrape

# 预期结果：
# ✅ 看到"🤖 Trying AI provider: mistral"
# ✅ 看到"❌ mistral failed: ..."
# ✅ 看到"🤖 Trying AI provider: [下一个provider]"
# ✅ 最终分类成功（如果有其他可用provider）
```

**验证点**：
- [ ] 主provider优先尝试
- [ ] 失败后自动尝试其他provider
- [ ] 不会陷入无限递归
- [ ] 所有provider都失败时报错清晰

---

### ✅ 测试4：翻译器模式匹配测试

创建测试文件：

```bash
node test-translator-patterns.js
```

**test-translator-patterns.js** (创建这个文件):
```javascript
const ContentTranslator = require('./src/formatters/translator');

const translator = new ContentTranslator();

// 测试用例
const testEvents = [
  {
    title: 'Halloween Costume Party',
    description: 'Costume contest, pumpkin carving, trick-or-treating',
    expected: '服装比赛、南瓜雕刻、不给糖就捣蛋，万圣节主题活动'
  },
  {
    title: 'Oakland Diwali Festival',
    description: 'Indian dance performances',
    expected: '印度舞蹈和音乐表演，南亚美食摊位，Diwali点灯仪式'
  },
  {
    title: 'Jazz Night - Miles Davis Tribute',
    description: 'Live jazz performance',
    expected: 'Miles Davis Tribute爵士音乐现场演出'
  },
  {
    title: 'Pet Adoption Fair',
    description: 'Dogs and cats available for adoption',
    expected: '宠物服装秀、狗狗互动游戏、拍照打卡'
  }
];

console.log('测试翻译器模式匹配...\n');

testEvents.forEach((test, i) => {
  const event = {
    title: test.title,
    description: test.description
  };

  const result = translator.generateSimpleDescription(event);
  const passed = result === test.expected;

  console.log(`测试 ${i + 1}: ${passed ? '✅' : '❌'}`);
  console.log(`  输入: ${test.title}`);
  console.log(`  预期: ${test.expected}`);
  console.log(`  实际: ${result}`);
  console.log('');
});
```

**验证点**：
- [ ] Halloween活动识别并提取特征
- [ ] Diwali活动返回固定描述
- [ ] Concert活动提取艺术家名
- [ ] Pet活动匹配成功

---

### ✅ 测试5：URL缩短重试测试

创建测试文件：

```bash
node test-url-shortener-retry.js
```

**test-url-shortener-retry.js**:
```javascript
const URLShortener = require('./src/utils/url-shortener');

const shortener = new URLShortener();

async function testRetryLogic() {
  console.log('测试URL缩短重试逻辑...\n');

  try {
    // 测试正常缩短
    console.log('测试1: 正常缩短URL');
    const url1 = await shortener.shortenUrl('https://example.com/test1', 'Test Event');
    console.log(`✅ 成功: ${url1}\n`);

    // 测试无效URL
    console.log('测试2: 无效URL格式');
    try {
      await shortener.shortenUrl('not-a-valid-url');
      console.log('❌ 应该抛出错误但没有\n');
    } catch (error) {
      console.log(`✅ 正确抛出错误: ${error.message}\n`);
    }

    // 测试标签功能
    console.log('测试3: 带标签的URL');
    const event = {
      price: 'Free',
      location: 'San Francisco, CA'
    };
    const tags = shortener.generateTagsForEvent(event);
    console.log(`✅ 生成标签: ${tags.join(', ')}\n`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testRetryLogic();
```

**验证点**：
- [ ] 正常URL可以成功缩短
- [ ] 无效URL抛出清晰错误
- [ ] 重试逻辑正常工作
- [ ] 标签生成正确

---

### ✅ 测试6：完整流程测试

```bash
# 运行完整的抓取+生成流程
npm run scrape

# 等待完成后，查看生成的review文件
ls -lh output/

# 选择一个review文件，运行生成
npm run generate-post "./output/review_YYYY-MM-DD_HHMM.json"

# 预期结果：
# ✅ 抓取成功，去重正常
# ✅ AI分类或fallback成功
# ✅ 生成review文件
# ✅ 翻译成功（带中文标题）
# ✅ 短链接生成成功（或使用原链接）
# ✅ 生成最终的小红书内容
```

**验证点**：
- [ ] 整个流程无错误完成
- [ ] 各个改进的模块都正常工作
- [ ] 输出内容格式正确
- [ ] 日志信息清晰易读

---

## 🐛 常见问题排查

### 问题1：AI分类失败

**症状**：看到大量 "Failed to classify batch X" 错误

**原因**：AI返回的JSON被markdown包裹

**解决**：已修复（ai-classifier.js:176-182添加了清理逻辑）

**验证**：
```bash
# 应该看到成功的分类日志，而不是JSON解析错误
npm run scrape 2>&1 | grep "Classification completed"
```

---

### 问题2：翻译没有中文

**症状**：标题只有英文，没有中文翻译

**原因**：AI提示词不够明确，或AI翻译失败使用了fallback

**解决**：
1. 已改进提示词（translator.js:109-226）
2. 已扩展fallback词典（translator.js:257-288）

**验证**：
```bash
# 查看生成的内容，标题应该是 "emoji + 英文 + 中文" 格式
cat output/weekly_events_*.txt | grep "^🎉\|^🛒\|^🍽️"
```

---

### 问题3：短链接生成失败

**症状**：所有活动都使用原始URL

**原因**：
- Short.io API key未配置
- API quota用完
- 网络问题

**排查**：
```bash
# 检查API key配置
echo $SHORTIO_API_KEY

# 查看详细错误
npm run generate-post "output/review_*.json" 2>&1 | grep "短链接"
```

---

## 📊 性能对比

### 重构前
- 去重逻辑：76行，3层嵌套
- AI故障转移：使用递归+隐藏标志
- 翻译备选：109行if-else链
- URL重试：87行，5层嵌套

### 重构后
- 去重逻辑：85行（+4个helper函数），逻辑清晰
- AI故障转移：迭代循环，无递归
- 翻译备选：配置驱动，易扩展
- URL重试：3个独立函数，职责分离

**可维护性提升**：⭐⭐⭐⭐⭐

---

## ✅ 测试清单

完成以下测试后打勾：

- [ ] 语法检查全部通过
- [ ] 抓取流程正常运行
- [ ] 去重逻辑正确
- [ ] AI分类成功（或fallback成功）
- [ ] 翻译器模式匹配正确
- [ ] 短链接生成正常
- [ ] 完整流程端到端测试通过
- [ ] 日志输出清晰易读
- [ ] 错误处理合理
- [ ] 性能无明显下降

---

## 📝 回退方案

如果测试发现重大问题，可以回退到之前的版本：

```bash
# 查看改动
git diff HEAD

# 回退所有改动
git checkout -- src/scrape-events.js src/utils/ai-service.js src/formatters/translator.js src/utils/url-shortener.js

# 或者回退单个文件
git checkout -- src/scrape-events.js
```

---

## 🎯 后续优化建议

1. **添加单元测试**：为每个重构的函数编写测试用例
2. **性能监控**：添加计时日志，监控各阶段耗时
3. **配置外部化**：将EVENT_PATTERNS移到配置文件
4. **错误收集**：汇总所有错误到统一的错误报告
5. **日志分级**：使用不同级别（debug/info/warn/error）

---

**测试负责人签字**：_____________

**测试日期**：_____________

**测试结果**：[ ] 通过  [ ] 失败  [ ] 部分通过
