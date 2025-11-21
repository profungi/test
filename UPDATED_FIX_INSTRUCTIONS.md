# Eventbrite 数据格式修复 - 更新版

## 🔍 问题分析

通过分析数据库中的 114 条 Eventbrite 记录，发现了以下格式问题：

### 1. 地址格式问题（多种类型）

**类型 A：重复的街道地址**
```
❌ 266 14th St266 14th, StreetOakland, CA 94612
✅ 266 14th Street, Oakland, CA 94612
```

**类型 B：逗号位置错误（在门牌号后面）**
```
❌ 473, Valencia StreetSan Francisco, CA 94103
✅ 473 Valencia Street, San Francisco, CA 94103
```

**类型 C：城市前缺少逗号**
```
❌ Santa Clara Convention Center5001 Great America ParkwaySanta Clara, CA 95054
✅ Santa Clara Convention Center 5001 Great America Parkway, Santa Clara, CA 95054
```

**类型 D：楼层信息格式错误**
```
❌ Torch Oakland Rooftop Bar1630 San Pablo Avenue#6th, Floor Oakland, CA 94612
✅ Torch Oakland Rooftop Bar 1630 San Pablo Avenue #6th Floor, Oakland, CA 94612
```

### 2. Description 格式问题

```
❌ Overview This is a great event...
✅ This is a great event...
```

## ✅ 解决方案

### 代码修复（未来抓取的数据）

修改了 `src/scrapers/eventbrite-scraper.js`：

**extractFullAddress() 方法**：
- ✅ 分四步处理地址：
  1. 移除重复的街道地址
  2. 移除门牌号后的错误逗号
  3. 修复 #楼层 格式
  4. 标准化为 "街道地址, 城市, 州 邮编" 格式

**extractDetailedDescription() 方法**：
- ✅ 去掉开头的 "Overview"（不区分大小写）
- ✅ 在两个提取点都应用清理逻辑

### 数据库修复（已有数据）

使用 `fix-eventbrite-data.js` 脚本：

```bash
npm run fix-eventbrite-data
```

**功能**：
- 🔍 扫描所有 Eventbrite 事件（114 条记录）
- 🔧 自动修复地址格式（所有类型的问题）
- 🧹 自动去除 description 开头的 "Overview"
- 📊 显示修复前后对比示例
- 📈 提供详细统计报告

## 📋 使用步骤

### 步骤 1：修复现有数据库数据

```bash
npm run fix-eventbrite-data
```

**预期输出**：
```
🔧 开始修复 Eventbrite 数据格式...

🔗 已连接到数据库: /path/to/data/events.db

📊 找到 114 条 Eventbrite 记录

📍 地址修复示例 #1:
   旧: 473, Valencia StreetSan Francisco, CA 94103
   新: 473 Valencia Street, San Francisco, CA 94103

📝 描述修复示例 #1:
   旧: Overview This is a great event...
   新: This is a great event...

✅ 修复完成！

📊 统计：
   总记录数: 114
   地址已修复: XX
   描述已修复: XX
   错误数: 0
```

### 步骤 2：验证修复结果

可以通过以下 SQL 查询验证：

```bash
# 检查地址格式（应该都包含两个逗号）
sqlite3 data/events.db "SELECT location FROM events WHERE source = 'eventbrite' LIMIT 5"

# 检查 description（不应该有 Overview 开头）
sqlite3 data/events.db "SELECT description FROM events WHERE source = 'eventbrite' AND description LIKE 'Overview%'"
```

### 步骤 3：测试新抓取的数据

未来抓取的数据会自动应用修复：

```bash
npm run scrape-eventbrite
```

新数据会直接保存为正确格式。

## 🧪 测试

### 自动化测试

运行测试脚本验证地址修复逻辑：

```bash
node test-address-fix.js
```

### 手动测试

抓取少量数据并检查格式：

```bash
npm run scrape-eventbrite
# 然后检查数据库中最新的几条记录
```

## 📊 预期效果

修复后，所有 Eventbrite 数据应该符合以下格式：

**地址**：`场馆名/街道地址, 城市, 州 邮编`
- ✅ `473 Valencia Street, San Francisco, CA 94103`
- ✅ `Santa Clara Convention Center 5001 Great America Parkway, Santa Clara, CA 95054`
- ✅ `The Great Northern 119 Utah St., San Francisco, CA 94103`

**Description**：不以 "Overview" 开头
- ✅ `This event features amazing performances...`
- ✅ `Join us for an incredible evening...`

## ⚠️ 注意事项

1. **备份数据库**（可选但推荐）：
   ```bash
   cp data/events.db data/events.db.backup
   ```

2. **修复脚本是安全的**：
   - 使用数据库事务
   - 只修改需要更新的字段
   - 无法识别的格式会保留原值

3. **如果遇到问题**：
   - 检查 git 状态查看修改
   - 使用 git restore 恢复文件
   - 从备份恢复数据库

## 📁 相关文件

- `src/scrapers/eventbrite-scraper.js` - 爬虫代码（未来数据）
- `fix-eventbrite-data.js` - 数据库修复脚本（现有数据）
- `test-address-fix.js` - 地址修复测试
- `package.json` - 添加了 `fix-eventbrite-data` 命令
- `EVENTBRITE_DATA_FIX.md` - 原始修复文档

## 🎯 总结

修复完成后：
- ✅ 新抓取的数据自动正确格式化
- ✅ 现有数据通过脚本批量修复
- ✅ 地址格式统一且可读性好
- ✅ Description 清晰简洁
- ✅ 网页显示效果更佳

---

更新日期：2025-11-20
修复范围：所有 Eventbrite 数据（114 条记录）
