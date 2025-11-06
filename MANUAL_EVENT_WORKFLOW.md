# 手动添加/替换活动工作流程

## 核心理解

**手动添加的时机**: 在 `npm run generate-post` 的**交互选择阶段**

```
┌──────────────────────────────────────────────────────────────────────┐
│                    npm run generate-post 流程                        │
├──────────────────────────────────────────────────────────────────────┤
│ 1. 扫描review文件                                                     │
│ 2. 按target_week分组                                                  │
│ 3. 用户选择要发布的周                                                 │
│ 4. 合并多个review文件的活动                                           │
│ 5. 去重                                                               │
│ 6. 【★ 交互式最终确认 ★】finalSelectionReview()                      │
│    ├─ 显示已选活动列表（数量不固定，可能是4个、5个、6个...）           │
│    ├─ 显示备选活动列表                                                │
│    └─ 【这里】允许用户:                                               │
│       ├─ 保持当前选择                                                 │
│       ├─ 从备选列表替换某个活动                                        │
│       └─ 【新增】手动添加任意URL的活动 ← 我们要实现的功能             │
│ 7. 生成短链接                                                         │
│ 8. AI翻译优化                                                         │
│ 9. 生成帖子文件                                                       │
│10. 保存到数据库 (posts + event_performance 表)                        │
│                                                                       │
│11. 【★ 用户可能手动修改 ★】                                          │
│    └─ 在生成文件后、发布到小红书前，用户可能手动编辑文件              │
│       添加或替换活动（目前是手动编辑.txt文件）                        │
│       ⚠️  这种修改不会记录到数据库                                   │
│                                                                       │
│12. 用户复制内容，手动发布到小红书                                     │
│13. ✅ 发布后不再修改活动                                              │
└──────────────────────────────────────────────────────────────────────┘
```

## 两个修改时机对比

| 时机 | 当前实现 | 问题 | 我们要实现的功能 |
|------|---------|------|-----------------|
| **第6步：交互选择时** | ❌ 不支持 | 用户无法添加自定义URL | ✅ 添加交互选项支持任意URL |
| **第11步：生成后发布前** | ⚠️  手动编辑文件 | 不记录到数据库，无法追踪 | 🔮 未来可选功能 |

**本次实现目标**: 在第6步增强交互功能，支持手动添加任意URL的活动

## 详细交互流程

```
【阶段1：爬虫抓取】
─────────────────────────────────────────────────────────────────────
运行: npm run scrape

├─ Eventbrite Scraper
│  ├─ Layer 1: 地理区域抓取
│  └─ Layer 2: 类型定向抓取（小城市：food-and-drink, festivals-fairs, holiday）
│
├─ Funcheap Scraper
│  └─ 区域和类型抓取
│
└─ SFStation Scraper  ← 【注意：是 SFStation，不是 Ticketmaster】
   └─ 按日期抓取SF地区活动

输出: output/review_*.json 文件（包含所有抓取的活动）


【阶段2：生成帖子 - 交互式选择】
─────────────────────────────────────────────────────────────────────
运行: npm run generate-post

第1步: 扫描review文件
  └─ 找到所有 output/review_*.json

第2步: 按周分组
  └─ 相同 target_week 的review文件分为一组

第3步: 用户选择要发布的周
  └─ 输入: 选择哪一周

第4步: 合并review文件
  └─ 合并多个review的活动（如果有多个）

第5步: 去重
  └─ 删除重复的活动

第6步: ★★★ 交互式最终确认 ★★★  <-- 【我们要增强这里】
  ┌──────────────────────────────────────────────────────────────┐
  │  当前实现 (review-merger.js 的 finalSelectionReview())      │
  ├──────────────────────────────────────────────────────────────┤
  │  显示:                                                        │
  │  1. 已选活动列表（数量不固定，可能4个、5个、6个...）          │
  │  2. 备选活动列表（未选的活动）                                │
  │                                                               │
  │  用户选项:                                                    │
  │  - Keep current selection                                     │
  │  - Replace with alternative                                   │
  └──────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │  新增功能 (我们要实现的)                                      │
  ├──────────────────────────────────────────────────────────────┤
  │  新增选项:                                                    │
  │  - 【Add custom event from URL】                              │
  │                                                               │
  │  流程:                                                        │
  │  1. 用户输入活动URL                                           │
  │     例如: https://www.eventbrite.com/e/french-holiday-...    │
  │           https://funcheap.com/event/...                      │
  │           https://sfstation.com/event/...                     │
  │           https://example.com/holiday-market (任意网站)       │
  │                                                               │
  │  2. 系统检测URL来源                                           │
  │     ├─ Eventbrite? → 调用 EventbriteScraper.scrapeEvent()   │
  │     ├─ Funcheap? → 调用 FuncheapScraper.scrapeEvent()       │
  │     ├─ SFStation? → 调用 SFStationScraper.scrapeEvent()     │
  │     └─ 其他网站? → 调用 AI提取活动信息                       │
  │                                                               │
  │  3. 提取活动信息（与scraper格式一致）                         │
  │     {                                                         │
  │       title: "French Holiday Market",                        │
  │       startTime: "2025-11-15T10:00:00.000Z",  // ISO 8601    │
  │       endTime: "2025-11-15T18:00:00.000Z",    // 可为null    │
  │       location: "Saratoga Village",                          │
  │       price: "Free",                          // 或 "$20"     │
  │       description: "Traditional French...",   // 可为null    │
  │       originalUrl: "https://...",                            │
  │       _source_website: "https://...",         // 标记来源    │
  │       _manually_added: true                   // 标记手动添加│
  │     }                                                         │
  │                                                               │
  │  4. 用户确认                                                  │
  │     显示提取的信息，用户确认是否添加                          │
  │                                                               │
  │  5. 选择操作                                                  │
  │     - 替换现有活动（选择位置 1-N）                            │
  │     - 作为额外活动添加（N+1个活动）                           │
  │                                                               │
  │  6. 添加到选择列表                                            │
  │     活动被标记: _manually_added = true, _source_website = URL│
  │                                                               │
  │  7. ⚠️  如果是替换操作                                        │
  │     被替换的活动会被移出选择列表                              │
  │     被替换的活动不会保存到数据库的 event_performance 表       │
  │     （只有最终选择的活动才会保存到数据库）                    │
  └──────────────────────────────────────────────────────────────┘

第7步: 生成短链接
  └─ 为所有活动（包括手动添加的）生成 Short.io 短链接

第8步: AI翻译优化
  └─ 翻译和优化内容

第9步: 生成帖子文件
  └─ 输出: output/weekly_events_*.txt

第10步: 保存到数据库
  ├─ posts 表: 帖子基本信息
  └─ event_performance 表: 每个活动的记录
     └─ 手动添加的活动标记:
        ├─ source_website: 活动来源网站URL
        ├─ source_review: NULL (因为不是从review文件来的)
        └─ 【注意】被替换掉的活动不会保存到这个表


【阶段3：可能的手动修改（当前流程）】
─────────────────────────────────────────────────────────────────────
⚠️  用户可能在生成文件后、发布到小红书前，手动编辑 .txt 文件
⚠️  这种修改不会记录到数据库，也无法追踪反馈
🔮 未来可以考虑添加工具支持这个阶段的修改并记录到数据库


【阶段4：手动发布】
─────────────────────────────────────────────────────────────────────
用户复制内容，手动发布到小红书
（这之后不再修改活动）


【阶段5：反馈收集】
─────────────────────────────────────────────────────────────────────
运行: npm run collect-feedback post_XXXX

收集小红书的点赞、评论、分享数据
分析手动添加活动 vs 自动选择活动的表现

查询手动添加的活动:
  SELECT * FROM event_performance
  WHERE source_website IS NOT NULL
  AND source_review IS NULL
```

## 用户交互示例

```bash
$ npm run generate-post

📊 Found review files...
📅 Select target week: [User selects week]
🔄 Merging reviews...
✅ 5 events selected  ← 【注意：数量不固定】

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Final Selection Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Selected Events (5):  ← 【数量可能是4、5、6个...】
  1. ✅ Pumpkin Patch - San Jose (Oct 20)
  2. ✅ Food Festival - SF (Oct 22)
  3. ✅ Jazz Concert - Palo Alto (Oct 25)
  4. ✅ Art Walk - Oakland (Oct 27)
  5. ✅ Holiday Market - Cupertino (Oct 30)

Alternative Events (10):
  6. 🟡 Wine Tasting - Napa (Oct 21)
  7. 🟡 Tech Meetup - Mountain View (Oct 23)
  ...

Options:
  [k] Keep current selection
  [r] Replace with alternative
  [a] Add custom event from URL  ← 【新功能】
  [q] Quit

Your choice: a

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Add Custom Event from URL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Enter event URL: https://www.eventbrite.com/e/french-holiday-market-...

🔍 Detecting URL source...
✅ Detected: Eventbrite
📥 Fetching event details...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Event Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title: French Holiday Market
Start Time: Nov 15, 2025 10:00 AM
End Time: Nov 15, 2025 6:00 PM
Location: Saratoga Village
Price: Free
Description: Traditional French holiday market with...
URL: https://www.eventbrite.com/e/french-holiday-market-...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Confirm adding this event? [y/n]: y

Options:
  [r] Replace existing event (choose position 1-5)
  [a] Add as 6th event

Your choice: r
Which position to replace (1-5)?: 3

✅ Event added successfully!
📝 Position 3: Jazz Concert → French Holiday Market
⚠️  Jazz Concert removed from selection (will not be saved to database)

Updated Selection:
  1. ✅ Pumpkin Patch - San Jose (Oct 20)
  2. ✅ Food Festival - SF (Oct 22)
  3. ✅ French Holiday Market - Saratoga (Nov 15) 🆕 [MANUAL]
  4. ✅ Art Walk - Oakland (Oct 27)
  5. ✅ Holiday Market - Cupertino (Oct 30)

Continue editing? [y/n]: n

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Generating short links...
🌐 Translating content...
📱 Creating Xiaohongshu post...
💾 Saving to database...

✅ Post created: output/weekly_events_2025-11-06_1234.txt
📊 Database: Post ID post_2025-11-06-1234
   - 5 events (1 manually added)
   - French Holiday Market marked with source_website
```

## 技术实现要点

### 1. 需要修改的文件

```
src/utils/review-merger.js
  └─ finalSelectionReview() 方法
     └─ 添加 'Add custom event from URL' 选项

src/utils/universal-scraper.js (新建)
  └─ 统一的URL抓取接口
     ├─ detectSource(url) - 检测URL来源
     ├─ scrapeEventFromUrl(url) - 抓取活动信息
     └─ aiExtractEvent(url, html) - AI提取活动信息

src/generate-post.js
  └─ savePublicationRecord() 方法
     └─ 已支持 source_website 字段，无需修改
```

### 2. URL检测逻辑

```javascript
function detectSource(url) {
  if (url.includes('eventbrite.com')) return 'eventbrite';
  if (url.includes('funcheap.com')) return 'funcheap';
  if (url.includes('sfstation.com')) return 'sfstation';  // 不是ticketmaster
  return 'ai_extraction'; // 未知网站，使用AI提取
}
```

### 3. 标准活动数据格式（与scraper一致）

```javascript
{
  title: String,              // 活动标题
  startTime: String,          // ISO 8601格式，如 "2025-11-15T10:00:00.000Z"
  endTime: String | null,     // ISO 8601格式，可为null
  location: String,           // 活动地点
  price: String | null,       // "Free" 或 "$20" 或 null
  description: String | null, // 活动描述，可为null
  originalUrl: String,        // 活动原始URL

  // 手动添加时额外标记
  _source_website: String,    // 来源网站URL（用于数据库追踪）
  _manually_added: true       // 标记为手动添加
}
```

### 4. AI提取活动信息（未知网站）

```javascript
async function aiExtractEvent(url, html) {
  const prompt = `
    Extract event information from this HTML page.
    Return JSON with exact format:
    {
      "title": "Event title",
      "startTime": "2025-11-15T10:00:00.000Z",  // ISO 8601 format
      "endTime": "2025-11-15T18:00:00.000Z",    // or null
      "location": "Event location",
      "price": "Free" or "$20" or null,
      "description": "Brief description"
    }
  `;

  // 使用现有的 ContentTranslator AI provider
  const result = await aiProvider.extract(prompt, html);
  return {
    ...result,
    originalUrl: url,
    _source_website: url,
    _manually_added: true
  };
}
```

### 5. 数据库追踪

**event_performance 表** (已有字段，无需修改):
```sql
-- 关键字段
source_review TEXT,    -- 来自哪个review文件（手动添加时为NULL）
source_website TEXT    -- 活动来源网站URL（手动添加时记录原始URL）
```

**查询手动添加的活动**:
```sql
SELECT * FROM event_performance
WHERE source_website IS NOT NULL
AND source_review IS NULL  -- 不是从review文件来的
```

**重要说明：被替换的活动处理**
- 被替换的活动会从选择列表中移除
- 被替换的活动**不会**保存到 `event_performance` 表
- 只有最终选择的活动（包括手动添加的）才会保存到数据库
- 这样确保数据库中只记录真正发布的活动

### 6. 反馈收集

手动添加的活动与自动选择的活动一样参与反馈收集：
- 收集 Short.io 点击数
- 收集小红书点赞、收藏、评论、分享数
- 计算 engagement_score
- 可以对比分析手动添加 vs 自动选择的效果

## 实现计划

### Phase 1: 核心功能（必需）
1. 创建 `src/utils/universal-scraper.js`
   - URL来源检测
   - 调用对应爬虫的单个事件抓取方法
   - AI提取未知网站

2. 修改各个scraper，添加单个事件抓取方法
   - `EventbriteScraper.scrapeEventFromUrl(url)`
   - `FuncheapScraper.scrapeEventFromUrl(url)`
   - `SFStationScraper.scrapeEventFromUrl(url)`

3. 修改 `src/utils/review-merger.js`
   - 在 `finalSelectionReview()` 添加新选项
   - 集成 universal-scraper
   - 用户确认流程
   - 处理替换逻辑（移除被替换的活动）

4. 测试和验证
   - 测试3个已知爬虫网站
   - 测试未知网站AI提取
   - 验证数据库记录
   - 验证被替换活动不会保存到数据库

### Phase 2: 优化和完善（可选）
1. 错误处理
   - URL无效处理
   - 网络超时处理
   - AI提取失败回退

2. 用户体验优化
   - 显示提取进度
   - 允许编辑提取的信息
   - 批量添加多个URL

### Phase 3: 生成后修改支持（未来）
1. 支持在第11步（生成文件后、发布前）修改
2. 提供工具读取已生成的文件
3. 添加/替换活动并更新数据库
4. 重新生成文件

## 关键技术决策

| 决策点 | 选择 | 原因 |
|--------|------|------|
| **何时添加** | 在 generate-post 交互时（第6步） | 符合用户的真实需求和工作流 |
| **支持网站** | 任意URL（3个爬虫+AI提取） | 最大灵活性，解决长尾问题 |
| **数据格式** | 与现有scraper完全一致 | 无缝集成，减少代码修改 |
| **数据库标记** | 使用现有 source_website 字段 | 无需修改数据库结构 |
| **被替换活动** | 不保存到数据库 | 只追踪真正发布的活动 |
| **AI提取** | 使用现有 ContentTranslator | 复用现有基础设施 |

## 总结

**核心理解**：
- ✅ 在 `npm run generate-post` 的**交互选择阶段**（第6步）添加/替换活动
- ✅ 活动数量不固定（可能4个、5个、6个...）
- ✅ 支持任意URL，自动检测来源（Eventbrite/Funcheap/SFStation/其他）
- ✅ 使用现有爬虫或AI提取信息，格式与scraper一致
- ✅ 数据库使用 `source_website` 字段追踪，`source_review` 为 NULL
- ✅ 被替换的活动不保存到数据库，只保存最终选择的活动
- ✅ 反馈系统自动收集手动添加活动的表现

**实现位置**：
- 修改 `src/utils/review-merger.js` 的 `finalSelectionReview()` 方法
- 创建 `src/utils/universal-scraper.js` 统一处理URL抓取
- 为各个scraper添加单个事件抓取方法

**数据流**：
```
用户输入URL
  ↓
检测来源（Eventbrite/Funcheap/SFStation/其他）
  ↓
抓取/提取活动信息（格式与scraper一致）
  ↓
用户确认
  ↓
选择操作（替换或添加）
  ↓
如果是替换：移除被替换的活动
  ↓
添加到选择列表（标记 _manually_added = true, _source_website = URL）
  ↓
继续正常流程（短链接 → 翻译 → 生成帖子 → 保存数据库）
  ↓
数据库只保存最终选择的活动（包括手动添加的，不包括被替换的）
  ↓
发布后收集反馈（与自动选择的活动一起）
```
