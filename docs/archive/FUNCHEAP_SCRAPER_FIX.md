# Funcheap Scraper 修复说明

## 问题诊断

### 症状
Funcheap scraper 无法抓取到任何活动。

### 根本原因
**日期过滤逻辑错误**

Funcheap scraper 中存在一个严格的日期过滤器（`isEventOnWeekend()`），该过滤器只保留与特定日期完全匹配的活动。

具体问题：
1. **系统设计**：整个系统设计为抓取"下周"的活动（从下周一到下周日）
2. **Funcheap 网页内容**：Funcheap 分类页面显示的是"本周"和"近期"的所有活动
3. **日期不匹配**：
   - 今天：2025-11-04（周二）
   - 下周周末（代码查找的）：2025-11-14, 11-15, 11-16
   - 网页上的活动：2025-11-07, 11-08, 11-09（本周周末）
4. **结果**：所有活动都被过滤掉，导致返回 0 个活动

### 示例场景
```
今天：2025-11-04（周二）
下周一：2025-11-10
下周周末：2025-11-14（五）, 11-15（六）, 11-16（日）

Funcheap 网页显示：
- 11-07（五）- Blueprint Hardware Festival
- 11-08（六）- Sports Basement Snowfest
- 11-09（日）- Sunset Farmers Market

日期过滤器检查：
- 11-07 在 [11-14, 11-15, 11-16] 中？❌
- 11-08 在 [11-14, 11-15, 11-16] 中？❌
- 11-09 在 [11-14, 11-15, 11-16] 中？❌

结果：0 个活动通过过滤器
```

## 修复方案

### 修改策略
移除 Funcheap scraper 中的自定义日期过滤逻辑，将日期验证职责完全交给 `base-scraper` 的 `isValidEventTime()` 方法。

### 修改内容

1. **移除 `getNextWeekendDates()` 方法**
   - 不再计算特定的周末日期
   - 使用 `weekRange.identifier` 记录目标周范围

2. **移除 `isEventOnWeekend()` 方法**
   - 删除严格的日期匹配逻辑
   - 让所有解析的活动都通过

3. **移除 `parseTimeText()` 方法**
   - 该方法未被使用，可以安全删除

4. **简化 `buildUrls()` 方法**
   - 移除 `weekendDates` 参数
   - 不再传递 `dateFilter` 给 URL 对象

5. **简化 `parseFuncheapPage()` 方法**
   - 移除 `dateFilter` 参数
   - 移除日期过滤逻辑
   - 解析所有找到的活动

6. **简化 `scrapeEvents()` 方法**
   - 移除周末日期计算
   - 记录 `weekRange.identifier` 用于日志

### 新的工作流程

```
1. Funcheap Scraper
   ↓ 抓取分类页面（fairs-festivals, free-stuff）
   ↓ 解析所有活动（本周、下周等）
   ↓ 返回所有解析的活动

2. Base Scraper (normalizeEvent)
   ↓ 对每个活动调用 isValidEventTime(event.startTime, weekRange)
   ↓ 只保留在目标周范围内的活动
   ↓ 过滤掉不符合日期的活动

3. 最终结果
   ✓ 只有"下周"的活动被保留
```

## 优势

1. **职责分离**：
   - Funcheap scraper 专注于从网页解析活动
   - Base scraper 统一处理日期验证

2. **更灵活**：
   - 如果需要修改日期范围逻辑，只需修改 `base-scraper`
   - 所有 scrapers 都会自动受益

3. **更可靠**：
   - 避免双重过滤导致的问题
   - 减少代码重复

4. **更简洁**：
   - 删除了 100+ 行不必要的代码
   - 提高了可维护性

## 测试建议

运行完整的抓取流程：
```bash
npm run scrape
```

检查：
1. Funcheap scraper 是否成功抓取到活动
2. 最终输出的活动是否在正确的日期范围内
3. 其他 scrapers（Eventbrite, SF Station）是否仍然正常工作

## 相关文件

- `/code/src/scrapers/funcheap-weekend-scraper.js` - 主修改文件
- `/code/src/scrapers/base-scraper.js` - 日期验证逻辑位置

## 修复时间

2025-11-04
