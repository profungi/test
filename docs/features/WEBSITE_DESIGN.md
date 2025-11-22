# 湾区活动网站设计方案

## 项目概述

基于现有的湾区活动爬虫系统，设计一个用户友好的网站，让用户可以浏览和过滤本周或下周的湾区活动。

## 现有资源分析

### 数据源
- **数据库**: SQLite (`data/events.db`)
  - `events` 表: 包含所有爬取的活动信息
  - `posts` 表: 发布记录
  - `event_performance` 表: 活动表现数据

- **爬虫系统**:
  - Eventbrite (多城市)
  - SF Station
  - Funcheap

- **数据字段**:
  - 标题、时间、地点、价格、描述
  - 活动类型 (market, festival, food, music, art, tech, free)
  - 优先级评分
  - 地理位置分类
  - 原始URL和短链接

### 现有功能
- 每周自动抓取活动
- AI 智能分类
- 人工审核流程
- 短链接生成
- 反馈收集系统

## 网站设计方案

### 技术栈选择

#### 方案A: 轻量级静态网站 (推荐)
**适合**: 快速启动，低维护成本

- **前端**: HTML + CSS + JavaScript (Vanilla或Vue.js)
- **后端**: Node.js + Express (轻量级API)
- **数据**: 直接读取 SQLite 数据库
- **部署**: Vercel / Netlify / GitHub Pages

**优势**:
- 使用现有技术栈 (Node.js)
- 无需额外数据库配置
- 快速开发和部署
- 低成本甚至免费

#### 方案B: 全栈应用
**适合**: 需要更多交互功能

- **前端**: React / Next.js
- **后端**: Node.js + Express
- **数据库**: SQLite (现有) 或 PostgreSQL
- **部署**: Vercel / Railway / Heroku

### 网站功能设计

#### 1. 首页
```
┌─────────────────────────────────────────┐
│  🎯 湾区活动 Bay Area Events            │
│  ─────────────────────────────────────  │
│                                         │
│  [本周活动] [下周活动]                   │
│                                         │
│  筛选器:                                 │
│  📍 地区: [全部▾] [旧金山] [南湾] [东湾]  │
│  🎭 类型: [全部▾] [市集] [节日] [美食]   │
│  💰 价格: [全部] [免费] [付费]           │
│  📅 时间: [全部] [周末] [工作日]         │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  活动列表 (40个活动)                     │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 🎪 Pickwick Vintage Show         │  │
│  │ 📅 周日 11/23 上午10:00          │  │
│  │ 📍 San Francisco Ferry Building  │  │
│  │ 💰 $11.54                        │  │
│  │ ✨ 复古服装、珠宝展销会...         │  │
│  │ [查看详情] [添加到日历]           │  │
│  └──────────────────────────────────┘  │
│                                         │
│  [加载更多...]                          │
│                                         │
└─────────────────────────────────────────┘
```

#### 2. 核心功能

**A. 时间过滤**
- [x] 本周活动 (当前周一至周日)
- [x] 下周活动 (下周一至周日)
- [x] 自定义日期范围

**B. 地理位置过滤**
基于现有配置 (`src/config.js`)：
- [x] 全部湾区
- [x] 旧金山 (San Francisco)
- [x] 南湾 (South Bay): San Jose, Sunnyvale, Santa Clara, Cupertino等
- [x] 半岛 (Peninsula): Palo Alto, Mountain View, Redwood City等
- [x] 东湾 (East Bay): Oakland, Berkeley, Alameda等
- [x] 北湾 (North Bay): Marin, Napa, Sonoma等

**C. 活动类型过滤**
基于现有分类：
- [x] 市集 (Market) - 优先级 10
- [x] 节日/博览会 (Festival/Fair) - 优先级 10
- [x] 免费活动 (Free) - 优先级 9
- [x] 美食 (Food) - 优先级 6
- [x] 艺术 (Art) - 优先级 5
- [x] 科技 (Tech) - 优先级 5
- [x] 音乐 (Music) - 优先级 4

**D. 价格过滤**
- [x] 全部
- [x] 免费 (Free)
- [x] $0-20
- [x] $20-50
- [x] $50+

**E. 时段过滤**
- [x] 全部
- [x] 周末 (周六、周日)
- [x] 工作日 (周一至周五)
- [x] 上午 (12点前)
- [x] 下午 (12点-6点)
- [x] 晚上 (6点后)

#### 3. 活动详情页

```
┌─────────────────────────────────────────┐
│  ← 返回列表                              │
│                                         │
│  🎪 Pickwick Vintage Show               │
│  ★★★★☆ 优先级: 10/10                   │
│                                         │
│  📅 时间                                 │
│  周日, 11月23日 2025                    │
│  上午10:00 开始                         │
│                                         │
│  📍 地点                                 │
│  San Francisco Ferry Building           │
│  1 Ferry Building                       │
│  San Francisco, CA 94111                │
│  [Google Maps 📍]                       │
│                                         │
│  💰 票价                                 │
│  $11.54                                 │
│                                         │
│  ✨ 活动描述                             │
│  复古服装、珠宝和配饰展销会，超过40个     │
│  本地商家参展。地标性Ferry Building举办   │
│                                         │
│  🏷️ 标签                                │
│  #市集 #旧金山 #复古                     │
│                                         │
│  🔗 链接                                 │
│  [活动官网] [添加到日历] [分享]          │
│                                         │
│  📊 数据来源: Eventbrite                │
│                                         │
└─────────────────────────────────────────┘
```

#### 4. 附加功能

**A. 日历视图**
```
     11月 2025
一  二  三  四  五  六  日
17  18  19  20  21  22  23
[3] [5] [8] [2] [6] [12] [15]
    ●   ●●  ●   ●●  ●●● ●●●
```
数字表示当天活动数量，点击可查看详情

**B. 地图视图**
- 在地图上显示所有活动位置
- 使用 Google Maps API 或 Mapbox
- 点击标记查看活动详情

**C. 个人收藏**
- 用户可以收藏感兴趣的活动
- 使用 LocalStorage 存储 (无需登录)
- 导出为 .ics 日历文件

**D. 搜索功能**
- 关键词搜索标题和描述
- 实时搜索结果更新

## 后端 API 设计

### 核心 API 端点

```javascript
// 获取活动列表
GET /api/events
Query参数:
  - week: 'current' | 'next' | 'YYYY-MM-DD_to_YYYY-MM-DD'
  - location: 'all' | 'sanfrancisco' | 'southbay' | 'peninsula' | 'eastbay' | 'northbay'
  - type: 'all' | 'market' | 'festival' | 'food' | 'music' | 'art' | 'tech' | 'free'
  - price: 'all' | 'free' | '0-20' | '20-50' | '50+'
  - day: 'all' | 'weekend' | 'weekday'
  - time: 'all' | 'morning' | 'afternoon' | 'evening'
  - limit: number (默认 40)
  - offset: number (默认 0)

响应:
{
  "success": true,
  "data": {
    "events": [...],
    "total": 47,
    "week_identifier": "2025-11-17_to_2025-11-23",
    "filters_applied": {...}
  }
}

// 获取单个活动详情
GET /api/events/:id

// 获取统计数据
GET /api/stats
响应:
{
  "total_events": 47,
  "by_type": {"free": 27, "market": 4, ...},
  "by_location": {"sanfrancisco": 20, "southbay": 15, ...},
  "by_day": {"monday": 3, "tuesday": 5, ...}
}

// 获取可用周列表
GET /api/weeks
响应:
{
  "weeks": [
    {
      "week_identifier": "2025-11-17_to_2025-11-23",
      "readable": "11/17 - 11/23",
      "event_count": 47,
      "is_current": false,
      "is_next": true
    },
    ...
  ]
}
```

## 实现步骤

### 阶段1: MVP (最小可行产品) - 1-2周

1. **后端 API 开发**
   - [ ] 创建 Express 服务器
   - [ ] 实现数据库查询函数
   - [ ] 创建 API 端点 (events, stats, weeks)
   - [ ] 添加过滤和排序逻辑

2. **前端基础页面**
   - [ ] 创建 HTML 框架
   - [ ] 实现活动列表展示
   - [ ] 添加基本样式 (CSS)
   - [ ] 实现周切换功能 (本周/下周)

3. **核心过滤功能**
   - [ ] 地理位置过滤
   - [ ] 活动类型过滤
   - [ ] 价格过滤
   - [ ] 实时过滤更新

### 阶段2: 增强功能 - 2-3周

4. **用户体验优化**
   - [ ] 响应式设计 (移动端适配)
   - [ ] 活动详情页
   - [ ] 搜索功能
   - [ ] 加载状态和错误处理

5. **高级过滤**
   - [ ] 时段过滤 (周末/工作日)
   - [ ] 时间段过滤 (上午/下午/晚上)
   - [ ] 多选过滤器

6. **附加功能**
   - [ ] 日历视图
   - [ ] 收藏功能 (LocalStorage)
   - [ ] 导出到日历 (.ics)
   - [ ] 社交分享

### 阶段3: 高级功能 - 3-4周

7. **可视化增强**
   - [ ] 地图视图
   - [ ] 活动卡片优化
   - [ ] 图片加载 (如果有)
   - [ ] 动画和过渡效果

8. **性能优化**
   - [ ] API 缓存
   - [ ] 分页加载
   - [ ] 懒加载
   - [ ] SEO 优化

## 文件结构

```
bay-area-events-scraper/
├── website/                    # 新增网站目录
│   ├── backend/               # 后端 API
│   │   ├── server.js          # Express 服务器
│   │   ├── routes/
│   │   │   ├── events.js      # 活动相关路由
│   │   │   ├── stats.js       # 统计路由
│   │   │   └── weeks.js       # 周列表路由
│   │   ├── controllers/
│   │   │   └── eventController.js
│   │   ├── services/
│   │   │   └── eventService.js  # 业务逻辑
│   │   └── utils/
│   │       └── db.js          # 数据库工具
│   │
│   └── frontend/              # 前端网站
│       ├── index.html         # 主页
│       ├── event-detail.html  # 活动详情页
│       ├── css/
│       │   ├── main.css       # 主样式
│       │   └── responsive.css # 响应式样式
│       ├── js/
│       │   ├── app.js         # 主应用逻辑
│       │   ├── api.js         # API 调用
│       │   ├── filters.js     # 过滤器逻辑
│       │   └── utils.js       # 工具函数
│       └── assets/
│           └── images/
│
├── src/                       # 现有爬虫代码
├── data/                      # 数据库
└── output/                    # 输出文件
```

## UI/UX 设计原则

### 设计风格
- **现代简约**: 清晰的布局，充足的留白
- **卡片式设计**: 活动信息使用卡片展示
- **响应式**: 移动端优先设计
- **易用性**: 直观的过滤器和导航

### 色彩方案
```css
/* 主色调 */
--primary-color: #3B82F6;      /* 蓝色 - 可信赖 */
--secondary-color: #8B5CF6;    /* 紫色 - 创意 */
--accent-color: #10B981;       /* 绿色 - 行动 */

/* 活动类型颜色 */
--market-color: #F59E0B;       /* 橙色 */
--festival-color: #EC4899;     /* 粉色 */
--food-color: #EF4444;         /* 红色 */
--music-color: #8B5CF6;        /* 紫色 */
--art-color: #06B6D4;          /* 青色 */
--tech-color: #3B82F6;         /* 蓝色 */
--free-color: #10B981;         /* 绿色 */

/* 中性色 */
--background: #F9FAFB;
--card-background: #FFFFFF;
--text-primary: #111827;
--text-secondary: #6B7280;
--border: #E5E7EB;
```

### 字体
- **标题**: 'Inter' 或 'SF Pro Display'
- **正文**: 'Inter' 或 'SF Pro Text'
- **中文**: 'Noto Sans SC' 或 'PingFang SC'

## 示例代码片段

### 后端 API 示例 (eventService.js)

```javascript
const Database = require('better-sqlite3');
const config = require('../../src/config');

class EventService {
  constructor() {
    this.db = new Database(config.database.path);
  }

  // 获取活动列表
  getEvents(filters = {}) {
    const {
      week = 'next',
      location = 'all',
      type = 'all',
      price = 'all',
      day = 'all',
      time = 'all',
      limit = 40,
      offset = 0,
      search = ''
    } = filters;

    // 构建 WHERE 子句
    let whereClause = ['1=1'];
    const params = {};

    // 周过滤
    if (week !== 'all') {
      const weekIdentifier = this.getWeekIdentifier(week);
      whereClause.push('week_identifier = @weekIdentifier');
      params.weekIdentifier = weekIdentifier;
    }

    // 地理位置过滤
    if (location !== 'all') {
      const locations = this.getLocationsByCategory(location);
      const placeholders = locations.map((_, i) => `@loc${i}`).join(',');
      whereClause.push(`(${locations.map((loc, i) => {
        params[`loc${i}`] = loc;
        return `location LIKE '%' || @loc${i} || '%'`;
      }).join(' OR ')})`);
    }

    // 活动类型过滤
    if (type !== 'all') {
      whereClause.push('event_type = @type');
      params.type = type;
    }

    // 价格过滤
    if (price !== 'all') {
      whereClause.push(this.getPriceFilter(price));
    }

    // 搜索
    if (search) {
      whereClause.push('(title LIKE @search OR description LIKE @search)');
      params.search = `%${search}%`;
    }

    // 构建查询
    const sql = `
      SELECT * FROM events
      WHERE ${whereClause.join(' AND ')}
      ORDER BY priority DESC, start_time ASC
      LIMIT @limit OFFSET @offset
    `;

    params.limit = limit;
    params.offset = offset;

    const stmt = this.db.prepare(sql);
    const events = stmt.all(params);

    // 后处理: 时段过滤 (需要解析时间)
    return this.applyTimeFilters(events, { day, time });
  }

  // 获取周标识符
  getWeekIdentifier(week) {
    const now = new Date();
    let monday;

    if (week === 'current') {
      // 获取本周一
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      monday = new Date(now.setDate(diff));
    } else if (week === 'next') {
      // 获取下周一
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) + 7;
      monday = new Date(now.setDate(diff));
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return `${this.formatDate(monday)}_to_${this.formatDate(sunday)}`;
  }

  // 根据地区类别获取城市列表
  getLocationsByCategory(category) {
    const locationMap = {
      sanfrancisco: config.locations.sanfrancisco,
      southbay: config.locations.southbay,
      peninsula: config.locations.peninsula,
      eastbay: config.locations.eastbay,
      northbay: config.locations.northbay
    };
    return locationMap[category] || [];
  }

  // 获取统计数据
  getStats(weekIdentifier) {
    const sql = `
      SELECT
        COUNT(*) as total,
        event_type,
        COUNT(*) as count
      FROM events
      WHERE week_identifier = @weekIdentifier
      GROUP BY event_type
    `;

    const rows = this.db.prepare(sql).all({ weekIdentifier });

    return {
      total: rows.reduce((sum, row) => sum + row.count, 0),
      by_type: rows.reduce((acc, row) => {
        acc[row.event_type] = row.count;
        return acc;
      }, {})
    };
  }

  // ... 其他辅助方法
}

module.exports = new EventService();
```

### 前端 API 调用示例 (api.js)

```javascript
const API_BASE_URL = 'http://localhost:3000/api';

class EventAPI {
  // 获取活动列表
  async getEvents(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE_URL}/events?${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch events');
    }
    return response.json();
  }

  // 获取活动详情
  async getEvent(id) {
    const response = await fetch(`${API_BASE_URL}/events/${id}`);
    if (!response.ok) {
      throw new Error('Event not found');
    }
    return response.json();
  }

  // 获取统计数据
  async getStats(week = 'next') {
    const response = await fetch(`${API_BASE_URL}/stats?week=${week}`);
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    return response.json();
  }

  // 获取可用周列表
  async getWeeks() {
    const response = await fetch(`${API_BASE_URL}/weeks`);
    if (!response.ok) {
      throw new Error('Failed to fetch weeks');
    }
    return response.json();
  }
}

export default new EventAPI();
```

### 前端主应用逻辑示例 (app.js)

```javascript
import EventAPI from './api.js';

class EventsApp {
  constructor() {
    this.filters = {
      week: 'next',
      location: 'all',
      type: 'all',
      price: 'all',
      day: 'all',
      time: 'all'
    };
    this.events = [];
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadEvents();
  }

  // 设置事件监听器
  setupEventListeners() {
    // 周切换
    document.querySelectorAll('[data-week-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.filters.week = e.target.dataset.weekFilter;
        this.loadEvents();
      });
    });

    // 地理位置过滤
    document.getElementById('location-filter').addEventListener('change', (e) => {
      this.filters.location = e.target.value;
      this.loadEvents();
    });

    // 活动类型过滤
    document.getElementById('type-filter').addEventListener('change', (e) => {
      this.filters.type = e.target.value;
      this.loadEvents();
    });

    // 价格过滤
    document.getElementById('price-filter').addEventListener('change', (e) => {
      this.filters.price = e.target.value;
      this.loadEvents();
    });
  }

  // 加载活动
  async loadEvents() {
    try {
      this.showLoading();
      const response = await EventAPI.getEvents(this.filters);
      this.events = response.data.events;
      this.renderEvents();
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.hideLoading();
    }
  }

  // 渲染活动列表
  renderEvents() {
    const container = document.getElementById('events-container');

    if (this.events.length === 0) {
      container.innerHTML = '<p class="no-events">暂无活动</p>';
      return;
    }

    container.innerHTML = this.events.map(event => this.renderEventCard(event)).join('');
  }

  // 渲染活动卡片
  renderEventCard(event) {
    const typeColor = this.getTypeColor(event.event_type);

    return `
      <div class="event-card" data-event-id="${event.id}">
        <div class="event-card-header">
          <span class="event-type" style="background-color: ${typeColor}">
            ${this.getTypeEmoji(event.event_type)} ${this.getTypeLabel(event.event_type)}
          </span>
          <span class="event-priority">★ ${event.priority}/10</span>
        </div>

        <h3 class="event-title">${event.title}</h3>

        <div class="event-details">
          <div class="event-detail">
            <span class="icon">📅</span>
            <span>${this.formatTime(event.time_display)}</span>
          </div>

          <div class="event-detail">
            <span class="icon">📍</span>
            <span>${this.formatLocation(event.location)}</span>
          </div>

          <div class="event-detail">
            <span class="icon">💰</span>
            <span>${event.price || '价格待定'}</span>
          </div>
        </div>

        ${event.description_preview ? `
          <p class="event-description">${event.description_preview}</p>
        ` : ''}

        <div class="event-actions">
          <a href="event-detail.html?id=${event.id}" class="btn btn-primary">查看详情</a>
          <button class="btn btn-secondary" onclick="app.saveToCalendar(${event.id})">
            添加到日历
          </button>
        </div>
      </div>
    `;
  }

  // ... 辅助方法

  getTypeColor(type) {
    const colors = {
      market: '#F59E0B',
      festival: '#EC4899',
      food: '#EF4444',
      music: '#8B5CF6',
      art: '#06B6D4',
      tech: '#3B82F6',
      free: '#10B981'
    };
    return colors[type] || '#6B7280';
  }

  getTypeEmoji(type) {
    const emojis = {
      market: '🛍️',
      festival: '🎉',
      food: '🍴',
      music: '🎵',
      art: '🎨',
      tech: '💻',
      free: '🆓'
    };
    return emojis[type] || '📌';
  }

  getTypeLabel(type) {
    const labels = {
      market: '市集',
      festival: '节日',
      food: '美食',
      music: '音乐',
      art: '艺术',
      tech: '科技',
      free: '免费',
      fair: '博览会'
    };
    return labels[type] || '其他';
  }
}

// 初始化应用
const app = new EventsApp();
```

## 部署方案

### 选项1: Vercel (推荐)
- **优势**: 免费，自动部署，支持 Serverless Functions
- **步骤**:
  1. 安装 Vercel CLI: `npm i -g vercel`
  2. 在项目根目录运行: `vercel`
  3. 配置 `vercel.json`

### 选项2: Railway
- **优势**: 支持数据库，持久化存储
- **步骤**:
  1. 连接 GitHub 仓库
  2. 自动检测 Node.js 项目
  3. 一键部署

### 选项3: 传统服务器 (Digital Ocean, AWS EC2)
- **优势**: 完全控制，适合生产环境
- **步骤**:
  1. 设置 Node.js 环境
  2. 安装 PM2 进程管理
  3. 配置 Nginx 反向代理
  4. 设置 SSL 证书

## 数据更新策略 (混合方案)

### 推荐方案: 定时构建 + ISR (最优配置)

结合 GitHub Actions 定时构建和 Next.js ISR (Incremental Static Regeneration)，实现最佳的数据新鲜度和性能平衡。

#### 架构流程

```
┌─────────────────────────────────────────────────────┐
│          数据更新的两个触发点                          │
└─────────────────────────────────────────────────────┘
                    ↓                    ↓
         [定时触发 - 每周三]        [访问触发 - 任何时候]
                    ↓                    ↓
         GitHub Actions              Next.js ISR
         运行爬虫                     边缘缓存
                    ↓                    ↓
         更新 SQLite 数据库          缓存过期后重新验证
                    ↓                    ↓
         Git commit & push          后台重新生成页面
                    ↓                    ↓
         Vercel 重新部署            用户获得最新数据
                    ↓
              新版本上线
```

#### 1. GitHub Actions 定时构建

```yaml
# .github/workflows/update-data.yml
name: Weekly Data Update

on:
  schedule:
    - cron: '0 10 * * 3'  # 每周三 10:00 UTC (PST 2:00 AM)
  workflow_dispatch:      # 也可手动触发

jobs:
  update-data:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run scrapers
        run: npm run scrape
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}

      - name: Copy database to website
        run: |
          mkdir -p website/public/data
          cp data/events.db website/public/data/events.db

      - name: Commit updated database
        run: |
          git config user.name "Events Bot"
          git config user.email "bot@bayareaevents.com"
          git add website/public/data/events.db
          git commit -m "📅 Update events data - $(date)" || exit 0
          git push
```

**触发结果**:
- SQLite 文件被更新
- Git push 触发 Vercel 自动重新部署
- 30-60 秒后新数据上线

#### 2. Next.js ISR 配置

```typescript
// app/page.tsx - 首页
export const revalidate = 3600; // 1小时重新验证

export default async function EventsPage({ searchParams }) {
  const events = await getEvents({
    week: searchParams.week || 'next',
    location: searchParams.location || 'all',
    type: searchParams.type || 'all',
  });

  return <EventList events={events} />;
}

// app/events/[id]/page.tsx - 活动详情页
export const revalidate = 21600; // 6小时重新验证 (变化较少)

// app/api/events/route.ts - API 路由
export async function GET(request: NextRequest) {
  const events = await getEvents(filters);

  return Response.json(events, {
    headers: {
      // 浏览器缓存 5 分钟
      'Cache-Control': 'public, max-age=300',
      // CDN 缓存 1 小时，过期后可返回旧数据
      'CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
```

**ISR 工作流程**:
```
第一次访问:
  → 服务器渲染页面 → 缓存 (1小时) → 返回用户

1小时内的访问:
  → 直接返回缓存 (< 50ms)

1小时后第一次访问:
  → 返回旧缓存 (快速)
  → 后台重新生成
  → 下次访问获得新页面
```

#### 3. 时间线示例

**周三数据更新**:
```
周三 10:00 UTC (凌晨 2:00 PST)
  ├─ GitHub Actions 运行爬虫 (10-15分钟)
  ├─ 更新 SQLite → Git push
  └─ Vercel 检测变更
      ├─ 重新部署 (1-2分钟)
      └─ 新版本上线
          └─ ISR 缓存自动失效

周三 10:20 UTC
  └─ 网站已有最新数据

周三-周四
  └─ 用户访问使用缓存 (超快)

周四 10:30 UTC 后
  ├─ 返回缓存 (快速)
  └─ 后台重新验证
```

#### 4. 推荐的缓存配置

| 页面类型 | Revalidate | 原因 |
|---------|-----------|------|
| 首页列表 | 3600 (1小时) | 用户经常访问，希望数据较新 |
| 活动详情 | 21600 (6小时) | 单个活动变化少，可激进缓存 |
| API 路由 | 3600 (CDN) | 边缘缓存，全球快速访问 |

#### 5. 混合方案的优势

✅ **保证数据新鲜**
- 每周三自动更新
- 最多 1 小时延迟

✅ **性能极佳**
- 大部分请求命中缓存
- 响应时间 < 50ms

✅ **成本最低**
- 减少 Serverless Functions 执行
- 轻松保持免费额度

✅ **易于维护**
- 全自动化
- 不需要手动干预

✅ **未来可扩展**
- 可调整缓存时间
- 可添加手动刷新
- 可添加更多缓存层

#### 6. 高级优化 (可选)

**按需重新验证**:
```typescript
// app/actions/revalidate.ts
'use server';
import { revalidatePath } from 'next/cache';

export async function revalidateEvents() {
  revalidatePath('/');
  return { success: true };
}
```

**增量更新检测**:
```javascript
// 只有数据真的变化了才 commit
const oldHash = await getOldHash();
const newHash = await getEventsHash();

if (oldHash !== newHash) {
  git commit && git push
} else {
  console.log('No changes, skip deployment');
}
```

## SEO 优化

### Meta 标签
```html
<head>
  <title>湾区活动 - 本周精彩活动推荐 | Bay Area Events</title>
  <meta name="description" content="发现湾区最精彩的活动！市集、节日、美食、艺术活动一网打尽。涵盖旧金山、南湾、东湾等地区。">
  <meta name="keywords" content="湾区活动,旧金山活动,南湾活动,周末活动,免费活动">

  <!-- Open Graph -->
  <meta property="og:title" content="湾区活动 - 本周精彩活动">
  <meta property="og:description" content="发现湾区最精彩的活动">
  <meta property="og:type" content="website">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="湾区活动">
</head>
```

### 结构化数据
```javascript
// 为每个活动添加 JSON-LD
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Pickwick Vintage Show",
  "startDate": "2025-11-23T10:00:00-08:00",
  "location": {
    "@type": "Place",
    "name": "San Francisco Ferry Building",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "San Francisco",
      "addressRegion": "CA"
    }
  },
  "offers": {
    "@type": "Offer",
    "price": "11.54",
    "priceCurrency": "USD"
  }
}
```

## 移动端优化

### 响应式断点
```css
/* 移动端 */
@media (max-width: 640px) {
  .event-card {
    width: 100%;
  }
  .filters {
    flex-direction: column;
  }
}

/* 平板 */
@media (min-width: 641px) and (max-width: 1024px) {
  .event-card {
    width: calc(50% - 1rem);
  }
}

/* 桌面 */
@media (min-width: 1025px) {
  .event-card {
    width: calc(33.333% - 1rem);
  }
}
```

### PWA 支持 (渐进式)
```json
// manifest.json
{
  "name": "湾区活动",
  "short_name": "Bay Area Events",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3B82F6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## 总结

这个设计方案充分利用了你现有的数据和基础设施，通过简洁的技术栈快速实现一个功能完善的湾区活动网站。

**核心优势**:
1. ✅ 无需额外数据迁移 - 直接使用现有 SQLite 数据库
2. ✅ 技术栈一致 - 继续使用 Node.js
3. ✅ 快速部署 - 可以在1-2周内完成 MVP
4. ✅ 低成本 - 可以使用免费托管服务
5. ✅ 易于维护 - 爬虫自动更新数据

**下一步**:
1. 选择技术栈和部署方案
2. 开始后端 API 开发
3. 设计并实现前端界面
4. 测试和优化
5. 部署上线

有任何问题或需要调整的地方，随时告诉我！
