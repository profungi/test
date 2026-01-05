# 抓取配置审阅报告
生成时间: 2026-01-04

## 当前状态概览

### 本周抓取数据 (2026-01-05 to 2026-01-11)
- **总活动数**: 54个
- **数据源分布**:
  - sfstation: 25个 (46%) - 全部免费
  - sjdowntown API: 17个 (31%) - 3个免费
  - eventbrite: 11个 (20%) - 6个免费
  - funcheap: 1个 (2%)

### 活动类型分布
- **市集/节日/集市**: 仅3个 (The Box SF Food Fair, Hobee's Pancake Market, 1个志愿清理活动)
- **免费活动**: 35个 (65%)
- **高质量活动**: 不足 - 缺少farmers market, night market等

---

## 问题诊断

### 🔴 严重问题

#### 1. Eventbrite 抓取严重不足
**现状**: 只抓到11个活动
**配置**: 支持抓取最多100个,配置了15+个城市

**原因分析**:
- 可能网络问题或CSS选择器失效
- 可能被反爬限制
- `maxEventsPerSource: 100` 但实际只抓到11个

**建议**:
```bash
# 测试 Eventbrite 抓取器
npm run scrape-single-source eventbrite
```

#### 2. Funcheap 几乎无产出
**现状**: 只有1个活动
**配置**: 启用状态,priority: 1

**建议**: 检查 Funcheap 抓取器是否正常工作

#### 3. 缺少高质量市集活动
**现状**: 只有1个真正的市集 (The Box SF Food Fair)
**期望**: 应该有更多 farmers market, night market, street fair

**原因**:
- 1月不是市集季节 (大部分市集在4-10月)
- 固定时间活动被季节过滤:
  - Berryessa Night Market: 4-10月
  - First Fridays: 本周不是第一个周五

---

## 配置分析

### ✅ 已启用且工作正常的源

#### 1. REST API 源 (1个)
```javascript
api_sources: [
  {
    name: 'sjdowntown',
    displayName: 'San Jose Downtown',
    enabled: true,
    // ✅ 本周产出: 17个活动
  }
]
```

#### 2. 传统爬虫 (3个)
```javascript
legacy_scrapers: [
  EventbriteScraper,    // ⚠️ 产出不足: 11个
  SFStationScraper,     // ✅ 产出正常: 25个
  FuncheapWeekendScraper // ❌ 产出极少: 1个
]
```

### ⏸️ 季节性禁用的源

#### AI 抓取源 (大部分禁用)
当前月份: **1月**

**已过滤的源** (不在活跃月份):
- 🎃 Half Moon Bay Pumpkin Festival (9-10月)
- 🌸 SF Cherry Blossom Festival (3-4月)
- 🌸 Cupertino Cherry Blossom Festival (3-4月)
- 🏳️‍🌈 Silicon Valley Pride (5-6月)
- 🎉 San Jose Cinco de Mayo (4-5月)
- 🎬 Cinequest Film Festival (2-3月)
- **...共计60+个季节性活动**

**当前活跃的AI源** (1-2月):
- SF Chinese New Year Parade & Festival (1-2月) - ✅ 应该抓取

**全年活跃的AI源**:
- San José Made (每月) - ✅ 应该抓取
- 365 Night Market (每月) - ✅ 应该抓取
- Oakland First Fridays (每月) - ✅ 应该抓取

### 🔴 固定时间活动 (recurring_events)

#### 配置的固定活动:
1. **First Fridays ArtWalk** (每月第1个周五)
   - 本周范围: 2026-01-05 (周日) 到 2026-01-11 (周六)
   - 第一个周五: 2026-01-02 (上周)
   - ❌ 未在本周范围内

2. **Berryessa Night Market** (每周五, 4-10月)
   - ❌ 当前1月,不在季节内

---

## 核心问题: 抓取数量限制详解

### 实际抓取器代码限制

#### **1. Eventbrite Scraper** (`src/scrapers/eventbrite-scraper.js`)

**三层抓取策略:**

**Layer 1: 基础城市抓取** (第10-53行)
```javascript
// SF主城市: 10个
const sfEvents = await this.scrapeEventsFromUrl(..., 10);

// 其他城市: 每个5-8个
for (const city of additionalCities) {
  if (events.length >= 80) break; // ⚠️ 总数限制80
  const maxEvents = city.maxEvents || 8;
  const cityEvents = await this.scrapeEventsFromUrl(..., maxEvents);
}
```
**限制:** 总计最多80个

**Layer 2: 小城市类型定向抓取** (第55-108行)
```javascript
// 🎯 只搜索小城市 (maxEvents <= 5)
const smallCities = additionalCities.filter(city => city.maxEvents <= 5);

for (const city of citiesToSearch) {
  if (events.length >= 150) break; // ⚠️ 总数限制150

  for (const category of categorySearches) {
    // food-and-drink, festivals-fairs, holiday
    // 每个类型每城市: 8个
    const categoryEvents = await this.scrapeEventsFromUrl(..., 8);
  }
}
```
**限制:**
- 只搜索maxEvents ≤ 5的城市 (小城市)
- 总计最多150个

**Layer 3: 关键词搜索** (第110-143行)
```javascript
// ⚠️ 前置条件: events.length < 50
const keywordSearchThreshold = 50;

if (events.length < keywordSearchThreshold) {
  for (const keyword of additionalSearches) {
    if (events.length >= 150) break; // ⚠️ 总数限制150
    // festival, fair, market, farmers-market, street-fair, free-events
    // 每个关键词: 8个
  }
} else {
  console.log('⏭️ Skipping keyword searches (already have 50+ events)');
}
```
**限制:**
- **触发条件**: 必须少于50个活动
- 每关键词: 8个
- 总计最多150个

**理论最大值:**
- Layer 1: 10 (SF) + 15城市×5-8个 ≈ 80个
- Layer 2: 10小城市×3类型×8个 ≈ 240个
- Layer 3: 6关键词×8个 = 48个
- **理论上限: 150个** (代码硬限制)

**实际抓取: 11个** ❌ → **Layer 1就已经失败!**

---

#### **2. Funcheap Scraper** (`src/scrapers/funcheap-weekend-scraper.js`)

**抓取策略:**
```javascript
const categories = [
  'fairs-festivals',
  'free-stuff'
];

// 每个分类抓2页
for (const urlInfo of urls) {
  const pageEvents = await this.parseFuncheapPage($);
  events.push(...pageEvents);

  // 尝试下一页
  if (nextPageUrl && events.length < 50) { // ⚠️ 总数限制50
    const nextPageEvents = await this.parseFuncheapPage($next);
    events.push(...nextPageEvents);
  }
}

// 每页最多抓取20个 (第572行)
return events.slice(0, 30);
```

**限制:**
- 2个分类 × 2页 ≈ 最多100个活动
- 总数限制: 50个
- **理论上限: 50个**

**实际抓取: 1个** ❌ → **CSS选择器可能失效!**

---

#### **3. SF Station Scraper** (`src/scrapers/sfstation-scraper.js`)

**抓取策略:**
```javascript
// 逐日抓取 (周一到周日)
for (const dateStr of dates) {  // 7天

  // 每天最多20个
  for (let i = 0; i < pageEvents.length && i < 20; i++) {
    const detailedEvent = await this.fetchEventDetails(event);
    events.push(detailedEvent);
  }

  // 总数限制60个
  if (events.length >= 60) {
    break;
  }
}
```

**限制:**
- 每天: 最多20个
- 总计: 最多60个
- **理论上限: 60个**

**实际抓取: 25个** ✅ → **正常工作**

---

### 配置 vs 代码限制对比

| 数据源 | config.js设置 | 实际代码限制 | 本周抓取 | 状态 |
|--------|--------------|-------------|---------|------|
| Eventbrite | maxEventsPerSource: 100 | **150个** (Layer 1: 80, Layer 2/3: 150) | **11个** | ❌ 严重异常 |
| Funcheap | maxEventsPerSource: 100 | **50个** | **1个** | ❌ 严重异常 |
| SF Station | maxEventsPerSource: 100 | **60个** | **25个** | ✅ 正常 |
| SJ Downtown API | maxEventsPerSource: 100 | **50个** (apiParams) | **17个** | ✅ 正常 |

**关键发现:**
1. **config.js的 `maxEventsPerSource: 100` 并不是实际限制!**
2. **每个scraper有自己的硬编码限制**
3. **Eventbrite和Funcheap远低于理论值 → 说明抓取逻辑失败**

---

## 抓取质量目标

### 理想的活动组成 (每周)
1. **市集类** (Market/Fair): 5-10个
   - Farmers Markets
   - Night Markets
   - Street Fairs
   - Artisan Markets

2. **免费社区活动**: 10-15个
   - 博物馆免费日
   - 公园活动
   - 社区节日

3. **美食活动**: 8-12个
   - 餐厅活动
   - 美食节
   - Tasting events

4. **艺术/音乐**: 5-8个
   - 画廊开幕
   - 音乐会
   - 表演艺术

5. **户外/运动**: 3-5个
   - Hiking
   - Yoga
   - 体育赛事

**总计目标**: 40-50个活动

### 当前实际组成 (本周)
- 市集类: 3个 (6%)
- 免费活动: 35个 (65%) - 主要是志愿清理活动
- 其他: 16个 (30%)

**问题**: 过于依赖 SF Station 的志愿活动,缺少商业性的高质量活动

---

## 推荐配置调整

### 1. 立即修复: 检查主要爬虫

#### 测试 Eventbrite
```bash
# 单独测试 Eventbrite 抓取
npm run scrape-single-source eventbrite

# 或者创建测试脚本查看详细日志
```

#### 测试 Funcheap
```bash
npm run scrape-single-source funcheap
```

### 2. 短期优化: 启用1月可用的AI源

在 `src/config/sources-config.js` 中,以下源应该在1月启用:

```javascript
// 已配置但可能未抓取成功的源:
ai_sources: [
  // ✅ 全年活跃 - 应该抓取
  { name: 'sanjosemade', activeMonths: null },
  { name: '365nightmarket', activeMonths: null },
  { name: 'oaklandfirstfridays', activeMonths: null },

  // ✅ 1-2月活跃 - 应该抓取
  { name: 'sfchinesenewyear', activeMonths: [1, 2] }
]
```

**建议**: 检查这些AI源是否真的被调用和抓取

### 3. 中期优化: 增加数据源

#### 添加更多 REST API 源
考虑添加:
- SF Rec & Park API (公园活动)
- Oakland Parks API
- San Jose Parks API

#### 添加 CSS 抓取源
```javascript
css_sources: [
  {
    name: 'dothebay',
    displayName: 'Do The Bay',
    url: 'https://dothebay.com/events/this-weekend',
    enabled: true,
    // ... CSS selectors
  }
]
```

### 4. 调整抓取参数

#### 增加 Eventbrite 每城市限制
```javascript
// src/config.js
additionalCities: [
  { name: 'San Jose', maxEvents: 15 },      // 从8增加到15
  { name: 'Palo Alto', maxEvents: 12 },     // 从8增加到12
  { name: 'Oakland', maxEvents: 10 },       // 从5增加到10
  // ...
]
```

#### 增加最终审核数量
```javascript
scraping: {
  maxEventsPerSource: 150,              // 从100增加到150
  totalCandidatesForReview: 60,         // 从40增加到60
}
```

---

## 优先级推荐

### 🔴 P0 - 立即执行
1. **调试 Eventbrite 抓取器** - 产出严重不足
2. **调试 Funcheap 抓取器** - 几乎无产出
3. **验证 AI 源是否真的在抓取** - San Jose Made, 365 Night Market等

### 🟡 P1 - 本周完成
4. **增加 Eventbrite 抓取量** - 调整 maxEvents 参数
5. **添加 SF Chinese New Year** - 当前季节应该有
6. **测试 DoTheBay CSS 抓取** - 潜在高质量源

### 🟢 P2 - 长期优化
7. 添加更多 REST API 源
8. 优化 AI 分类器提高市集识别
9. 添加 Farmers Market 专门抓取

---

## 下一步行动

### 🔴 P0 - 立即诊断 (最关键)

#### 1. 测试 Eventbrite 抓取器
```bash
# 单独测试Eventbrite,查看详细日志
npm run scrape-single-source eventbrite 2>&1 | tee eventbrite-debug.log

# 查看关键信息
grep -E "Found|events|Layer|Scraping|Failed" eventbrite-debug.log
```

**预期输出:**
- Layer 1应该显示 "Found XX events" (应该至少30+个)
- Layer 2应该显示 "🎯 Layer 2: Category-targeted scraping"
- Layer 3应该显示触发或跳过的原因

**如果只看到11个,检查:**
- CSS选择器是否找到事件: `Found 0 events with selector`
- 网络错误: `Failed to fetch` / `timeout`
- 反爬限制: `403 Forbidden` / `429 Too Many Requests`

---

#### 2. 测试 Funcheap 抓取器
```bash
# 单独测试Funcheap
npm run scrape-single-source funcheap 2>&1 | tee funcheap-debug.log

# 查看日期分布和选择器
grep -E "Date distribution|Found.*events with selector|Parsed" funcheap-debug.log
```

**预期输出:**
- `Found XX events with selector: div.tanbox`
- `Date distribution of raw events:` 应该显示多个日期
- `After deduplication: XX unique events`

**如果只有1个,检查:**
- 选择器失效: `No events found with standard selectors`
- 日期过滤: Date distribution 是否都在范围外
- 页面结构变化

---

### 🟡 P1 - 深度调试

#### 3. 手动访问网站验证
```bash
# 使用curl测试Eventbrite是否可访问
curl -L "https://www.eventbrite.com/d/ca--san-francisco/events/?start_date_keyword=next_week" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o eventbrite-test.html

# 检查返回的HTML
grep -o "event-card" eventbrite-test.html | wc -l
# 应该显示多个 event-card 的数量
```

**如果返回0或很少:**
- Eventbrite可能更改了HTML结构
- 需要更新CSS选择器

---

#### 4. 检查AI源是否运行
```bash
# 查看完整抓取日志,搜索AI源
npm run scrape 2>&1 | grep -E "Configured Scrapers|AI sources|sanjosemade|365nightmarket"
```

**应该看到:**
```
📋 Configured Scrapers:
   REST API sources: 1
   CSS sources: 0
   AI sources: X (filtered by month)
```

**如果AI sources显示0:**
- 当前1月,大部分季节性源被过滤
- 应该至少有: San José Made, 365 Night Market, Oakland First Fridays, SF Chinese New Year

---

### 📊 诊断决策树

```
Eventbrite只有11个?
│
├─ YES → 运行 scrape-single-source eventbrite
│        │
│        ├─ 看到 "Layer 1" 有30+个?
│        │  └─ YES → 问题在数据库去重或后续流程
│        │  └─ NO  → 检查下面
│        │
│        ├─ 看到 "Found 0 events with selector"?
│        │  └─ YES → CSS选择器失效,需要更新
│        │
│        ├─ 看到网络错误 (timeout, 403, 429)?
│        │  └─ YES → 被反爬或网络问题
│        │
│        └─ 看到 "generic fallback"?
│           └─ YES → 标准选择器都失效了
│
└─ NO → 问题在其他地方
```

---

### 需要回答的关键问题

根据抓取逻辑分析,需要回答:

#### Eventbrite (应该80-150个,实际11个)
1. **Layer 1 SF基础页面** 是否成功?
   - 应该有10个SF活动
   - 检查: `Scraping San Francisco next week events...`

2. **其他城市循环** 是否执行?
   - 应该遍历15个城市
   - 检查: `Scraping other Bay Area cities...`

3. **Layer 2 小城市类型搜索** 是否触发?
   - 应该显示: `🎯 Layer 2: Category-targeted scraping`
   - 只对小城市搜索 food/festivals/holiday

4. **Layer 3 关键词搜索** 为何没触发?
   - 条件: `events.length < 50`
   - 11个应该满足条件,为什么没运行?

#### Funcheap (应该20-50个,实际1个)
1. **CSS选择器** 是否找到事件?
   - 应该: `Found XX events with selector: div.tanbox`
   - 如果是0: 网站结构变了

2. **日期过滤** 是否太严格?
   - 检查 Date distribution 输出
   - 是否所有活动都被过滤掉了?

3. **去重逻辑** 是否过度去重?
   - 检查: `Funcheap内部去重` 的数量

#### AI Sources (应该至少4个,实际0?)
1. **1月可用的AI源** 是否被加载?
   - San José Made (monthly)
   - 365 Night Market (monthly)
   - Oakland First Fridays (monthly)
   - SF Chinese New Year (activeMonths: [1,2])

2. **ConfigurableScraperManager** 是否过滤正确?
   - `getAIScrapers(currentMonth)` 应该返回1月可用的

---

### 建议的调试命令

```bash
# === 1. 快速诊断 ===
# 测试各个数据源
npm run scrape-single-source eventbrite 2>&1 | tee eventbrite.log
npm run scrape-single-source funcheap 2>&1 | tee funcheap.log
npm run scrape-single-source sfstation 2>&1 | tee sfstation.log

# === 2. 查看关键日志 ===
# Eventbrite: 查看Layer信息
grep -E "Layer|Found.*events|Scraping.*city|total events" eventbrite.log

# Funcheap: 查看选择器和日期
grep -E "selector|Date distribution|After deduplication" funcheap.log

# === 3. 完整抓取测试 ===
npm run scrape 2>&1 | tee full-scrape.log

# 查看数据源统计
grep -E "📈 抓取汇总报告|✅|❌|总计:" full-scrape.log

# 查看AI源配置
grep -E "Configured Scrapers|API sources|CSS sources|AI sources" full-scrape.log

# === 4. 手动验证网站可达性 ===
# 测试Eventbrite
curl -s "https://www.eventbrite.com/d/ca--san-francisco/events/?start_date_keyword=next_week" \
  -H "User-Agent: Mozilla/5.0" | grep -o "event-card" | wc -l

# 测试Funcheap
curl -s "https://sf.funcheap.com/category/event/event-types/fairs-festivals/" \
  -H "User-Agent: Mozilla/5.0" | grep -o 'div class="tanbox"' | wc -l
```

---

## 总结

### 核心问题
1. **数量不足**: 只有54个,远低于目标60-100个
2. **质量不均**: 过度依赖免费志愿活动,缺少商业性高质量活动
3. **主要爬虫失效**: Eventbrite (11个) 和 Funcheap (1个) 产出不足
4. **季节限制**: 大部分高质量活动源在1月被过滤

### 建议优先级
1. ✅ 立即修复 Eventbrite 和 Funcheap 抓取
2. ✅ 验证 AI 源是否真的在运行
3. ⏭️ 增加抓取量配置
4. ⏭️ 添加更多1月可用的数据源
