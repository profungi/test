# 测试完整指南总结

> 如何测试抓取效率优化代码 — 完整的三层测试方案

## 🎯 三层测试方案

### 第一层：快速验证 (30 秒 - 5 分钟)

**用途**：确认代码修改是否存在且正确

**运行方式**：
```bash
node quick-test.js
```

**检查内容**：
- ✅ 5 个数据库索引是否在代码中
- ✅ 关键词搜索阈值常量是否存在
- ✅ 条件判断逻辑是否正确

**预期输出**：
```
✅ 优化代码验证通过！
   - 数据库索引已全部实现
   - 关键词搜索阈值已实现
```

**成功标准**：全部显示 ✅

---

### 第二层：完整自动化测试 (20 分钟)

**用途**：全面测试优化功能的正确性和性能

**运行方式**：
```bash
node test-optimizations.js              # 运行所有测试
node test-optimizations.js --db-only    # 仅数据库
node test-optimizations.js --keyword    # 仅关键词搜索
```

**包括的测试**：

1. **数据库索引测试**
   - 索引是否正确创建
   - 查询性能是否提升
   - 重复创建是否安全

2. **关键词搜索测试**
   - 阈值是否正确设置
   - 条件判断是否有效
   - 日志输出是否正确

3. **健壮性测试**
   - 多次运行是否崩溃
   - 错误处理是否完善
   - 旧数据库是否自动升级

**预期输出**：
```
📊 测试总结
通过: 8/8 (100%)

✅ 数据库索引存在性
✅ 关键词搜索逻辑
✅ 查询性能 (带索引) - 45ms
✅ 索引创建健壮性
✅ 关键词阈值行为

🎉 所有测试通过！优化已成功实施
```

**成功标准**：所有测试通过 (100%)

---

### 第三层：手动功能测试 (1 小时+)

**用途**：在实际使用场景中验证优化效果

#### 测试 3.1: 实际抓取验证

```bash
# 清空数据库
npm run clear-events

# 运行抓取，记录耗时
time npm run scrape
```

**检查点**：
- [ ] 抓取完成，无错误
- [ ] 日志显示索引已创建
- [ ] 关键词搜索被跳过（如果事件 >= 50）
- [ ] 生成的审核文件正确
- [ ] 耗时减少了 10-18%

#### 测试 3.2: 数据库查询性能

```bash
sqlite3 data/events.db

# 在 SQLite 命令行中：
.timer on

SELECT title FROM events
WHERE week_identifier = '2024-10-21_to_2024-10-27'
AND location = 'San Francisco'
LIMIT 10;
```

**预期**：
- 耗时 < 50ms（有索引）
- 显示 "SEARCH events USING INDEX idx_events_dedup"

#### 测试 3.3: 关键词搜索逻辑

**场景 1**：事件数 < 50（应该执行搜索）

```bash
# 修改阈值临时调低以测试
const keywordSearchThreshold = 10;

npm run scrape

# 在日志中查找：
# "Scraping additional searches: festival, fair, ..."
```

**场景 2**：事件数 >= 50（应该跳过搜索）

```bash
# 恢复或保持正常阈值
const keywordSearchThreshold = 50;

npm run scrape

# 在日志中查找：
# "⏭️ Skipping keyword searches (already have XX events"
```

#### 测试 3.4: 数据完整性

```bash
# 验证去重仍然工作正常
node -e "
const db = require('./src/utils/database');
const d = new db();
d.connect().then(async () => {
  const event = { title: 'Test', startTime: '2024-10-21T10:00:00', location: 'SF', originalUrl: 'http://test.com', source: 'test', weekIdentifier: '2024-10-21_to_2024-10-27' };
  const r1 = await d.saveEvent(event);
  const r2 = await d.saveEvent(event);
  console.log('First save:', r1.saved ? '✅ Saved' : '❌ Duplicate');
  console.log('Second save:', !r2.saved ? '✅ Duplicate detected' : '❌ Should be duplicate');
  await d.close();
});
"
```

**预期输出**：
```
First save: ✅ Saved
Second save: ✅ Duplicate detected
```

---

## 📚 文档总览

你现在拥有完整的测试文档套件：

| 文件 | 用途 | 时间 |
|------|------|------|
| `quick-test.js` | 自动化快速检查 | 30秒 |
| `test-optimizations.js` | 完整自动化测试 | 20分钟 |
| `TESTING_CHEATSHEET.md` | 速查表（推荐首先阅读）| 5分钟 |
| `TEST_GUIDE.md` | 详细测试指南 | 参考 |
| `SCRAPING_OPTIMIZATION.md` | 优化方案文档 | 参考 |
| `TESTING_SUMMARY.md` | 这个文件 | 概览 |

---

## 🚀 快速开始（推荐顺序）

### 第一次测试（推荐用时：30 分钟）

```bash
# 1. 快速验证 (30秒)
node quick-test.js

# 2. 如果通过，运行完整测试 (20分钟)
node test-optimizations.js

# 3. 查看详细指南
cat TESTING_CHEATSHEET.md
```

### 日常验证（推荐用时：5 分钟）

```bash
# 仅快速检查代码
node quick-test.js

# 或者运行实际抓取
npm run scrape
```

### 详细测试（推荐用时：1 小时）

```bash
# 参考详细指南
cat TEST_GUIDE.md

# 按步骤进行手动测试
```

---

## ✅ 验收标准

### 级别 1：快速验证 ✅ (必须通过)

- [ ] `node quick-test.js` 显示所有 ✅
- [ ] 5 个数据库索引代码存在
- [ ] 关键词搜索阈值代码存在

### 级别 2：完整测试 ✅ (强烈建议通过)

- [ ] `node test-optimizations.js` 100% 通过
- [ ] 数据库索引测试通过
- [ ] 关键词搜索逻辑测试通过
- [ ] 健壮性测试通过

### 级别 3：实际验证 ✅ (生产环境前必须通过)

- [ ] `npm run scrape` 正常完成
- [ ] 日志输出正确
- [ ] 生成文件有效
- [ ] 耗时减少 10-18%
- [ ] 无新增错误

---

## 🔍 关键测试点

### 数据库索引验证

```bash
# 验证索引存在
sqlite3 data/events.db ".indices"

# 验证索引被使用
sqlite3 data/events.db
EXPLAIN QUERY PLAN SELECT * FROM events
WHERE week_identifier = '2024-10-21_to_2024-10-27'
AND location = 'San Francisco';

# 验证查询性能
.timer on
SELECT COUNT(*) FROM events WHERE week_identifier = '2024-10-21_to_2024-10-27';
```

### 关键词搜索验证

```bash
# 检查代码
grep -n "keywordSearchThreshold" src/scrapers/eventbrite-scraper.js

# 验证逻辑
grep -A 3 "events.length < keywordSearchThreshold" src/scrapers/eventbrite-scraper.js

# 实际运行观察日志
npm run scrape 2>&1 | grep -i "keyword\|skipping"
```

---

## 🆘 故障排查快速指南

| 症状 | 原因 | 解决方案 |
|------|------|---------|
| `quick-test.js` 失败 | 代码修改有问题 | 检查 src/utils/database.js 和 eventbrite-scraper.js |
| `test-optimizations.js` 失败 | 测试环境问题 | 运行 `npm install` 并清空 data/events.db |
| SQLite 查询慢 | 索引未被使用 | 检查 EXPLAIN QUERY PLAN 输出 |
| 关键词搜索仍在继续 | 阈值设置错误 | 检查是否修改了 keywordSearchThreshold 值 |
| 数据库权限错误 | 文件权限问题 | 运行 `rm -f data/events.db` 重建 |

---

## 📊 预期结果

### 性能改进

```
优化前: 12 分钟
优化后: 10-10.5 分钟
提升: 10-18% ⬆️
```

### 日志输出

```
✅ Database indexes created/verified      (数据库)
📊 Current events: 45/50 (threshold)      (接近阈值)
✅ Found 3 festival events                (搜索继续)
⏭️ Skipping keyword searches               (已达阈值，跳过)
```

---

## 🎓 学习资源

### 代码位置

- **数据库优化**：`/code/src/utils/database.js:91-147`
- **关键词优化**：`/code/src/scrapers/eventbrite-scraper.js:55-88`

### 相关文档

- `SCRAPING_OPTIMIZATION.md` - 优化方案详解
- `TEST_GUIDE.md` - 详细测试指南
- `TESTING_CHEATSHEET.md` - 速查表

---

## 💡 建议

1. **首次测试**：按照上述"快速开始"顺序进行
2. **日常使用**：只需运行 `node quick-test.js` 确认
3. **部署前**：必须通过级别 2 的完整测试
4. **问题排查**：参考"故障排查"表格和 `TEST_GUIDE.md`

---

## 📞 需要帮助？

1. **快速问题**：查看 `TESTING_CHEATSHEET.md`
2. **详细问题**：查看 `TEST_GUIDE.md`
3. **优化细节**：查看 `SCRAPING_OPTIMIZATION.md`
4. **代码问题**：检查源文件中的注释

---

**版本**：1.0
**更新日期**：2024-10-22
**维护者**：Claude Code

---

**下一步**：运行 `node quick-test.js` 开始测试！ 🚀
