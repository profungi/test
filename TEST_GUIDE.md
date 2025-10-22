# 🧪 优化代码测试指南

> 完整的测试方案，包括快速验证、性能测试和完整功能测试

## 📋 目录

1. [快速验证（5 分钟）](#快速验证5-分钟)
2. [性能测试（20 分钟）](#性能测试20-分钟)
3. [完整功能测试（1 小时+）](#完整功能测试1-小时)
4. [手动测试清单](#手动测试清单)
5. [故障排查](#故障排查)

---

## 🚀 快速验证（5 分钟）

### 方法 1: 自动化验证脚本

```bash
# 安装依赖（如果还没装）
npm install

# 运行完整测试套件
node test-optimizations.js

# 或者只测试某一部分
node test-optimizations.js --db-only      # 仅数据库索引
node test-optimizations.js --keyword      # 仅关键词搜索
```

**预期输出：**

```
✅ 所有索引已创建：
   ✓ idx_events_dedup
   ✓ idx_events_week
   ✓ idx_events_location
   ✓ idx_events_normalized_title
   ✓ idx_events_source

✅ 关键词搜索阈值: 50
✅ 条件判断逻辑: events.length < 50
```

### 方法 2: 手动代码检查

**检查数据库索引代码：**

```bash
# 查看索引创建代码
cat src/utils/database.js | grep -A 50 "async createIndexes"
```

**预期看到：**
- 5 个 `CREATE INDEX IF NOT EXISTS` 语句
- 对应的索引名称

**检查关键词搜索代码：**

```bash
# 查看关键词搜索逻辑
cat src/scrapers/eventbrite-scraper.js | grep -A 5 "keywordSearchThreshold"
```

**预期看到：**
```javascript
const keywordSearchThreshold = 50;
if (additionalSearches.length > 0 && events.length < keywordSearchThreshold) {
```

---

## 📈 性能测试（20 分钟）

### 测试 1: 数据库查询速度

**目标：** 验证索引确实加快了查询速度

**步骤：**

```bash
# 使用 SQLite 命令行工具
sqlite3 data/events.db

# 在 SQLite 命令行中执行：
.timer on

-- 查询 1: 标准去重查询
SELECT title, normalized_title, start_time, location
FROM events
WHERE week_identifier = '2024-10-21_to_2024-10-27'
AND location = 'San Francisco'
AND ABS(julianday(start_time) - julianday('2024-10-21T10:00:00')) < 2;

-- 查询应该在几毫秒内返回结果
```

**预期：**
- ⚡ < 50ms（有索引）
- ❌ > 500ms（无索引）

**验证索引是否被使用：**

```sql
EXPLAIN QUERY PLAN
SELECT title, normalized_title, start_time, location
FROM events
WHERE week_identifier = '2024-10-21_to_2024-10-27'
AND location = 'San Francisco'
AND ABS(julianday(start_time) - julianday('2024-10-21T10:00:00')) < 2;
```

**预期输出应该包含：**
```
SEARCH events USING INDEX idx_events_dedup
```

如果看到 `SCAN TABLE events`，说明没有使用索引，需要检查。

### 测试 2: 关键词搜索门槛行为

**目标：** 验证在不同事件数量下的行为

**手动测试：**

```javascript
// 打开 Eventbrite 爬虫代码
// 设置不同的事件数量，观察日志输出

// 情况 1: events.length = 30 (< 50)
// 预期日志: "Scraping additional searches: festival, fair, ..."

// 情况 2: events.length = 55 (> 50)
// 预期日志: "⏭️ Skipping keyword searches (already have 55 events, threshold: 50)"
```

**实际测试：** 运行真实抓取

```bash
# 清空数据库以模拟新抓取
npm run clear-events

# 运行抓取，观察日志
npm run scrape

# 在日志中查找：
# - "📊 Current events: XX/50" 表示事件数在 30-50 之间
# - "⏭️ Skipping keyword searches" 表示事件数已超过 50
```

---

## 🔍 完整功能测试（1 小时+）

### 测试 3: 索引创建的健壮性

**目标：** 确保索引创建不会失败，即使多次执行

```bash
# 删除并重新创建数据库
rm -f data/events.db

# 第一次运行（创建索引）
node test-optimizations.js

# 第二次运行（验证索引已存在）
node test-optimizations.js

# 预期：两次都成功，无错误
```

### 测试 4: 实际去重功能

**目标：** 验证索引加快的去重仍然正确工作

```bash
# 创建测试数据
node -e "
const db = require('./src/utils/database');
const d = new db();
d.connect().then(async () => {
  const event = {
    title: 'Test Festival',
    startTime: '2024-10-21T10:00:00',
    location: 'San Francisco',
    originalUrl: 'https://example.com/1',
    source: 'test',
    weekIdentifier: '2024-10-21_to_2024-10-27'
  };

  const r1 = await d.saveEvent(event);
  console.log('第一次保存:', r1);

  // 尝试保存相同的事件
  const r2 = await d.saveEvent(event);
  console.log('第二次保存（应该是去重）:', r2);

  await d.close();
});
"
```

**预期输出：**
```
第一次保存: { saved: true, id: 1 }
第二次保存（应该是去重）: { saved: false, reason: 'duplicate' }
```

### 测试 5: 关键词搜索逻辑的集成测试

**目标：** 在实际抓取中验证关键词搜索行为

**场景 1：事件较少，需要关键词搜索**

```javascript
// 修改 eventbrite-scraper.js，降低阈值以便测试
const keywordSearchThreshold = 10;  // 临时改为 10

// 运行抓取，预期会看到关键词搜索日志
```

**场景 2：事件足够，跳过关键词搜索**

```javascript
// 恢复阈值或提高到 30
const keywordSearchThreshold = 30;

// 运行抓取，如果事件 >= 30，应该跳过关键词搜索
```

---

## ✅ 手动测试清单

### 数据库优化

- [ ] SQLite 中存在 5 个新索引
- [ ] `CREATE INDEX IF NOT EXISTS` 在索引已存在时不报错
- [ ] 查询性能在 50ms 以内（使用索引）
- [ ] 去重功能仍然正确（没有误删或误保存）
- [ ] 重复运行测试脚本不会崩溃
- [ ] 旧数据库（没有索引）会自动创建索引

### 关键词搜索优化

- [ ] 代码中存在 `keywordSearchThreshold` 常量，值为 50
- [ ] 事件数 < 50 时，执行关键词搜索
- [ ] 事件数 >= 50 时，跳过关键词搜索
- [ ] 日志中显示正确的提示信息
- [ ] 关键词搜索仍然在后续修改后正常工作

### 集成测试

- [ ] 完整抓取流程不报错
- [ ] 生成的审核文件包含预期数量的事件
- [ ] 没有重复事件（去重工作正常）
- [ ] 事件数据完整（标题、地点、时间等都有）

---

## 🐛 故障排查

### 问题 1: "找不到 sqlite3"

```bash
# 解决方案：安装依赖
npm install
```

### 问题 2: 索引创建失败

```bash
# 检查数据库文件权限
ls -l data/events.db

# 如果没有权限，删除并重建
rm -f data/events.db
npm run scrape
```

### 问题 3: 索引似乎没有被使用

```sql
-- 检查 EXPLAIN QUERY PLAN 输出
-- 如果看到 "SCAN TABLE" 而不是 "SEARCH ... USING INDEX"
-- 说明 SQLite 优化器没有选择索引

-- 可能原因：
-- 1. 表太小，SQLite 认为全表扫描更快
-- 2. 查询条件与索引不匹配
-- 3. 索引创建有问题

-- 解决：添加大量数据进行测试
```

### 问题 4: 关键词搜索还是在 50 个事件后执行

```bash
# 检查阈值是否正确设置
grep -n "keywordSearchThreshold" src/scrapers/eventbrite-scraper.js

# 应该看到：
# Line 58: const keywordSearchThreshold = 50;
# Line 60: if (additionalSearches.length > 0 && events.length < keywordSearchThreshold) {

# 如果没看到，可能是文件没有保存或有其他问题
```

### 问题 5: 测试脚本报错

```bash
# 逐个运行测试，看看哪个失败
node test-optimizations.js --db-only

# 如果数据库测试失败，检查：
# - 数据库文件是否存在
# - 文件权限是否正确
# - SQLite 依赖是否正确安装

# 清空测试并重新开始
rm -f data/test-events.db
node test-optimizations.js
```

---

## 📊 预期性能改进验证

### 测试方式 1: 时间对比

```bash
# 清空数据库（这样可以对比索引的效果）
rm -f data/events.db

# 记录时间 - 有索引的运行
time npm run scrape

# 预期时间: 10-10.5 分钟 (10% 左右的提升)
```

### 测试方式 2: 逐步验证

```bash
# 验证 1: 数据库查询快了多少？
node test-optimizations.js --db-only

# 验证 2: 关键词搜索被跳过了多少次？
# 查看日志中 "⏭️ Skipping" 的出现次数

# 验证 3: 总耗时是否减少了？
# 运行多次抓取，记录平均耗时
```

---

## 🎯 测试成功的标准

所有以下条件都满足时，优化验证完成：

✅ **数据库优化验证：**
- [ ] 5 个索引全部创建成功
- [ ] 查询性能在 50ms 以内
- [ ] 去重功能正确无误
- [ ] 无任何数据库错误

✅ **关键词搜索验证：**
- [ ] 阈值正确设置为 50
- [ ] 条件判断逻辑正确
- [ ] 日志输出符合预期
- [ ] 事件数据完整

✅ **集成验证：**
- [ ] 完整抓取流程成功
- [ ] 总耗时减少 10-18%
- [ ] 生成的文件正确可用
- [ ] 无新增错误或警告

---

## 📞 获取更多帮助

- **优化文档**：参考 `SCRAPING_OPTIMIZATION.md`
- **代码位置**：数据库优化 → `src/utils/database.js:91-147`
- **代码位置**：关键词优化 → `src/scrapers/eventbrite-scraper.js:55-88`

---

**最后更新：** 2024-10-22
**维护者：** Claude Code
