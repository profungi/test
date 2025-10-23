# 🔍 运行诊断 - description_detail 为空问题

> 按照这个步骤进行诊断，找出真正的原因

## 步骤 1️⃣: 运行自动化诊断脚本

```bash
node DIAGNOSTIC_SCRIPT.js
```

**这个脚本会显示：**
- ✅ 有多少事件有/没有 description_detail
- ✅ 各个来源的统计
- ✅ 错误日志中的相关信息
- ✅ 代码中的 CSS 选择器
- ✅ 建议的下一步行动

**示例输出：**
```
📊 诊断 1: 检查数据库中的 description_detail 字段
────────────────────────────────────────
✅ 总事件数: 45
   - 有 description_detail: 0
   - 空 description_detail: 45
   - 非空 description_detail: 0

❌ 结论: 所有事件的 description_detail 都是空的！
```

---

## 步骤 2️⃣: 检查错误日志（如果步骤1显示有错误）

如果诊断脚本显示有错误，查看完整的抓取输出：

```bash
# 清空数据库重新运行一次
npm run clear-events

# 运行抓取，并保存输出
npm run scrape 2>&1 | tee scrape_output.log

# 查看关键错误
grep -i "error\|failed\|description\|detail" scrape_output.log
```

**查找的关键词：**
- `Failed to fetch` - 详情页抓取失败
- `error` - 任何错误
- `description` - 与描述相关
- `timed out` - 超时

---

## 步骤 3️⃣: 手动检查 CSS 选择器（最关键）

这是最可能的原因。按照以下步骤：

### 3.1 打开 Eventbrite 活动详情页

1. 访问 eventbrite.com（中国访问可能受限，使用 VPN）
2. 搜索任意活动（例如 San Francisco events）
3. 打开任意活动的详情页

### 3.2 打开开发者工具

按 `F12` 或右键 → "检查元素"

### 3.3 在控制台中测试选择器

打开浏览器的"控制台"标签，复制粘贴以下代码：

```javascript
// 测试现有的 6 个选择器
const selectors = [
  '[class*="structured-content"]',
  '[data-testid="description"]',
  '[class*="event-details__main"]',
  '[class*="description-content"]',
  '[class*="event-description"]',
  '.event-details'
];

console.log('🔍 测试选择器结果：\n');
selectors.forEach(selector => {
  const element = document.querySelector(selector);
  if (element) {
    const text = element.textContent.trim().substring(0, 50);
    console.log(`✅ ${selector}`);
    console.log(`   找到元素，文本预览: "${text}..."\n`);
  } else {
    console.log(`❌ ${selector} - 未找到\n`);
  }
});
```

**记录结果：**
- 哪些选择器找到了元素？
- 哪些选择器没有找到？
- 文本长度是多少？

### 3.4 寻找描述元素的正确选择器

如果上面的选择器都失效，运行这个代码找到描述：

```javascript
// 方法 1: 搜索所有包含大量文本的元素
console.log('🔍 寻找潜在的描述元素:\n');
document.querySelectorAll('*').forEach(el => {
  const text = el.textContent.trim();
  // 只看 100-2000 字符的元素（可能是描述）
  if (text.length > 100 && text.length < 2000) {
    // 排除脚本和常见垃圾元素
    if (!['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) {
      const hasDescriptionKeywords = /description|details|about|information/i.test(text.substring(0, 200));
      if (hasDescriptionKeywords || el.textContent.split('\n').length > 3) {
        console.log(`发现潜在描述元素:`);
        console.log(`  类型: ${el.tagName}`);
        console.log(`  类名: ${el.className}`);
        console.log(`  ID: ${el.id}`);
        console.log(`  长度: ${text.length}`);
        console.log(`  文本预览: ${text.substring(0, 80)}...\n`);
      }
    }
  }
});
```

**记录：** 找到的元素的 class 名、ID、或 tag 类型

### 3.5 获取正确的选择器

一旦找到描述元素，运行这个代码获取最佳选择器：

```javascript
// 假设你在控制台中选中了描述元素
// （或者用这个代码找到它）
const descElement = document.querySelector('[data-testid="description"]'); // 修改选择器
console.log('元素信息:');
console.log('Tag:', descElement.tagName);
console.log('Class:', descElement.className);
console.log('ID:', descElement.id);
console.log('Data attributes:', Array.from(descElement.attributes)
  .filter(a => a.name.startsWith('data-'))
  .map(a => `${a.name}="${a.value}"`)
  .join(', '));
```

**最终获得的信息：** 正确的 CSS 选择器是什么？

---

## 诊断结果模板

完成诊断后，用这个模板记录结果：

```markdown
### 诊断结果

**1. 数据库统计**
- 总事件数: ___
- 有 description_detail: ___ (__)%
- 无 description_detail: ___ (__)%

**2. 错误日志**
- 是否有 "Failed to fetch" 错误: 是/否
- 是否有超时错误: 是/否
- 其他错误信息: ___

**3. CSS 选择器测试**
- [class*="structured-content"]: ✅/❌
- [data-testid="description"]: ✅/❌
- [class*="event-details__main"]: ✅/❌
- [class*="description-content"]: ✅/❌
- [class*="event-description"]: ✅/❌
- .event-details: ✅/❌

**4. 找到的正确选择器**
- 选择器: ___
- 元素类型: ___
- 类名: ___
- 文本长度: ___

**5. 根本原因判断**
- [ ] 选择器失效
- [ ] 网络/详情页抓取失败
- [ ] 描述太短
- [ ] 其他: ___

**6. 建议的修复**
- ___
```

---

## ⚠️ 重要提醒

- **不要修改代码** - 只是诊断
- **如果 Eventbrite 无法访问** - 使用 VPN 或尝试其他来源（SF Station、DoTheBay）
- **如果有多个选择器有效** - 我们可以保留最可靠的
- **如果没有选择器有效** - Eventbrite 可能改变了整个结构

---

## 下一步

完成诊断后：

1. 记录诊断结果（使用上面的模板）
2. 告诉我结果
3. 根据结果，我会提供具体的修复代码
4. **然后** 我们再修改代码

---

**记住：诊断先于修复！** 🔍
