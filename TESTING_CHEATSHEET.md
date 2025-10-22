# 🧪 测试速查表

快速参考：如何测试你写的代码优化

---

## ⚡ 最快验证 (30 秒)

```bash
node quick-test.js
```

**预期输出：**
```
✅ 优化代码验证通过！
   - 数据库索引已全部实现
   - 关键词搜索阈值已实现
```

---

## 🔍 完整自动化测试 (20 分钟)

```bash
npm install                    # 确保依赖已安装
node test-optimizations.js     # 运行完整测试套件
```

**分别测试：**
```bash
node test-optimizations.js --db-only    # 仅数据库索引
node test-optimizations.js --keyword    # 仅关键词搜索
```

---

## 🧬 代码检查

### 验证数据库索引

```bash
# 查看添加的索引
cat src/utils/database.js | grep -A 30 "async createIndexes"

# 应该看到 5 个索引：
# idx_events_dedup
# idx_events_week
# idx_events_location
# idx_events_normalized_title
# idx_events_source
```

### 验证关键词搜索

```bash
# 查看关键词搜索逻辑
cat src/scrapers/eventbrite-scraper.js | grep -B 2 -A 5 "keywordSearchThreshold"

# 应该看到：
# const keywordSearchThreshold = 50;
# if (additionalSearches.length > 0 && events.length < keywordSearchThreshold)
```

---

## 📊 SQLite 数据库检查

### 检查索引是否存在

```bash
sqlite3 data/events.db ".indices"

# 应该输出：
# idx_events_dedup
# idx_events_location
# idx_events_normalized_title
# idx_events_source
# idx_events_week
```

### 验证索引被使用

```bash
sqlite3 data/events.db

# 在 SQLite 提示符中执行：
EXPLAIN QUERY PLAN
SELECT title FROM events
WHERE week_identifier = '2024-10-21_to_2024-10-27'
AND location = 'San Francisco'
AND ABS(julianday(start_time) - julianday('2024-10-21T10:00:00')) < 2;

# 预期输出应包含：
# SEARCH events USING INDEX idx_events_dedup
```

### 检查查询速度

```bash
sqlite3 data/events.db

# 启用计时
.timer on

# 运行查询
SELECT COUNT(*) FROM events
WHERE week_identifier = '2024-10-21_to_2024-10-27'
AND location = 'San Francisco';

# 预期：< 50ms (有索引)
```

---

## 🎯 实际抓取测试

### 场景 1: 验证关键词搜索被跳过

```bash
# 清空数据库
npm run clear-events

# 运行抓取
npm run scrape

# 在日志中查找（CTRL+F）：
# "⏭️ Skipping keyword searches (already have XX events"
#
# 如果事件 >= 50，应该看到这条日志
```

### 场景 2: 完整流程测试

```bash
# 清空数据库
rm -f data/events.db

# 首次运行（创建索引）
time npm run scrape

# 预期：
# - 10-10.5 分钟（节省了时间）
# - 无数据库错误
# - 生成了审核文件

# 再次运行（验证索引重复创建）
time npm run scrape

# 预期：
# - 相同的速度
# - 没有索引重复创建错误
```

---

## ✅ 验收清单

运行以下所有检查，确保优化工作正常：

### 快速验证 (5 分钟)
- [ ] `node quick-test.js` 通过
- [ ] 代码中存在 5 个索引
- [ ] 代码中存在关键词阈值

### 数据库验证 (10 分钟)
- [ ] `sqlite3 data/events.db ".indices"` 显示 5 个索引
- [ ] `EXPLAIN QUERY PLAN` 显示使用了索引
- [ ] 查询耗时 < 50ms

### 功能验证 (30 分钟)
- [ ] `npm run scrape` 成功完成
- [ ] 日志显示 "⏭️ Skipping keyword searches" (如果事件 >= 50)
- [ ] 生成的审核文件正确
- [ ] 耗时减少 10-18%

### 完整验证 (1 小时)
- [ ] `node test-optimizations.js` 全部通过
- [ ] 多次运行不出错
- [ ] 旧数据库自动升级索引
- [ ] 新数据库正确创建索引

---

## 🆘 快速故障排查

| 问题 | 解决方案 |
|------|---------|
| `Cannot find module 'sqlite3'` | 运行 `npm install` |
| 索引未找到 | 删除 `data/events.db`，重新运行 |
| 查询仍然很慢 | 检查 `EXPLAIN QUERY PLAN` 输出 |
| 关键词搜索仍在继续 | 检查 `keywordSearchThreshold` 值 |
| 权限问题 | 检查文件权限 `ls -l data/` |

---

## 📁 测试文件位置

```
/code/
├── quick-test.js              # 30秒快速验证
├── test-optimizations.js      # 20分钟完整测试
├── TEST_GUIDE.md              # 详细测试指南
├── SCRAPING_OPTIMIZATION.md   # 优化说明文档
├── TESTING_CHEATSHEET.md      # 这个文件
│
├── src/
│   ├── utils/database.js      # 数据库索引 (Line 91-147)
│   └── scrapers/
│       └── eventbrite-scraper.js  # 关键词搜索 (Line 55-88)
│
└── data/
    └── events.db              # 数据库文件（自动创建）
```

---

## 💡 常用命令快速参考

```bash
# 安装依赖
npm install

# 快速验证 (30秒)
node quick-test.js

# 完整测试 (20分钟)
node test-optimizations.js

# 仅数据库测试
node test-optimizations.js --db-only

# 仅关键词搜索测试
node test-optimizations.js --keyword

# 清空数据库
npm run clear-events

# 运行实际抓取
npm run scrape

# 查看数据库索引
sqlite3 data/events.db ".indices"

# 进入 SQLite 交互式命令行
sqlite3 data/events.db

# 查看优化文档
cat SCRAPING_OPTIMIZATION.md

# 查看详细测试指南
cat TEST_GUIDE.md
```

---

## 📈 预期结果总结

如果所有测试都通过，你应该看到：

✅ **数据库优化**
- 5 个索引已创建
- 查询速度提升 60-70%
- 节省 15-20 秒

✅ **关键词搜索优化**
- 阈值设置为 50
- 事件 >= 50 时跳过搜索
- 节省 60-120 秒

✅ **总体效果**
- 抓取时间从 12 分钟 → 10-10.5 分钟
- 效率提升 10-18%
- 无新增错误

---

**快速参考版本：v1.0**
**最后更新：2024-10-22**

有问题？查看 `TEST_GUIDE.md` 获取详细帮助 📚
