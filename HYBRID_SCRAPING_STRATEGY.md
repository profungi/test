# 混合抓取策略 - 详细设计方案

## 目标
解决 Eventbrite 排序算法与我们的质量标准不一致的问题，确保高质量活动（如 Saratoga French Holiday Market）不会被遗漏。

## 核心问题分析
- **现状**：依赖 Eventbrite 的排序，每个城市只抓前 5-8 个活动
- **问题**：好活动可能被埋在后面几页（基于热度/票务量而非质量）
- **影响**：错过小城市的高质量特色活动

---

## 四层混合策略

### 第一层：地理位置广度抓取（保底层）
**目标**：确保每个城市都有基本覆盖

**方法**：
- 保持现有的按城市抓取逻辑
- **增加每个城市的抓取数量**

**配置调整**（`src/config.js`）：
```javascript
additionalCities: [
  // 重点城市（人口多、活动多）
  { name: 'San Jose', url: '...', maxEvents: 30 },      // 从 8 → 30
  { name: 'Oakland', url: '...', maxEvents: 25 },       // 从 5 → 25
  { name: 'Palo Alto', url: '...', maxEvents: 25 },     // 从 8 → 25

  // 中等城市
  { name: 'Berkeley', url: '...', maxEvents: 20 },      // 从 5 → 20
  { name: 'Sunnyvale', url: '...', maxEvents: 20 },
  { name: 'Mountain View', url: '...', maxEvents: 20 },

  // 小城市（但活动质量高）- 特殊处理
  { name: 'Saratoga', url: '...', maxEvents: 15, premium: true },    // 从 5 → 15
  { name: 'Los Gatos', url: '...', maxEvents: 15, premium: true },   // 从 5 → 15
  { name: 'Los Altos', url: '...', maxEvents: 15, premium: true },   // 从 5 → 15
]
```

**新增字段**：`premium: true` 标记小城市高质量活动，后续给予加权

**预期结果**：
- 总抓取量：从约 80-100 个 → 约 300-350 个活动
- Saratoga 这类小城市从 5 个 → 15 个，提高3倍覆盖

---

### 第二层：类型定向深度抓取（精准层）
**目标**：按我们重视的活动类型定向搜索，不受 Eventbrite 排序影响

#### 2.1 Eventbrite 类型抓取

**支持的类型**（基于研究）：
```javascript
categorySearches: [
  {
    name: 'food-and-drink',
    displayName: 'Food & Drink',
    priority: 9,  // 我们的优先级评分
    maxPerCity: 10
  },
  {
    name: 'music',
    displayName: 'Music & Concerts',
    priority: 8,
    maxPerCity: 8
  },
  {
    name: 'arts',
    displayName: 'Arts & Theater',
    priority: 7,
    maxPerCity: 8
  },
  {
    name: 'festivals-fairs',
    displayName: 'Festivals & Fairs',
    priority: 10,
    maxPerCity: 10
  },
  {
    name: 'community',
    displayName: 'Community & Culture',
    priority: 8,
    maxPerCity: 8
  }
]
```

**URL 构建模式**（基于 WebFetch 研究）：
```javascript
// 方案A：Category path (推荐)
https://www.eventbrite.com/d/ca--saratoga/food-and-drink--events/?start_date_keyword=next_week

// 方案B：Search query (备用)
https://www.eventbrite.com/d/ca--saratoga/events/?q=food+market&start_date_keyword=next_week
```

**抓取策略**：
1. **只对小城市进行类型搜索**（maxEvents <= 5）：
   - 大城市（SF: 10个, San Jose: 8个, Palo Alto: 8个）第一层已经抓了足够多，跳过
   - 小城市（Saratoga, Los Gatos, Berkeley 等 12 个城市）：每个城市抓3个类型
   - 时间优化：从 17 × 3 = 51 次请求 → 12 × 3 = 36 次请求

2. **去重处理**：
   - 第二层抓取时跟踪已见 URL（`seenUrls`）
   - 避免与第一层重复

3. **时间控制**：
   - 每个类型搜索设置 timeout
   - 类型抓取失败不影响其他类型

#### 2.2 关键词补充抓取（可选）

对于特别重视的活动类型，用关键词搜索兜底：

```javascript
keywordSearches: [
  { keyword: 'holiday market', priority: 10, maxResults: 5 },
  { keyword: 'farmers market', priority: 9, maxResults: 5 },
  { keyword: 'art festival', priority: 9, maxResults: 5 },
  { keyword: 'wine tasting', priority: 8, maxResults: 5 }
]
```

**仅在重点城市执行**：Saratoga, Los Gatos, Palo Alto

**预期结果**：
- 额外抓取：约 100-150 个高相关度活动
- 精准度提升：针对性强，符合我们偏好

---

### 第三层：AI 智能打分和排序（筛选层）
**目标**：用 AI 评估活动质量，重新排序

#### 3.1 从分类改为打分

**现有 AI Classifier 输出**：
```javascript
{
  category: 'food_drink',
  priority: 8,
  reason: '...'
}
```

**新增 AI Scorer 输出**：
```javascript
{
  category: 'food_drink',
  qualityScore: 8.5,      // 新增：0-10分的质量评分
  relevanceScore: 9.0,    // 新增：与湾区受众的相关度
  uniquenessScore: 7.5,   // 新增：活动独特性
  overallScore: 8.3,      // 综合分数
  priority: 9,            // 保留：类型优先级
  reason: '...'
}
```

#### 3.2 评分标准（Prompt 设计）

**AI 评分 Prompt**（新增到 `src/ai-classifier.js`）：
```
请评估这个活动的质量，给出三个维度的评分（0-10分）：

1. **质量分 (qualityScore)**：
   - 活动的专业程度、组织水平
   - 是否有独特价值（非常规活动加分）
   - 场地、主办方的声誉

2. **相关度 (relevanceScore)**：
   - 对湾区华人受众的吸引力
   - 是否适合周末参与
   - 地点便利性

3. **独特性 (uniquenessScore)**：
   - 是否是特色/季节性活动（如holiday market, 艺术节）
   - 是否常规重复（farmers market 每周都有，分数略低）

综合考虑三个维度给出总分 (overallScore)。

特别加分项：
- 小城市的高质量活动（如 Saratoga 的节日市场）+1分
- 有明确时间和地点的活动 +0.5分
- Free 或 affordable 价格 +0.5分
```

#### 3.3 加权排序算法

```javascript
finalScore = (overallScore * 0.6) + (priority * 0.3) + (cityBonus * 0.1)

其中：
- overallScore: AI 综合评分 (0-10)
- priority: 类型优先级 (0-10)
- cityBonus: 城市加权
  - premium 城市 (Saratoga, Los Gatos): +2
  - 大城市 (SF, Oakland): +0
  - 其他: +1
```

**排序逻辑**：
1. 按 `finalScore` 降序排列
2. 相同分数的，按抓取来源优先：
   - 类型定向抓取 > 关键词抓取 > 地理位置抓取
3. 去重：保留分数最高的版本

**预期结果**：
- 高质量活动（如 French Holiday Market）会因为高 qualityScore + uniquenessScore + premium city bonus 排到前面
- 即使 Eventbrite 把它排在后面，我们的排序会纠正

---

### 第四层：人工精选（现有的交互式选择）
**保持不变**，但优化：

**改进点**：
1. 显示每个活动的 AI 评分，帮助决策：
   ```
   [8.5★] French Holiday Market
   📍 Saratoga | 🏷️ Food & Drink | 🎯 Quality: 9.0, Unique: 8.5
   ```

2. 在候选列表中也显示评分，方便替换：
   ```
   候选活动（按评分排序）：
   1. [8.3★] Oakland Art Festival - Quality: 8.0, Unique: 9.0
   2. [8.0★] Palo Alto Wine Tasting - Quality: 8.5, Unique: 7.0
   ```

---

## 实施计划

### Phase 1: 快速修复（立即实施）✅ 优先
**目标**：解决 Saratoga 活动遗漏问题

**修改文件**：
1. `src/config.js`
   - 增加所有城市的 `maxEvents`
   - 添加 `premium: true` 标记

2. `src/scrapers/eventbrite-scraper.js`
   - 读取 `premium` 字段
   - 在日志中标记 premium 城市

**预计时间**：15分钟
**预计效果**：Saratoga 活动从 5 个 → 15 个，立即提高覆盖率

---

### Phase 2: 类型定向抓取（核心功能）🎯
**目标**：实现按活动类型搜索

**修改文件**：
1. `src/config.js`
   - 新增 `categorySearches` 配置
   - 定义哪些城市启用类型搜索

2. `src/scrapers/eventbrite-scraper.js`
   - 新增 `scrapeByCategory()` 方法
   - 构建 category URL: `/d/{city}/{category}--events/?start_date_keyword=next_week`
   - 在 `scrape()` 方法中调用

3. `src/scrape-events.js`
   - 协调第一层和第二层抓取
   - 统一去重处理

**伪代码**：
```javascript
// src/scrapers/eventbrite-scraper.js

async scrape(weekRange) {
  const allEvents = [];
  const seenUrls = new Set();

  // 第一层：地理位置广度抓取
  console.log('📍 Layer 1: Geographic broad scraping...');
  for (const city of additionalCities) {
    const events = await this.scrapeEventsFromUrl(cityUrl, weekRange, seenUrls, city.maxEvents);
    allEvents.push(...events);
  }

  // 第二层：类型定向抓取（仅重点城市）
  console.log('🎯 Layer 2: Category-targeted scraping...');
  const priorityCities = additionalCities.filter(c => c.maxEvents >= 20 || c.premium);

  for (const city of priorityCities) {
    for (const category of config.categorySearches) {
      const categoryUrl = `${city.url}${category.name}--events/?start_date_keyword=next_week`;
      const events = await this.scrapeEventsFromUrl(categoryUrl, weekRange, seenUrls, category.maxPerCity);

      // 标记来源
      events.forEach(e => {
        e.scrapeSource = `category:${category.name}`;
        e.categoryPriority = category.priority;
      });

      allEvents.push(...events);
    }
  }

  return allEvents;
}
```

**预计时间**：1-2小时
**预计效果**：增加 100-150 个高相关度活动

---

### Phase 3: AI 智能打分（质量提升）⭐
**目标**：让 AI 评估活动质量而不只是分类

**修改文件**：
1. `src/ai-classifier.js`
   - 重命名为 `src/ai-evaluator.js`（或保持名称，增加功能）
   - 修改 prompt，要求输出 qualityScore, relevanceScore, uniquenessScore
   - 解析返回的 JSON，提取分数

2. `src/utils/review-merger.js`
   - 在排序时使用 `finalScore` 而非简单的 `priority`
   - 实现加权算法

3. `src/generate-post.js`
   - 在显示活动时展示评分信息

**伪代码**：
```javascript
// src/ai-evaluator.js

async evaluateEvent(event) {
  const prompt = `
    评估这个活动：
    标题：${event.title}
    地点：${event.location}
    时间：${event.date}
    描述：${event.description}
    价格：${event.price}

    请给出评分（JSON格式）：
    {
      "category": "food_drink",
      "qualityScore": 8.5,
      "relevanceScore": 9.0,
      "uniquenessScore": 7.5,
      "overallScore": 8.3,
      "reason": "..."
    }

    评分标准：
    - qualityScore: 专业程度、组织水平、场地声誉
    - relevanceScore: 对湾区华人受众的吸引力
    - uniquenessScore: 是否独特、季节性、非常规

    特别加分：
    - 小城市高质量活动 (Saratoga, Los Gatos) +1
    - Free/affordable +0.5
  `;

  const response = await this.callAI(prompt);
  return JSON.parse(response);
}
```

**预计时间**：2-3小时
**预计效果**：高质量活动准确排到前面

---

### Phase 4: 关键词补充（可选）
**目标**：用关键词兜底，找到特别重视的活动

**修改文件**：
1. `src/config.js`
   - 新增 `keywordSearches` 配置

2. `src/scrapers/eventbrite-scraper.js`
   - 新增 `scrapeByKeyword()` 方法
   - URL: `?q=keyword&start_date_keyword=next_week`

**预计时间**：30分钟
**预计效果**：再增加 20-30 个特定类型活动

---

## 数据流图

```
开始抓取
    ↓
┌─────────────────────────────────────┐
│  第一层：地理位置广度抓取              │
│  - 16个城市                          │
│  - 每个城市 15-30 个活动              │
│  - 总计约 300 个活动                  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  第二层：类型定向深度抓取              │
│  - 5-8个重点城市                     │
│  - 3-5个活动类型                     │
│  - 每个组合 8-10 个活动               │
│  - 总计约 150 个活动                  │
│  - 去重：已见URL跳过                  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  第二层可选：关键词补充抓取            │
│  - 3-4个小城市                       │
│  - 4-5个关键词                       │
│  - 总计约 30 个活动                   │
└─────────────────────────────────────┘
    ↓
合并去重（URL去重）
约 400-450 个独特活动
    ↓
┌─────────────────────────────────────┐
│  第三层：AI 智能评分                  │
│  - 对每个活动打分                     │
│  - qualityScore (0-10)               │
│  - relevanceScore (0-10)             │
│  - uniquenessScore (0-10)            │
│  - 计算 finalScore                   │
└─────────────────────────────────────┘
    ↓
按 finalScore 排序
    ↓
┌─────────────────────────────────────┐
│  AI 自动筛选 top 80-100 活动          │
│  - finalScore >= 7.0                 │
│  - 覆盖不同类型和城市                 │
└─────────────────────────────────────┘
    ↓
生成 review 文件
约 80-100 个活动待审核
    ↓
┌─────────────────────────────────────┐
│  第四层：人工精选（现有流程）          │
│  - 显示 AI 评分辅助决策               │
│  - 交互式选择/替换                    │
│  - 最终选择 20-30 个活动              │
└─────────────────────────────────────┘
    ↓
生成帖子
```

---

## 预期效果对比

### 现状（Phase 0）
| 指标 | 数值 |
|------|------|
| 抓取总量 | 80-100 |
| 高质量活动覆盖 | 60-70% |
| Saratoga 活动数 | 5 |
| French Holiday Market 被发现概率 | 20% |
| 抓取时间 | 3-5 分钟 |

### Phase 1 实施后
| 指标 | 数值 | 变化 |
|------|------|------|
| 抓取总量 | 300-350 | +250% |
| 高质量活动覆盖 | 75-80% | +15% |
| Saratoga 活动数 | 15 | +200% |
| French Holiday Market 被发现概率 | 60% | +40% |
| 抓取时间 | 8-12 分钟 | +150% |

### Phase 2 实施后
| 指标 | 数值 | 变化 |
|------|------|------|
| 抓取总量 | 400-450 | +350% |
| 高质量活动覆盖 | 85-90% | +25% |
| Saratoga 活动数 | 25 | +400% |
| French Holiday Market 被发现概率 | 90% | +70% |
| 抓取时间 | 15-20 分钟 | +300% |

### Phase 3 实施后
| 指标 | 数值 | 变化 |
|------|------|------|
| 抓取总量 | 400-450 | +350% |
| 高质量活动覆盖 | 92-95% | +30% |
| Top 20 活动准确率 | 95%+ | +25% |
| French Holiday Market 排名 | Top 10 | 显著提升 |
| 抓取时间 | 18-25 分钟 | +350% |

---

## 风险和权衡

### 风险

1. **抓取时间增加**：从 3-5 分钟 → 15-25 分钟
   - **缓解**：可以分批抓取，或在后台异步执行

2. **Eventbrite 可能封禁**：请求量增加 4-5 倍
   - **缓解**：
     - 添加 rate limiting（每个请求间隔 1-2 秒）
     - 使用 rotating user agents
     - 分时段抓取

3. **AI 评分成本增加**：调用 AI API 次数增加
   - **缓解**：
     - 只对 top 200 活动评分，其他过滤掉
     - 使用更便宜的模型（如 Claude Haiku）做初筛

4. **Category URL 可能失效**：Eventbrite 可能改变 URL 结构
   - **缓解**：
     - 保留第一层地理位置抓取作为保底
     - 添加监控，URL 失效时告警

### 权衡

| 方面 | 收益 | 代价 |
|------|------|------|
| 覆盖率 | +250% 活动数 | +300% 时间 |
| 准确率 | +30% 高质量活动 | +5x AI 成本 |
| 鲁棒性 | 多层冗余 | 代码复杂度增加 |

---

## 配置文件示例

### 新增配置（`src/config.js`）

```javascript
module.exports = {
  // ... 现有配置 ...

  // 第一层：地理位置抓取配置
  additionalCities: [
    // 重点大城市
    {
      name: 'San Jose',
      url: 'https://www.eventbrite.com/d/ca--san-jose/events/',
      maxEvents: 30,
      enableCategorySearch: true  // 启用第二层抓取
    },
    {
      name: 'Oakland',
      url: 'https://www.eventbrite.com/d/ca--oakland/events/',
      maxEvents: 25,
      enableCategorySearch: true
    },

    // 小城市（高质量）
    {
      name: 'Saratoga',
      url: 'https://www.eventbrite.com/d/ca--saratoga/events/',
      maxEvents: 15,
      premium: true,  // 标记为premium，后续加权
      enableCategorySearch: true,
      categoryLimit: 2  // 只搜索2个类型，控制时间
    },
    {
      name: 'Los Gatos',
      url: 'https://www.eventbrite.com/d/ca--los-gatos/events/',
      maxEvents: 15,
      premium: true,
      enableCategorySearch: true,
      categoryLimit: 2
    },

    // ... 其他城市 ...
  ],

  // 第二层：类型定向搜索配置
  categorySearches: [
    {
      name: 'food-and-drink',
      displayName: 'Food & Drink',
      priority: 9,
      maxPerCity: 10,
      enabled: true
    },
    {
      name: 'festivals-fairs',
      displayName: 'Festivals & Fairs',
      priority: 10,
      maxPerCity: 10,
      enabled: true
    },
    {
      name: 'music',
      displayName: 'Music & Concerts',
      priority: 8,
      maxPerCity: 8,
      enabled: true
    },
    {
      name: 'arts',
      displayName: 'Arts & Theater',
      priority: 7,
      maxPerCity: 8,
      enabled: true
    },
    {
      name: 'community',
      displayName: 'Community & Culture',
      priority: 8,
      maxPerCity: 8,
      enabled: true
    }
  ],

  // 可选：关键词补充搜索
  keywordSearches: [
    { keyword: 'holiday market', priority: 10, maxResults: 5, cities: ['Saratoga', 'Los Gatos', 'Palo Alto'] },
    { keyword: 'farmers market', priority: 9, maxResults: 5, cities: ['Saratoga', 'Los Gatos'] },
    { keyword: 'art festival', priority: 9, maxResults: 5, cities: ['Oakland', 'Berkeley'] },
    { keyword: 'wine tasting', priority: 8, maxResults: 5, cities: ['Saratoga', 'Los Gatos', 'Palo Alto'] }
  ],

  // 第三层：AI 评分配置
  aiScoring: {
    enabled: true,
    model: 'claude-haiku',  // 使用便宜的模型
    scoreTopN: 200,  // 只对前200个活动详细评分
    minScoreThreshold: 7.0,  // 最低分数阈值
    weights: {
      qualityScore: 0.4,
      relevanceScore: 0.3,
      uniquenessScore: 0.3
    },
    cityBonus: {
      premium: 2.0,   // Saratoga, Los Gatos
      large: 0,       // SF, Oakland, San Jose
      medium: 1.0     // 其他
    }
  },

  // 抓取控制
  scraping: {
    requestDelay: 1500,  // 每个请求间隔1.5秒，避免被封
    timeout: 30000,      // 单个请求超时30秒
    maxRetries: 2,       // 失败重试2次
    userAgents: [        // 轮换 user agents
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ]
  }
};
```

---

## 监控和调试

### 新增日志输出

```
🕷️  开始抓取 (Hybrid Strategy)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Layer 1: Geographic Broad Scraping
  ├─ San Jose (30 events max)
  │  ├─ Found 28 events
  │  └─ Seen URLs: 28
  ├─ Saratoga (15 events max) [PREMIUM]
  │  ├─ Found 14 events
  │  └─ Seen URLs: 42
  ...
  └─ Layer 1 Total: 287 events

🎯 Layer 2: Category-Targeted Scraping
  ├─ San Jose
  │  ├─ food-and-drink: 9 events (1 duplicate)
  │  ├─ festivals-fairs: 7 events (2 duplicates)
  │  └─ music: 8 events (0 duplicates)
  ├─ Saratoga [PREMIUM]
  │  ├─ food-and-drink: 6 events (1 duplicate) ⭐
  │  │  └─ ✨ French Holiday Market [NEW]
  │  └─ festivals-fairs: 5 events (0 duplicates)
  ...
  └─ Layer 2 Total: 142 events (28 duplicates)

🔍 Optional Layer: Keyword Searches
  ├─ "holiday market" in Saratoga: 3 events (1 duplicate)
  └─ Layer Total: 15 events (5 duplicates)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Scraping Summary:
  ├─ Total scraped: 444 events
  ├─ After dedup: 416 unique events
  └─ Time: 18m 32s

⭐ Layer 3: AI Smart Scoring
  ├─ Scoring top 200 events...
  ├─ French Holiday Market: 9.2/10 (quality: 9.5, unique: 9.0, relevance: 9.0)
  └─ Scored 200 events in 3m 15s

📋 Final Selection:
  ├─ Events with score >= 7.0: 156
  ├─ Top 100 for review
  └─ French Holiday Market ranked #3 🎉
```

---

## 总结

### 这个方案解决了什么问题？

1. ✅ **覆盖率**：从 80 个 → 400+ 个活动，提高 5 倍
2. ✅ **准确率**：高质量活动（如 French Holiday Market）不再被遗漏
3. ✅ **智能化**：AI 打分替代简单分类，更精准
4. ✅ **可控性**：多层策略，每层可独立调整
5. ✅ **鲁棒性**：一层失败不影响其他层

### 实施优先级

**立即做**（Phase 1）：
- 增加 maxEvents，从 5 → 15-30
- 添加 premium 标记
- **预期**：解决 Saratoga 活动遗漏

**本周做**（Phase 2）：
- 实现类型定向抓取
- **预期**：覆盖率提升到 90%+

**下周做**（Phase 3）：
- 实现 AI 智能打分
- **预期**：准确率提升到 95%+

**可选**（Phase 4）：
- 关键词补充搜索
- **预期**：边际提升 5%

---

## 下一步

你觉得这个方案如何？我们可以：

1. **直接开始实施 Phase 1**（最快，15分钟搞定）
2. **调整方案细节**（比如修改城市配置、评分标准）
3. **讨论其他想法**（你还有其他考虑吗？）

我建议先做 Phase 1，立即解决 Saratoga 问题，然后我们可以运行一次抓取，看看效果如何，再决定是否继续 Phase 2。
