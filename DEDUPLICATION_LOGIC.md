# 去重逻辑详解

## 概述
系统使用**多层次的去重机制**，从爬虫端到最终数据库，确保不重复显示同一个活动。

---

## 1️⃣ **爬虫层去重**（最早期）

### 1.1 Funcheap 爬虫 - URL 去重
**位置**: `src/scrapers/funcheap-weekend-scraper.js:409-422`

```javascript
deduplicateByUrl(events) {
  const seen = new Map();
  return events.filter(event => {
    const url = event.originalUrl;
    if (seen.has(url)) {
      return false;  // 去掉重复 URL
    }
    seen.set(url, true);
    return true;
  });
}
```

**逻辑**:
- 在同一个爬虫内，如果抓取了同一个 URL 的事件多次（如分页时可能重复），直接过滤掉
- **去重粒度**: URL 级别
- **用途**: 处理Funcheap分页导致的重复

### 1.2 Eventbrite 爬虫 - URL 去重
**位置**: `src/scrapers/eventbrite-scraper.js:12, 105`

```javascript
const seenUrls = new Set(); // 用于去重

// 在解析事件时
if (seenUrls.has(eventUrl)) {
  continue;  // 跳过已见过的 URL
}
seenUrls.add(eventUrl);
```

**逻辑**:
- 在抓取多个 Eventbrite 搜索结果页面时，使用 Set 记录已见过的 URL
- **去重粒度**: URL 级别
- **用途**: 处理多个搜索关键词和多个城市可能导致的重复

---

## 2️⃣ **内存层去重**（并行抓取后）

### 2.1 按生成的唯一键去重
**位置**: `src/scrape-events.js:173-202`

```javascript
async deduplicateEvents(events) {
  // 第一步：内存快速去重
  const uniqueMap = new Map();

  for (const event of events) {
    const key = this.generateEventKey(event);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, event);
    }
  }
}
```

### 2.2 生成唯一键的规则
**位置**: `src/scrape-events.js:204-216`

```javascript
generateEventKey(event) {
  // 优先级 1: URL 相同 → 同一个活动
  const url = event.originalUrl || event.url;
  if (url) return `url:${url}`;

  // 优先级 2: 内容特征（如果没有 URL）
  const title = event.title.toLowerCase().trim();
  const time = this.normalizeTime(event.startTime);        // YYYY-MM-DDTHH
  const location = this.normalizeLocation(event.location); // 小写，无标点空格

  return `content:${title}|${time}|${location}`;
}
```

**逻辑**:
- **优先用 URL**: 如果两个事件 URL 相同，必定是同一个活动
- **否则用内容**:
  - **标题**: 小写比较（不区分大小写）
  - **时间**: 只保留到小时 `YYYY-MM-DDTHH`（忽略分钟和秒）
  - **地点**: 小写，移除标点和空格（如 "San Francisco, CA" → "sanfranciscoCA"）

**示例**:
```
活动 A:
  - URL: https://eventbrite.com/e/123
  - Key: url:https://eventbrite.com/e/123

活动 B (不同来源相同活动):
  - URL: https://funcheap.com/event-456
  - Title: "Halloween Festival"
  - Time: 2025-10-31T14:00
  - Location: "San Francisco"
  - Key: content:halloween festival|2025-10-31T14|sanfrancisco

如果 A 和 B 是同一个活动，只有它们 URL 相同时才会去重。
```

**去重结果**:
```
原始活动: 87
内存去重后: 65 (-22)   // 去掉了来自不同爬虫的相同 URL
```

---

## 3️⃣ **数据库层去重**（历史记录对比）

### 3.1 数据库去重流程
**位置**: `src/scrape-events.js:237-259`

```javascript
async filterByDatabase(events) {
  const uniqueEvents = [];
  const weekRange = this.scrapers[0].getNextWeekRange();

  for (const event of events) {
    const result = await this.database.saveEvent(event);
    if (result.saved) {
      uniqueEvents.push(event);
    }  // 如果已存在，不再添加
  }
}
```

### 3.2 数据库中的去重逻辑
**位置**: `src/utils/database.js:161-211`

```javascript
async isDuplicate(event) {
  // 查询数据库中的相同周期、相同地点、时间接近的活动
  const query = `
    SELECT * FROM events
    WHERE week_identifier = ?              // 同一周
      AND location = ?                      // 相同地点
      AND ABS(julianday(start_time) - julianday(?)) < ?  // 时间差 < 2 小时
  `;

  const timeWindowDays = 2 / 24;  // 2小时的天数

  // 从 config.deduplication
  for (const row of rows) {
    const similarity = this.calculateStringSimilarity(
      normalizedTitle,
      row.normalized_title
    );

    // 如果相似度 ≥ 0.8，认为是重复
    if (similarity >= 0.8) {  // config.deduplication.titleSimilarityThreshold
      return true;  // 是重复
    }
  }
}
```

### 3.3 去重条件
**位置**: `src/config.js:183-186`

```javascript
deduplication: {
  titleSimilarityThreshold: 0.8,    // 80% 相似度
  timeWindowHours: 2                 // 2 小时时间窗口
}
```

**三个条件必须全部满足**:
1. ✅ 同一周 (`week_identifier`)
2. ✅ 相同地点 (`location`)
3. ✅ 时间接近（差 < 2 小时）

**然后计算标题相似度**:
- 使用 **Levenshtein 距离** 算法
- 相似度 ≥ 80% 则认为重复
- 示例:
  - "Halloween Festival" vs "Halloween Fest" → 相似度 93% → **重复** ✗
  - "Job Fair 2025" vs "Career Fair" → 相似度 60% → **不重复** ✓

**去重结果**:
```
内存去重后: 65
数据库去重后: 42 (-23)  // 去掉了前周已经抓取过的相同活动
```

---

## 4️⃣ **爬虫内部去重** (Eventbrite)

**位置**: `src/scrapers/eventbrite-scraper.js:93-110`

在 `scrapeEventsFromUrl` 方法中：
```javascript
async scrapeEventsFromUrl(url, weekRange, seenUrls, maxEvents = 20) {
  const events = [];
  // ...
  for (const event of pageEvents) {
    // 检查URL去重
    if (seenUrls.has(event.originalUrl)) {
      continue;  // 跳过已见过的
    }
    seenUrls.add(event.originalUrl);
    events.push(event);
  }
}
```

这在爬虫内部就已经去掉了来自不同搜索或城市的相同 URL。

---

## 📊 完整去重流程示意

```
┌─────────────────────────────────────────────────────┐
│ 从网站抓取活动 (87 个)                               │
└─────────────────────────────────────────────────────┘
                       ↓
        Eventbrite (27) | SFStation (60) | Funcheap (11)
                       ↓
    [爬虫内部 URL 去重] → [去掉某些重复 URL]
                       ↓
        ┌─────────────────────────────────────────┐
        │ 内存层去重 (generateEventKey)            │
        │ - URL 优先                              │
        │ - 否则用 title|time|location           │
        │ 结果: 87 → 65 (-22)                   │
        └─────────────────────────────────────────┘
                       ↓
        ┌─────────────────────────────────────────┐
        │ 数据库层去重 (isDuplicate)              │
        │ - 同周期 + 同地点 + 2h时间窗口         │
        │ - 标题相似度 ≥ 80%                     │
        │ 结果: 65 → 42 (-23)                   │
        └─────────────────────────────────────────┘
                       ↓
        ┌─────────────────────────────────────────┐
        │ AI 分类和优先级排序                      │
        │ (不做去重，保留所有 42 个)              │
        └─────────────────────────────────────────┘
                       ↓
        ┌─────────────────────────────────────────┐
        │ 生成审核文件                             │
        │ 42 个活动供人工审核选择                │
        └─────────────────────────────────────────┘
```

---

## 🎯 关键点总结

| 去重阶段 | 方式 | 粒度 | 工作原理 |
|---------|------|------|---------|
| **爬虫内部** | URL Set | URL | 单个爬虫内记录已见 URL |
| **内存层** | 生成唯一键 | URL 或 (title+time+location) | Map 存储，URL 优先 |
| **数据库层** | 相似度+时空条件 | 标题相似度+地点+时间 | Levenshtein 算法 |

---

## 🔧 配置项

```javascript
// config.js
deduplication: {
  titleSimilarityThreshold: 0.8,   // 调高 → 更严格；调低 → 更宽松
  timeWindowHours: 2                // 调高 → 去重更多；调低 → 去重更少
}
```

**如果看到重复活动**:
- 降低 `titleSimilarityThreshold` (如 0.7)
- 增加 `timeWindowHours` (如 4)

**如果去重太多**:
- 提高 `titleSimilarityThreshold` (如 0.9)
- 减少 `timeWindowHours` (如 1)

