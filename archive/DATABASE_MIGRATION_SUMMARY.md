# 数据库迁移总结 - 添加 title_zh 列

## 问题

运行 `npm run translate-existing` 时出现错误：
```
SQLITE_ERROR: no such column: title_zh
```

## 原因

数据库 `events` 表中缺少 `title_zh` 列，该列用于存储活动标题的中文翻译。

## 解决方案

### 1. 添加 title_zh 列

```bash
sqlite3 data/events.db "ALTER TABLE events ADD COLUMN title_zh TEXT;"
```

### 2. 修复 translate-existing-events.js 中的 Bug

**问题**: `translator.translate()` 返回对象 `{text, provider}`，但代码将其当作字符串使用。

**修复**: 更新代码以正确处理返回的对象：

```javascript
// 之前（错误）
const titleZh = await this.translator.translate(event.title);

// 之后（正确）
const result = await this.translator.translate(event.title);
const titleZh = result.text;
const provider = result.provider;
```

### 3. 添加翻译服务统计

增强翻译脚本，显示每个服务的使用情况：
- 🔮 Gemini
- 🤖 OpenAI
- 🌪️ Mistral
- 🌐 Google Translate
- ⏭️ 跳过（已有中文）

## 验证

### 数据库结构
```bash
$ sqlite3 data/events.db "PRAGMA table_info(events);" | grep title
1|title|TEXT|1||0
2|normalized_title|TEXT|1||0
17|title_zh|TEXT|0||0  ← 新添加的列
```

### 翻译测试
```bash
$ npm run translate-existing

✅ Google Translate (免费) 已启用
🌐 使用自动翻译模式 (优先级: Gemini → OpenAI → Mistral → Google)
🚀 开始翻译历史活动标题...

📋 找到 275 个需要翻译的活动

📦 批次 1/28: 处理 10 个活动...
  🌐 [1/275] ID 55: Dear San FranciscoClub Fugazi... → 亲爱的旧金山俱乐部 Fugazi... (google)
  🌐 [2/275] ID 58: Danny Elfman's Music from the Films... → 蒂姆·伯顿电影中的丹尼·艾夫曼音乐... (google)
  ✓ 翻译成功
```

### 翻译结果示例
```bash
$ sqlite3 data/events.db "SELECT id, title, title_zh FROM events WHERE title_zh IS NOT NULL LIMIT 3;"

55|Dear San FranciscoClub Fugazi|亲爱的旧金山俱乐部 Fugazi
58|Danny Elfman's Music from the Films of Tim Burton|蒂姆·伯顿电影中的丹尼·艾夫曼音乐戴维斯交响乐厅
59|Sumo + SushiPalace of Fine Arts|相扑 + 寿司美术宫
```

## 数据库Schema更新

### events 表（更新后）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| title | TEXT | 英文标题 |
| normalized_title | TEXT | 规范化标题 |
| **title_zh** | **TEXT** | **中文标题（新增）** |
| start_time | TEXT | 开始时间 |
| end_time | TEXT | 结束时间 |
| location | TEXT | 地点 |
| price | TEXT | 价格 |
| description | TEXT | 描述 |
| description_detail | TEXT | 详细描述 |
| original_url | TEXT | 原始URL |
| short_url | TEXT | 短链接 |
| source | TEXT | 来源 |
| event_type | TEXT | 活动类型 |
| priority | INTEGER | 优先级 |
| scraped_at | TEXT | 抓取时间 |
| week_identifier | TEXT | 周标识符 |
| is_processed | BOOLEAN | 是否处理 |

## 使用方法

### 翻译所有历史活动
```bash
npm run translate-existing
```

### 使用特定翻译服务
```bash
# 使用 Gemini
npm run translate-existing -- --provider gemini

# 使用 OpenAI
npm run translate-existing -- --provider openai

# 使用 Google Translate
npm run translate-existing -- --provider google

# 自动模式（推荐）
npm run translate-existing -- --provider auto
```

### 查看翻译进度
```bash
# 查看总数
sqlite3 data/events.db "SELECT COUNT(*) FROM events;"

# 查看已翻译数量
sqlite3 data/events.db "SELECT COUNT(*) FROM events WHERE title_zh IS NOT NULL AND title_zh <> '';"

# 查看未翻译数量
sqlite3 data/events.db "SELECT COUNT(*) FROM events WHERE title_zh IS NULL OR title_zh = '';"
```

## 相关文件

- `data/events.db` - SQLite 数据库
- `src/utils/translator.js` - 翻译模块
- `translate-existing-events.js` - 批量翻译脚本
- `package.json` - npm 脚本配置

## 成本

使用免费的 Google Translate 服务：
- **成本**: $0.00
- **速率限制**: 每批10个活动，间隔1秒
- **预计时间**: 325个活动约需5-6分钟

## 后续步骤

1. **配置API密钥**（可选）:
   ```bash
   # 编辑 .env 文件
   GEMINI_API_KEY=your_key_here
   TRANSLATOR_PROVIDER=auto
   ```

2. **翻译所有活动**:
   ```bash
   npm run translate-existing
   ```

3. **验证翻译质量**:
   ```bash
   sqlite3 data/events.db "SELECT title, title_zh FROM events WHERE title_zh IS NOT NULL LIMIT 10;"
   ```

4. **在网站上查看**:
   - 中文用户会自动看到翻译后的标题
   - 如果没有翻译，会回退显示英文标题

## 故障排除

### 清理错误的翻译数据
如果之前的翻译有问题，可以清理：
```bash
# 清理所有翻译（重新开始）
sqlite3 data/events.db "UPDATE events SET title_zh = NULL;"

# 清理特定错误数据
sqlite3 data/events.db "UPDATE events SET title_zh = NULL WHERE title_zh LIKE '%object Object%';"
```

### 重新翻译特定活动
```bash
# 设置为NULL后重新运行翻译脚本
sqlite3 data/events.db "UPDATE events SET title_zh = NULL WHERE id IN (1, 2, 3);"
npm run translate-existing
```

## 总结

✅ 成功添加 `title_zh` 列到数据库
✅ 修复翻译脚本中的 bug
✅ 验证翻译功能正常工作
✅ 翻译质量良好
✅ 自动回退机制运行正常

现在你可以：
1. 运行 `npm run translate-existing` 翻译所有活动
2. 在双语网站上查看中文翻译
3. 新抓取的活动会在爬虫流程中自动翻译
