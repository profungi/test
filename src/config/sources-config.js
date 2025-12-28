/**
 * 配置驱动的活动源配置
 * 支持CSS选择器抓取、AI提取、固定时间活动生成
 */

module.exports = {
  // ========== CSS抓取源 ==========
  // 这些网站有清晰的HTML结构，可以用CSS选择器直接抓取
  css_sources: [
    {
      name: 'dothebay',
      displayName: 'DoTheBay',
      priority: 1, // 最高优先级 - 54个事件
      enabled: true,
      frequency: 'weekly',
      listUrl: 'https://dothebay.com/events',
      waitTime: 5000, // 需要等待JavaScript渲染
      selectors: {
        container: '.ds-listing',
        title: '.ds-listing-event-title-text, h3, h4',
        date: '.ds-event-time',
        location: '.ds-event-location, .ds-venue',
        link: 'a',
        description: '.ds-listing-event-description, .description'
      },
      // 需要访问详情页获取完整信息
      needsDetailPage: true,
      detailSelectors: {
        title: 'h1, .event-title',
        date: '.event-date, time, .ds-event-time',
        location: '.event-location, .venue, address',
        price: '.price, .cost, .admission',
        description: '.event-description, .description, .content'
      }
    },
    {
      name: 'sjdowntown',
      displayName: 'San Jose Downtown',
      priority: 2,
      enabled: true,
      frequency: 'weekly',
      listUrl: 'https://sjdowntown.com/dtsj-events',
      waitTime: 2000,
      selectors: {
        container: 'article',
        title: 'h2, h3, .entry-title',
        date: '.event-date, time',
        location: '.location, .venue',
        link: 'a',
        description: '.entry-content, .description'
      },
      // 过滤无效标题
      filters: {
        skipTitles: [
          'Whats going on',
          'What\'s going on',
          'Events Search',
          'Search and Views Navigation',
          'Navigation',
          'Sonic Runway' // 固定装置
        ],
        minTitleLength: 5
      }
    }
  ],

  // ========== AI抓取源 ==========
  // 这些网站结构复杂或动态渲染，使用AI提取更可靠
  ai_sources: [
    // ---------- 月度固定活动 ----------
    {
      name: 'sanjosemade',
      displayName: 'San José Made',
      priority: 1,
      enabled: true,
      frequency: 'monthly', // 每月抓一次即可
      url: 'https://www.sanjosemade.com/pages/events',
      extractionType: 'list', // 一次性提取多个活动
      expectedEvents: 4,
      cacheMinutes: 10080 // 缓存7天 (7 * 24 * 60)
    },
    {
      name: '365nightmarket',
      displayName: '365 Night Market',
      priority: 2,
      enabled: true,
      frequency: 'monthly',
      url: 'https://www.365nightmarket.com/events',
      extractionType: 'list',
      expectedEvents: 12,
      cacheMinutes: 10080
    },

    // ---------- 季节性大型活动 ----------
    // 只在特定月份抓取
    {
      name: 'hmbpumpkin',
      displayName: 'Half Moon Bay Pumpkin Festival',
      priority: 1,
      enabled: true,
      frequency: 'seasonal',
      activeMonths: [9, 10], // September-October
      url: 'https://hmbpumpkinfest.com/',
      extractionType: 'single', // 单个活动
      cacheMinutes: 43200 // 缓存30天
    },
    {
      name: 'sfcherryblossom',
      displayName: 'SF Cherry Blossom Festival',
      priority: 1,
      enabled: true,
      frequency: 'seasonal',
      activeMonths: [3, 4], // March-April
      url: 'https://sfcherryblossom.org/',
      extractionType: 'single',
      cacheMinutes: 43200
    },
    {
      name: 'cupertinocherryblossom',
      displayName: 'Cupertino Cherry Blossom Festival',
      priority: 1,
      enabled: true,
      frequency: 'seasonal',
      activeMonths: [3, 4],
      url: 'https://www.cupertinocherryblossomfestival.org/',
      extractionType: 'single',
      cacheMinutes: 43200
    },
    {
      name: 'svpride',
      displayName: 'Silicon Valley Pride',
      priority: 1,
      enabled: true,
      frequency: 'seasonal',
      activeMonths: [5, 6], // May-June
      url: 'https://www.svpride.com/home',
      extractionType: 'single',
      cacheMinutes: 43200
    },
    {
      name: 'sjcincodemayo',
      displayName: 'San Jose Cinco de Mayo',
      priority: 1,
      enabled: true,
      frequency: 'seasonal',
      activeMonths: [4, 5], // April-May
      url: 'https://sjcincodemayo.com/',
      extractionType: 'single',
      cacheMinutes: 43200
    },
    {
      name: 'cinequest',
      displayName: 'Cinequest Film Festival',
      priority: 2,
      enabled: true,
      frequency: 'seasonal',
      activeMonths: [2, 3], // February-March
      url: 'https://www.cinequest.org/',
      extractionType: 'single',
      cacheMinutes: 43200
    },
    {
      name: 'sjobon',
      displayName: 'San Jose Obon Festival',
      priority: 2,
      enabled: true,
      frequency: 'seasonal',
      activeMonths: [7, 8], // July-August
      url: 'https://www.sjbetsuin.org/annual_obon_festival/',
      extractionType: 'single',
      cacheMinutes: 43200
    },
    {
      name: 'morganhill mushroom',
      displayName: 'Morgan Hill Mushroom Mardi Gras',
      priority: 2,
      enabled: true,
      frequency: 'seasonal',
      activeMonths: [5], // May (Memorial Day weekend)
      url: 'https://morganhillmushroomfestival.org/',
      extractionType: 'single',
      cacheMinutes: 43200
    }
  ],

  // ========== 固定时间活动（不需要抓取）==========
  // 这些活动有固定的时间规律，直接生成即可
  recurring_events: [
    {
      name: 'first-fridays',
      displayName: 'First Fridays ArtWalk',
      frequency: 'monthly',
      dayOfWeek: 5, // Friday (0=Sunday, 5=Friday)
      weekOfMonth: 1, // First
      time: '17:00',
      duration: 4, // 4 hours
      location: 'Downtown San Jose SoFA District, 5th Street between Taylor and Jackson',
      description: 'Monthly art walk featuring local galleries, street performers, food trucks, and live music in downtown San Jose\'s SoFA (South First Area) District.',
      price: 'Free',
      url: 'https://sjdowntown.com/first-fridays',
      excludeMonths: [1, 7], // Usually canceled in January and July
      tags: ['art', 'free', 'monthly', 'downtown']
    },
    {
      name: 'berryessa-night-market',
      displayName: 'Berryessa Night Market',
      frequency: 'weekly',
      dayOfWeek: 5, // Friday
      time: '18:00',
      duration: 4,
      startMonth: 4, // April
      endMonth: 10, // October
      location: 'San Jose Flea Market, 1590 Berryessa Road, San Jose, CA 95133',
      description: 'Weekly Friday night market inside the iconic San Jose Flea Market featuring Asian street food, desserts, artisans, and live entertainment.',
      price: 'Free',
      url: 'https://gardenattheflea.com/berryessanightmarket/',
      tags: ['market', 'free', 'weekly', 'food', 'asian']
    }
  ]
};
