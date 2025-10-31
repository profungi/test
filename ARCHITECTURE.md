# 项目架构文档

## 📚 目录结构详解

```
bay-area-events-scraper/
├── src/
│   ├── index.js                      # 主入口和CLI命令路由
│   ├── scrape-events.js              # 爬虫编排器 - 协调并行爬取和数据处理
│   ├── generate-post.js              # 内容生成编排器 - 处理短链、翻译、格式化
│   ├── config.js                     # 全局配置中心
│   │
│   ├── scrapers/                     # 数据采集层
│   │   ├── base-scraper.js           # 基础爬虫类 (Puppeteer + Axios)
│   │   ├── eventbrite-scraper.js     # Eventbrite 爬虫
│   │   ├── sfstation-scraper.js      # SF Station 爬虫
│   │   └── funcheap-weekend-scraper.js # Funcheap 爬虫
│   │
│   ├── utils/                        # 工具层（支撑基础设施）
│   │   ├── database.js               # SQLite ORM包装器
│   │   ├── ai-service.js             # AI提供商抽象层（支持4个提供商的故障转移）
│   │   ├── ai-classifier.js          # 事件分类和优先级排序
│   │   ├── manual-review.js          # 审核文件 I/O 处理
│   │   ├── url-shortener.js          # Short.io 短链接集成
│   │   ├── time-handler.js           # 时间规范化工具
│   │   ├── cover-generator.js        # 小红书封面图片生成 (Puppeteer + 模板)
│   │   └── logger.js                 # 日志系统
│   │
│   ├── formatters/                   # 内容格式化层
│   │   ├── translator.js             # 内容翻译和特征提取
│   │   └── post-generator.js         # 小红书格式生成 + 自动封面生成
│   │
│   └── assets/                       # 静态资源
│       └── cover-template.jpg        # 小红书封面模板图片
│
├── 维护脚本/                         # 数据库管理
│   ├── setup.js                      # 初始化和API密钥验证
│   ├── clear-database.js             # 清空整个数据库
│   ├── clear-all-events.js           # 清空事件表（保留schema）
│   └── clear-next-week-events.js     # 清空特定周的事件
│
├── data/                             # 数据存储
│   └── events.db                     # SQLite数据库文件
│
├── output/                           # 生成的文件
│   ├── review_*.json                 # 审核候选文件
│   ├── weekly_events_*.txt           # 小红书发布文本
│   ├── weekly_events_*_metadata.json # 发布内容元数据
│   └── covers/                       # 小红书封面图片
│       └── cover_*.png               # 自动生成的封面图片
│
├── .github/workflows/                # CI/CD自动化
│   └── weekly-scrape.yml             # 每周自动爬取工作流
│
├── package.json                      # 项目配置和依赖
├── .env.example                      # 环境变量模板
└── README.md                         # 主要文档
```

## 🏗️ 架构图

### 数据流程

```
┌─────────────────────────────────────────────────────────┐
│                   npm run scrape                         │
│                  (第一步：抓取阶段)                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│         并行爬取 (EventbriteScraper)                     │
│         并行爬取 (SFStationScraper)          ───────────┐│
│         并行爬取 (FuncheapWeekendScraper)             │││
└─────────────────────────────────────────────────────────┘│
                           │                               │
                           ▼                               │
┌─────────────────────────────────────────────────────────┐│
│          数据规范化和验证 (base-scraper)                ││
│          - 时间规范化 (time-handler)                   ││
│          - 地理位置过滤 (config.locations)             ││
└─────────────────────────────────────────────────────────┘│
                           │                               │
                           ▼                               │
┌─────────────────────────────────────────────────────────┐│
│          数据去重 (scrape-events.js)                    ││
│          - URL去重                                     ││
│          - 内容特征去重 (title+time+location)          ││
└─────────────────────────────────────────────────────────┘│
                           │                               │
                           ▼                               │
┌─────────────────────────────────────────────────────────┐│
│          保存数据库 (database.js)                       ││
│          - SQLite 数据持久化                           ││
└─────────────────────────────────────────────────────────┘│
                           │                               │
                           ▼                               │
┌─────────────────────────────────────────────────────────┐│
│    AI分类和优先级排序 (ai-classifier.js)               ││
│    - Eventbrite: 页面分类                             ││
│    - 其他: AI分类 + 混合优先级评分                     ││
│    - 选择top 40个候选                              ││
└─────────────────────────────────────────────────────────┘│
                           │                               │
                           ▼                               │
┌─────────────────────────────────────────────────────────┐│
│  生成审核文件 (manual-review.js)                       ││
│  📄 output/review_YYYY-MM-DD_HHMM.json                ││
└─────────────────────────────────────────────────────────┘│
                           │                               │
                           ├──────────────────────────────┘
                           │
                      (用户审核JSON)
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│       npm run generate-post review_*.json               │
│         (第二步：内容生成阶段)                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│        读取审核结果 (manual-review.js)                  │
│        获取 selected: true 的事件                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│    生成短链接 (url-shortener.js)                       │
│    - Short.io API调用                                 │
│    - 路径冲突自动重试                                 │
│    - 认证失败降级处理                                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  内容翻译和特征提取 (translator.js)                     │
│  - 标题翻译为中文                                     │
│  - 描述翻译为中文                                     │
│  - 40+ 特征提取                                       │
│  - 23类关键词智能兜底                                 │
│  - 自动种草话术                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  小红书格式生成 (post-generator.js)                     │
│  - 事件列表格式化                                     │
│  - Hashtag生成                                        │
│  - 最终文本组合                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  自动生成封面图片 (cover-generator.js)                  │
│  - 加载模板图片                                       │
│  - 提取周三到周日日期                                 │
│  - 使用Puppeteer渲染日期                              │
│  - 生成PNG格式图片                                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  输出文件:                                            │
│  📱 output/weekly_events_YYYY-MM-DD_HHMM.txt          │
│      (小红书发布就绪文本)                             │
│  📊 output/weekly_events_YYYY-MM-DD_HHMM_metadata.json│
│      (发布内容元数据)                                 │
│  🎨 output/covers/cover_YYYY-MM-DD_HHmmss_ms.png      │
│      (自动生成的封面图片)                             │
└─────────────────────────────────────────────────────────┘
```

## 🔑 核心模块详解

### 1. 数据采集层 (Scrapers)

#### BaseScraper (基础爬虫)
- **责任**: 提供共享的爬虫基础设施
- **功能**:
  - Puppeteer浏览器管理 (连接池，最多3个并发页面)
  - Axios HTTP客户端 (带自定义User-Agent和超时)
  - 时间范围计算 (下一周周一到周日)
  - 事件规范化 (统一字段结构)
  - 地理位置验证 (旧金山湾区过滤)

- **关键方法**:
  - `fetchPage(url)`: Puppeteer页面获取，带3次重试
  - `normalizeEvent(rawEvent)`: 原始数据规范化
  - `isValidEventTime(time)`: 时间验证
  - `isRelevantLocation(location)`: 地理位置验证

#### EventbriteScraper, SFStationScraper, FuncheapWeekendScraper
- 继承 BaseScraper
- 实现网站特定的HTML解析逻辑
- 返回标准化的事件数据

### 2. 数据处理层 (Utils)

#### database.js - SQLite ORM
```javascript
new EventDatabase()
  .initialize()           // 创建表schema
  .saveEvent(event)       // 持久化事件（带UNIQUE约束去重）
  .getEvent(url)          // 查询单个事件
  .getAllEvents()         // 查询所有事件
  .clearEvents()          // 清空事件表
```

#### ai-service.js - AI提供商抽象
```javascript
new AIService()
  .classify(event)        // 使用指定provider分类
  .translate(text)        // 翻译文本
  // 自动故障转移: OpenAI → Gemini → Claude → Mistral
```

支持的提供商:
- **OpenAI** (gpt-3.5-turbo) - 默认，稳定可靠
- **Google Gemini** (gemini-2.0-flash-exp) - 最新模型，速度快
- **Anthropic Claude** (claude-3-haiku-20240307) - 理解能力强
- **Mistral AI** (mistral-small-latest) - 轻量级，响应快

#### ai-classifier.js - 事件分类
```javascript
new AIEventClassifier()
  .selectTopCandidates(events)  // 选择最优的40个事件

// 混合分类策略:
// - Eventbrite: 使用页面分类
// - 其他源: AI分类 + 优先级评分
// - 最终: 人工审核选择
```

优先级计分:
- 活动类型权重 (市集/节庆 > 美食/音乐 > 其他)
- 地理位置权重 (SF > 南湾 > 半岛 > 东湾)
- 中文相关度 (高权重)

#### time-handler.js - 时间规范化
```javascript
TimeHandler.normalize(timeStr, options)
// 输入: 任何时间格式
// 输出: YYYY-MM-DDTHH:MM (小时精度)
// 特点: 时区验证，支持文本解析fallback
```

#### url-shortener.js - 短链接生成
```javascript
new URLShortener()
  .generateShortUrl(originalUrl, event)

// 流程:
// 1. Short.io API调用
// 2. 路径冲突 → 自动重试
// 3. 认证失败 → 降级到原始URL
```

### 3. 编排层 (Orchestrators)

#### scrape-events.js - 爬虫编排器
```
流程:
1. 初始化3个爬虫
2. 并行爬取 (Promise.all)
3. 去重 (URL + 内容特征)
4. AI分类和排序
5. 生成审核JSON
```

关键算法:
```javascript
// 去重键生成 (generateEventKey)
if (event.originalUrl) {
  key = hash(event.originalUrl)
} else {
  // 标题规范化 + 时间(小时) + 地点(小写)
  key = hash(title + time + location)
}
```

#### generate-post.js - 内容生成编排器
```
流程:
1. 读取审核JSON
2. 提取selected: true的事件
3. 生成短链接
4. 翻译和特征提取
5. 格式化小红书内容
```

### 4. 格式化层 (Formatters)

#### translator.js - AI翻译和特征提取
- **40+ 特征类型**:
  - 节庆活动 (圣诞、万圣节等)
  - 地点特征 (户外、室内、海滩等)
  - 活动类型 (免费、家庭友好、LGBTQ+等)
  - 社交特征 (约会、朋友聚会、独自前往等)

- **23类关键词兜底**:
  - 科技相关 → "创新体验"
  - 瑜伽/冥想 → "身心放松"
  - 喜剧 → "欢乐一刻"
  - 烹饪 → "美食探索"
  - 阅读 → "文化品味"
  - 摄影 → "艺术视角"
  - 等等...

- **自动种草话术**:
  - "绝对值得一去"
  - "不容错过的体验"
  - "周末最佳选择"

#### post-generator.js - 小红书格式生成 + 自动封面生成
- **小红书文本格式化**:
  - 日期范围格式化 (周三到周日)
  - 事件卡片格式化 (emoji + 信息)
  - Hashtag动态生成
  - 最终文本组合

- **自动封面图片生成**:
  - 在生成最终文本后立即执行
  - 调用 `CoverGenerator.generateCover(weekRange)`
  - 返回图片路径和元数据
  - 与文本文件关联输出

```
输出格式示例:

🎉 本周湾区精彩活动 9.23-9.29

📅 渡轮大厦农夫市集 (Ferry Building Farmers Market)
🕒 周六 12/25 上午9点-下午2点
📍 渡轮大厦市场 (Ferry Building Marketplace)
💰 免费
📝 新鲜有机农产品好物
🔗 https://short.io/abc123

#湾区生活 #旧金山 #硅谷 #活动推荐 #周末去哪儿
```

#### cover-generator.js - 小红书封面图片生成
- **功能**: 自动生成符合小红书规范的封面图片
- **技术栈**: Puppeteer浏览器渲染 + 模板图片

- **工作流程**:
  1. 读取 `assets/cover-template.jpg` 模板图片
  2. 将图片转换为base64 data URI
  3. 使用Puppeteer设置视口 (1024×1536)
  4. 生成HTML：模板图片 + 日期文本overlay
  5. 截图到PNG文件

- **日期处理**:
  - 输入: weekRange对象 (identifier: "YYYY-MM-DD_to_YYYY-MM-DD")
  - 提取周三到周日日期
  - 格式化: "M/d - M/d" (e.g., "11/5 - 11/9")
  - 支持跨月份日期范围

- **文件输出**:
  - 路径: `output/covers/cover_YYYY-MM-DD_HHmmss_ms.png`
  - 文件名精度: 毫秒级 (防止覆盖)
  - 返回对象: `{ filepath, filename, dateRange, generatedAt }`

- **样式特点**:
  - 日期字体: 95px, bold (900), 棕色 (#2D2416)
  - 位置: 距离顶部 480px, 水平居中 (避免遮挡上方文字和下方图片)
  - 背景: 高质量模板图片 (葡萄角色卡通设计)

```javascript
// 使用示例
const coverGenerator = new CoverGenerator();
const result = await coverGenerator.generateCover({
  identifier: '2024-11-04_to_2024-11-10',
  start: '2024-11-04',
  end: '2024-11-10'
});
// result: {
//   filepath: 'output/covers/cover_2024-11-04_100530_234.png',
//   filename: 'cover_2024-11-04_100530_234.png',
//   dateRange: '11/5 - 11/9',
//   generatedAt: '2024-11-04T10:05:30.234Z'
// }
```

## 🔄 工作流程详解

### 第一步: npm run scrape

```javascript
EventScrapeOrchestrator
  ↓
初始化爬虫 (3个并行)
  ├─ EventbriteScraper
  ├─ SFStationScraper
  └─ FuncheapWeekendScraper
  ↓
并行爬取 (Promise.all)
  ├─ 每个爬虫调用 scrapeEvents()
  ├─ 返回原始事件数组
  └─ 带时间范围过滤
  ↓
数据规范化
  ├─ normalizeEvent() 统一字段
  ├─ 时间验证 (isValidEventTime)
  └─ 地理位置验证 (isRelevantLocation)
  ↓
URL级去重 (先检查)
  └─ 数据库UNIQUE约束 (originalUrl)
  ↓
保存数据库
  └─ SQLite events表
  ↓
内容级去重 (后检查)
  ├─ 生成特征键: title + time(小时) + location
  ├─ 哈希去重
  └─ 返回去重后的事件列表
  ↓
AI分类和优先级
  ├─ Eventbrite: 使用页面分类
  ├─ 其他源: AI分类
  └─ 计算优先级评分
  ↓
选择top候选 (40个)
  └─ 按优先级排序
  ↓
生成审核JSON
  └─ output/review_YYYY-MM-DD_HHMM.json
```

### 第二步: npm run generate-post review_*.json

```javascript
PostGenerationOrchestrator
  ↓
读取审核JSON
  └─ 解析JSON文件
  ↓
提取选中事件
  └─ 过滤 selected: true
  ↓
生成短链接
  ├─ Short.io API
  ├─ 路径冲突自动重试
  └─ 认证失败降级
  ↓
内容翻译和特征提取
  ├─ 标题翻译
  ├─ 描述翻译
  ├─ 40+ 特征提取
  ├─ 23类关键词兜底
  └─ 自动种草话术
  ↓
小红书格式生成
  ├─ 日期范围格式化
  ├─ 事件卡片格式化
  ├─ Hashtag生成
  └─ 最终文本组合
  ↓
自动生成封面图片
  ├─ 提取周三到周日日期
  ├─ 加载模板图片
  ├─ 使用Puppeteer渲染
  └─ 保存PNG文件
  ↓
输出文件
  ├─ output/weekly_events_YYYY-MM-DD_HHMM.txt (发布文本)
  ├─ output/weekly_events_YYYY-MM-DD_HHMM_metadata.json (元数据)
  └─ output/covers/cover_YYYY-MM-DD_HHmmss_ms.png (封面图片)
```

## 🎯 核心设计原则

### 1. 单一责任原则
- BaseScraper: 只负责爬虫基础设施
- 各Scraper: 只负责网站特定逻辑
- Orchestrators: 只负责流程协调
- Utils: 各自负责一个功能模块

### 2. 依赖注入
```javascript
// 而不是硬编码依赖
new AIService(providerName)
new EventDatabase(dbPath)
```

### 3. 错误处理和降级
- 短链接生成失败 → 使用原始URL
- AI翻译失败 → 保留英文
- 爬虫超时 → 返回部分数据
- AI Provider失败 → 自动切换

### 4. 配置集中化
所有配置都在 `src/config.js`:
- 事件源定义
- AI提供商配置
- 地理位置定义
- 优先级权重
- 抓取限制

## 🔧 可扩展性

### 添加新的数据源

1. 在 `src/scrapers/` 创建新Scraper:
```javascript
class NewScraper extends BaseScraper {
  constructor() {
    super('newsource');
  }

  async scrapeEvents(weekRange) {
    // 实现网站特定的爬取逻辑
    return normalizedEvents;
  }
}
```

2. 在 `src/index.js` 添加到爬虫列表:
```javascript
this.scrapers = [
  new EventbriteScraper(),
  new SFStationScraper(),
  new NewScraper()
];
```

3. 在 `src/config.js` 添加配置:
```javascript
{
  name: 'newsource',
  baseUrl: 'https://...',
  priority: 1
}
```

### 添加新的AI提供商

在 `src/utils/ai-service.js` 的 `providers` 列表中添加。系统已支持4个提供商，自动故障转移机制将继续有效。

## 📊 性能特性

- **并发爬取**: 3个数据源同时爬取 (Promise.all)
- **连接池**: Puppeteer最多3个并发页面
- **请求延迟**: 1000ms (可配置，避免被封)
- **数据库**: SQLite全文索引支持快速去重
- **短链接**: 路径冲突自动重试，不阻塞主流程

## 📝 日志记录

所有关键步骤都有日志记录:
```
[ScrapeOrchestrator] Starting scrape...
[EventbriteScraper] Fetching page: ...
[SFStationScraper] Found 23 events
[Database] Saving event: ...
[Deduplication] Deduped from 83 to 23 events
[AIClassifier] Classified events
[ReviewManager] Generated review file
```

可通过 `src/utils/logger.js` 配置日志级别。

## 🚀 自动化

GitHub Actions 工作流 (`.github/workflows/weekly-scrape.yml`):
- 每周三 UTC 16:00 (PST 周三 08:00) 自动执行
- 生成审核文件并上传到 Artifacts
- 失败时创建 Issue 提醒

## 总结

这个架构采用了**分层设计** + **编排模式**:

- **采集层**: 多源并行爬取，统一规范化
- **处理层**: 去重、验证、分类、评分
- **生成层**: 翻译、特征提取、格式化
- **编排层**: 两个Orchestrator协调整个流程

每个模块职责清晰，易于测试和维护。可以独立替换或升级单个模块而不影响其他部分。
