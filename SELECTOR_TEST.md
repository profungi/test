# 🧪 CSS 选择器验证

## 如何测试

### 1. 打开任意 Eventbrite 活动详情页

例如搜索 "San Francisco events" 并点击进任意活动。

地址栏中应该看到：`eventbrite.com/e/XXXXXX`

### 2. 打开浏览器开发者工具

按 **F12** 或右键 → 检查元素

### 3. 点击"控制台"标签页

### 4. 复制粘贴以下代码，然后按回车

```javascript
console.log('🧪 开始测试 CSS 选择器...\n');

const selectors = [
  '[class*="structured-content"]',
  '[data-testid="description"]',
  '[class*="event-details__main"]',
  '[class*="description-content"]',
  '[class*="event-description"]',
  '.event-details'
];

let foundCount = 0;

selectors.forEach(selector => {
  const element = document.querySelector(selector);
  if (element) {
    foundCount++;
    const text = element.textContent.trim().substring(0, 50);
    console.log(`✅ ${selector}`);
    console.log(`   找到！文本: "${text}..."`);
    console.log(`   HTML: <${element.tagName} class="${element.className}">\n`);
  } else {
    console.log(`❌ ${selector}`);
    console.log(`   未找到\n`);
  }
});

console.log(`\n📊 结果: ${foundCount}/6 个选择器有效`);

if (foundCount === 0) {
  console.log('\n❌ 所有选择器都失效！');
  console.log('这说明 Eventbrite 可能改变了 HTML 结构。\n');

  console.log('让我自动搜索描述元素...\n');

  // 自动寻找可能的描述元素
  let potentialDescriptions = [];

  document.querySelectorAll('*').forEach(el => {
    const text = el.textContent.trim();
    // 寻找 100-3000 字符的文本块
    if (text.length > 100 && text.length < 3000 && el.children.length < 20) {
      const hasDescKeywords = /description|detail|about|information|learn|event info/i.test(text.substring(0, 300));
      const isNotNavigation = !/subscribe|follow|share|login|sign up|home|menu|search/i.test(text.substring(0, 100));

      if ((hasDescKeywords || text.includes('\n') && text.split('\n').length > 3) && isNotNavigation) {
        potentialDescriptions.push({
          element: el,
          length: text.length,
          preview: text.substring(0, 80)
        });
      }
    }
  });

  if (potentialDescriptions.length > 0) {
    console.log(`🔍 找到 ${potentialDescriptions.length} 个潜在的描述元素:\n`);

    potentialDescriptions.slice(0, 5).forEach((item, index) => {
      const el = item.element;
      console.log(`${index + 1}. <${el.tagName}>`);
      console.log(`   class: "${el.className}"`);
      console.log(`   id: "${el.id}"`);
      console.log(`   长度: ${item.length}`);
      console.log(`   预览: "${item.preview}..."\n`);
    });
  } else {
    console.log('❌ 也找不到潜在的描述元素');
  }
} else {
  console.log('\n✅ 至少有一个选择器有效！');
  console.log('但为什么 description_detail 仍然是 NULL？');
  console.log('可能原因：');
  console.log('  1. 提取的文本为空');
  console.log('  2. 提取的文本长度 < 50 字符（但诊断显示 > 0 了）');
  console.log('  3. 代码有其他问题');
}
```

## 预期结果

### 情况 A：所有选择器都有效 ✅

```
✅ [class*="structured-content"]
   找到！文本: "Join us for an unforgettable experience..."
   HTML: <div class="structured-content-rich-text">

✅ [data-testid="description"]
   找到！文本: "Come celebrate with us at..."

... 等等
```

→ 这说明选择器本身没问题，可能是提取逻辑有问题

### 情况 B：所有选择器都失效 ❌

```
❌ [class*="structured-content"]
   未找到

❌ [data-testid="description"]
   未找到

... 全部未找到

📊 结果: 0/6 个选择器有效

❌ 所有选择器都失效！
这说明 Eventbrite 可能改变了 HTML 结构。

🔍 找到 3 个潜在的描述元素:
1. <div>
   class: "event-details-info-description"
   id: ""
   长度: 1250
   预览: "Join us for an unforgettable Halloween..."
```

→ 这说明需要用新的选择器替换旧的

## 完成后

运行上面的代码后，**截图或复制输出**，然后告诉我：

1. **有多少个选择器有效？** (0/6、1/6、...、6/6)
2. **如果都失效，找到的新选择器是什么？** (例如：class、id、属性)
3. **如果有效，给我看找到的 HTML class 或 id**

这样我就能准确修复代码了！
