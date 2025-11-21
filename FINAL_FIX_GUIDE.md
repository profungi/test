# Eventbrite 地址格式最终修复指南

## 🎯 问题总结

你发现的问题：
```
❌ SAP Center525, West Santa Clara StreetSan Jose, CA 95113
```

**两个问题**：
1. 逗号在门牌号后面（应该在整个街道地址后面）
2. 城市名前缺少逗号和空格

**正确格式**：
```
✅ SAP Center 525 West Santa Clara Street, San Jose, CA 95113
```

## 🔧 解决方案

### 核心改进：使用湾区城市列表精确匹配

之前的正则表达式无法正确处理多词城市名（如 "San Jose", "Santa Clara", "East Palo Alto"）。

新方案使用 **30个已知湾区城市的列表** 进行精确匹配：

```javascript
const cities = [
  'San Francisco', 'San Jose', 'Oakland', 'Berkeley',
  'Palo Alto', 'East Palo Alto', 'Santa Clara', 'Sunnyvale',
  'Mountain View', 'Redwood City', 'San Mateo', 'Fremont',
  // ... 等等
];
```

### 修复步骤

**步骤 1**：移除门牌号后的逗号
```
"525," -> "525"
```

**步骤 2**：在场馆名和门牌号之间添加空格
```
"SAP Center525" -> "SAP Center 525"
```

**步骤 3**：使用城市列表精确匹配，在城市名前添加逗号
```
"...StreetSan Jose, CA" -> "...Street, San Jose, CA"
```

## 📋 修复示例

### 示例 1: SAP Center
```
❌ SAP Center525, West Santa Clara StreetSan Jose, CA 95113
✅ SAP Center 525 West Santa Clara Street, San Jose, CA 95113
```

### 示例 2: Santa Clara Convention Center
```
❌ Santa Clara Convention Center5001, Great America ParkwaySanta Clara, CA 95054
✅ Santa Clara Convention Center 5001 Great America Parkway, Santa Clara, CA 95054
```

### 示例 3: Wildseed (带楼层信息)
```
❌ Wildseed855 El Camino Real#Building 4, Palo Alto, CA 94301
✅ Wildseed 855 El Camino Real #Building 4, Palo Alto, CA 94301
```

### 示例 4: San Jose Woman's Club
```
❌ San Jose Woman's Club75 South 11th, StreetSan Jose, CA 95112
✅ San Jose Woman's Club 75 South 11th Street, San Jose, CA 95112
```

## 🚀 如何使用

### 1. 修复数据库中的现有数据

运行修复脚本：

```bash
npm run fix-eventbrite-data
```

**预期输出**：
```
🔧 开始修复 Eventbrite 数据格式...

🔗 已连接到数据库: /code/data/events.db

📊 找到 114 条 Eventbrite 记录

📍 地址修复示例 #1:
   旧: SAP Center525, West Santa Clara StreetSan Jose, CA 95113
   新: SAP Center 525 West Santa Clara Street, San Jose, CA 95113

📍 地址修复示例 #2:
   旧: Santa Clara Convention Center5001, Great America ParkwaySanta Clara, CA 95054
   新: Santa Clara Convention Center 5001 Great America Parkway, Santa Clara, CA 95054

📝 描述修复示例:
   旧: Overview This event features...
   新: This event features...

✅ 修复完成！

📊 统计：
   总记录数: 114
   地址已修复: XX
   描述已修复: XX
   错误数: 0

✨ 所有操作已完成！
```

### 2. 验证修复结果

检查修复后的数据：

```bash
# 查看修复后的地址（应该都有两个逗号）
sqlite3 data/events.db "SELECT location FROM events WHERE source = 'eventbrite' LIMIT 5"

# 检查特定地址
sqlite3 data/events.db "SELECT location FROM events WHERE source = 'eventbrite' AND location LIKE '%SAP Center%'"
```

**预期结果**：
```
SAP Center 525 West Santa Clara Street, San Jose, CA 95113
Santa Clara Convention Center 5001 Great America Parkway, Santa Clara, CA 95054
Wildseed 855 El Camino Real #Building 4, Palo Alto, CA 94301
```

所有地址都应该符合格式：`场馆/街道地址, 城市, 州 邮编`

### 3. 未来抓取的数据

新抓取的数据会自动应用修复，无需额外操作：

```bash
npm run scrape-eventbrite
```

数据会自动保存为正确格式！

## 🧪 测试

运行测试验证逻辑：

```bash
node test-address-fix-v2.js
```

**测试用例包括**：
- SAP Center（逗号在错误位置）
- Santa Clara Convention Center（多词城市名）
- Wildseed（带楼层信息）
- San Jose Woman's Club（包含撇号）
- 等等...

## 📊 支持的城市列表

修复脚本支持以下 30 个湾区城市：

**主要城市**：
- San Francisco
- San Jose
- Oakland
- Berkeley

**半岛城市**：
- Palo Alto
- East Palo Alto
- Redwood City
- San Mateo
- Menlo Park
- San Carlos
- Burlingame
- San Bruno
- South San Francisco
- Daly City
- Pacifica
- Half Moon Bay

**南湾城市**：
- Santa Clara
- Sunnyvale
- Mountain View
- Cupertino
- Milpitas
- Saratoga
- Los Gatos

**东湾城市**：
- Fremont
- Hayward
- San Leandro
- Alameda
- Richmond
- Concord
- Walnut Creek

## ⚠️ 注意事项

1. **备份数据库**（建议）：
   ```bash
   cp data/events.db data/events.db.backup
   ```

2. **修复是安全的**：
   - 使用数据库事务
   - 只修改需要更新的记录
   - 无法识别的地址会保留原格式

3. **检查修复结果**：
   修复后，建议抽查几条记录确保格式正确

## 📁 相关文件

- **src/scrapers/eventbrite-scraper.js** - 爬虫代码（未来数据自动修复）
- **fix-eventbrite-data.js** - 数据库修复脚本（修复现有数据）
- **test-address-fix-v2.js** - 测试脚本
- **package.json** - 包含 `fix-eventbrite-data` 命令

## ✅ 修复清单

运行修复脚本后，确认以下内容：

- [ ] 运行 `npm run fix-eventbrite-data`
- [ ] 检查输出，确认修复数量合理
- [ ] 验证几个地址格式是否正确
- [ ] 确认城市名前都有逗号和空格
- [ ] 确认 description 不以 "Overview" 开头

## 🎯 最终效果

**地址格式**：统一为 `场馆/街道地址, 城市, 州 邮编`
- ✅ 逗号在正确位置（街道地址后，城市前）
- ✅ 场馆名和门牌号之间有空格
- ✅ 城市名前有逗号和空格
- ✅ 多词城市名正确识别

**Description 格式**：简洁清晰
- ✅ 不以 "Overview" 开头
- ✅ 直接显示活动内容

**网页显示效果**：
- ✅ 地址可读性强
- ✅ Description 清晰易读
- ✅ 用户体验更佳

---

**最后更新**：2025-11-20
**修复范围**：所有 Eventbrite 数据（114 条记录）
**支持城市**：30 个湾区城市

---

## 🙋 需要帮助？

如果遇到问题：
1. 检查 git 状态查看修改
2. 从备份恢复数据库
3. 查看测试脚本验证逻辑

现在就运行 `npm run fix-eventbrite-data` 来修复数据库吧！🚀
