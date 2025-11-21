# 语法错误修复

## 问题

```
SyntaxError: Identifier 'response' has already been declared
    at wrapSafe (node:internal/modules/cjs/loader:1691:18)
```

## 原因

在 `/code/src/utils/universal-scraper.js` 的 `scrapeWithAI` 方法中，`response` 变量被声明了两次：

```javascript
// 第202行：axios HTTP请求
const response = await axios.get(url, { ... });

// 第254行：AI chatCompletion响应
const response = await this.translator.aiService.chatCompletion(messages, { ... });
```

## 修复

将第202行的 `response` 重命名为 `httpResponse`：

```javascript
// 修复后
const httpResponse = await axios.get(url, { ... });
const html = httpResponse.data;
```

## 修改位置

- 文件: `/code/src/utils/universal-scraper.js`
- 行数: 202, 209
- 变量: `response` → `httpResponse`

## 验证

语法错误已修复，可以正常运行：

```bash
node test-manual-add.js
```

应该不再有语法错误。
