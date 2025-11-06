# 手动添加活动功能 - 实现总结

## 功能概述

实现了在 `npm run generate-post` 的交互选择阶段，用户可以通过输入任意URL手动添加活动的功能。

**核心能力**：
- ✅ 支持 Eventbrite、Funcheap、SFStation 三个已知网站
- ✅ 支持任意其他网站（使用AI自动提取）
- ✅ 自动检测URL来源
- ✅ 统一的活动数据格式
- ✅ 数据库追踪（source_website 字段）
- ✅ 完整的用户交互流程

## 实现内容

### 1. 新增文件

#### `/code/src/utils/universal-scraper.js`
统一的URL抓取接口，负责：
- URL来源检测（detectSource）
- 调用对应的scraper抓取活动
- AI提取未知网站的活动信息
- 返回标准格式的活动数据

**关键方法**：
```javascript
detectSource(url)              // 检测URL来源
scrapeEventFromUrl(url)        // 统一抓取接口
scrapeEventbriteEvent(url)     // Eventbrite专用
scrapeFuncheapEvent(url)       // Funcheap专用
scrapeSFStationEvent(url)      // SFStation专用
scrapeWithAI(url)              // AI提取任意网站
```

#### `/code/test-manual-add.js`
测试脚本，用于验证手动添加功能：
- 测试3个已知scraper网站
- 支持测试自定义URL
- 显示完整的抓取结果

### 2. 修改文件

#### `/code/src/utils/review-merger.js`

**新增方法**：
- `addCustomEventFromUrl()` - 手动添加活动的主流程
- `convertToReviewFormat(event)` - 转换为review格式
- `formatDateTime(isoString)` - 格式化时间显示
- `guessEventType(title, description)` - 猜测活动类型

**修改的交互流程**（finalSelectionReview方法）：
```javascript
// 添加新的操作选项
console.log('  • 继续: Enter  • 移除: 输入序号 (如: 2)');
console.log('  • 手动添加URL: add  • 取消: n');  // 新增

// 处理 'add' 命令
if (input === 'add') {
  const newEvent = await this.addCustomEventFromUrl();
  if (newEvent) {
    currentEvents.push(newEvent);
    console.log(`\n✅ 活动已添加: ${newEvent.title}`);
  }
  continue;
}
```

#### `/code/COMMANDS_REFERENCE.md`
添加了测试命令文档（第373-424行）

## 用户交互流程

```
npm run generate-post
  ↓
选择要发布的周
  ↓
显示已选活动列表
  ↓
【用户输入: add】
  ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 手动添加活动from URL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请输入活动URL (或输入 n 取消): https://www.eventbrite.com/e/...
  ↓
🔍 检测URL来源...
✅ 检测到: eventbrite
📥 正在获取活动详情...
  ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 提取的活动信息
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
标题: French Holiday Market
时间: Fri, 11/15, 10:00 AM
地点: Saratoga Village
价格: Free
描述: Traditional French holiday market...
URL: https://www.eventbrite.com/e/...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

确认添加这个活动? [Y/n]: y
  ↓
✅ 活动已添加: French Holiday Market
📊 当前活动数: 5 个
```

## 技术实现细节

### 数据流

```
用户输入URL
  ↓
UniversalScraper.detectSource(url)
  ↓
根据来源调用对应的scraper
  ├─ Eventbrite → EventbriteScraper.fetchEventDetails()
  ├─ Funcheap → 自定义提取逻辑
  ├─ SFStation → SFStationScraper.fetchEventDetails()
  └─ 其他网站 → AI提取
  ↓
返回标准格式活动对象
{
  title: String,
  startTime: String (ISO 8601),
  endTime: String | null,
  location: String,
  price: String | null,
  description: String | null,
  originalUrl: String,
  _source_website: String,
  _manually_added: true
}
  ↓
ReviewMerger.convertToReviewFormat()
  ↓
转换为review格式
{
  title, location, start_time, end_time,
  time_display, price, description,
  original_url, event_type, priority,
  selected: true,
  _source_website, _manually_added: true
}
  ↓
添加到当前选择列表
  ↓
继续正常流程（短链接 → 翻译 → 生成帖子 → 保存数据库）
```

### 数据库追踪

**event_performance 表**（已有字段）：
- `source_review`: NULL（因为不是从review文件来的）
- `source_website`: 记录活动来源URL

**查询手动添加的活动**：
```sql
SELECT * FROM event_performance
WHERE source_website IS NOT NULL
AND source_review IS NULL
```

### AI提取逻辑

对于未知网站，使用以下流程：
1. 获取网页HTML
2. 清理HTML（移除script、style、nav、footer等）
3. 提取body文本内容（限制4000字符）
4. 使用AI provider（ContentTranslator）提取结构化信息
5. 解析JSON返回标准格式

**AI Prompt**：
```
Extract event information from this web page content.

Please extract and return ONLY a JSON object with this exact format:
{
  "title": "Event title",
  "startTime": "2025-11-15T10:00:00.000Z",
  "endTime": "2025-11-15T18:00:00.000Z",
  "location": "Full address or venue name with city",
  "price": "Free" or "$20" or null,
  "description": "Brief description (1-2 sentences)"
}
```

## 测试方法

### 方法1：测试脚本
```bash
# 测试3个已知scraper
node test-manual-add.js

# 测试自定义URL
node test-manual-add.js https://example.com/event
```

### 方法2：集成测试
```bash
# 运行generate-post
npm run generate-post

# 在交互界面输入: add
# 输入测试URL
```

### 测试URL示例
```
Eventbrite:
https://www.eventbrite.com/e/french-holiday-market-tickets-1902205561039

Funcheap:
https://funcheap.com/event/fillmore-jazz-festival-san-francisco-2024-07-06/

SFStation:
https://sfstation.com/2024/07/01/fillmore-jazz-festival/
```

## 已知限制

1. **Funcheap和SFStation**: 目前使用简单的选择器提取，可能需要根据实际页面结构调整
2. **AI提取准确性**: 依赖于AI provider的能力，可能对某些复杂页面提取不准确
3. **时间解析**: AI提取的时间可能需要手动验证
4. **网络超时**: 设置了15秒超时，某些慢速网站可能失败

## 未来优化方向

### Phase 2: 增强功能
1. **编辑功能**: 允许用户编辑AI提取的信息
2. **批量添加**: 支持一次添加多个URL
3. **替换功能**: 选择位置替换现有活动
4. **历史记录**: 保存最近添加的URL

### Phase 3: 生成后修改
1. 支持在第11步（生成文件后、发布前）修改
2. 提供工具读取已生成的文件
3. 添加/替换活动并更新数据库
4. 重新生成文件

## 相关文件

- `/code/MANUAL_EVENT_WORKFLOW.md` - 完整的工作流程设计文档
- `/code/src/utils/universal-scraper.js` - 统一抓取接口
- `/code/src/utils/review-merger.js` - 交互式选择流程
- `/code/test-manual-add.js` - 测试脚本
- `/code/COMMANDS_REFERENCE.md` - 命令参考（第373-424行）

## 总结

这次实现完成了手动添加活动的核心功能：

✅ **完整性**：支持3个已知scraper + AI提取任意网站
✅ **易用性**：简单的交互流程，一个命令就能添加
✅ **可追踪性**：数据库记录source_website，可查询分析
✅ **可扩展性**：UniversalScraper可以轻松添加新的网站支持
✅ **文档完善**：工作流程、实现细节、测试方法都有文档

**实现位置**：在 `npm run generate-post` 的交互选择阶段（第6步）

**用户体验**：
1. 运行 `npm run generate-post`
2. 看到活动列表
3. 输入 `add`
4. 输入URL
5. 确认添加
6. 继续生成帖子

简单、直观、强大！
