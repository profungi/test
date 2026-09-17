require('dotenv').config();

const config = {
  // API配置
  apis: {
    shortio: {
      key: process.env.SHORTIO_API_KEY,
      baseUrl: 'https://api.short.io/links',
      domain: process.env.SHORTIO_DOMAIN || 'short.io'
    },
    
    // AI服务配置
    ai: {
      // 当前使用的AI提供商 (openai, gemini, claude, mistral)
      provider: process.env.AI_PROVIDER || 'openai',

      // OpenAI配置
      openai: {
        key: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
        maxTokens: 2000
      },

      // Google Gemini配置
      gemini: {
        key: process.env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash',
        maxTokens: 2048
      },

      // Anthropic Claude配置
      claude: {
        key: process.env.CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
        maxTokens: 2000
      },

      // Mistral AI配置
      mistral: {
        key: process.env.MISTRAL_API_KEY,
        model: 'mistral-small-latest',
        maxTokens: 2000
      }
    }
  },

  // 事件源配置，按优先级排序
  eventSources: [
    {
      name: 'eventbrite',
      baseUrl: 'https://www.eventbrite.com/d/ca--san-francisco/events/',
      searchParams: '?page=1&start_date_keyword=next_week',
      // 额外搜索关键词，用于抓取特定类型活动
      additionalSearches: [
        'festival',
        'fair',
        'market',
        'farmers-market',
        'street-fair',
        'free-events'
      ],
      // 湾区其他城市的搜索URL
      additionalCities: [
        // 东湾
        { name: 'Oakland', url: 'https://www.eventbrite.com/d/ca--oakland/events/', maxEvents: 5 },
        { name: 'Berkeley', url: 'https://www.eventbrite.com/d/ca--berkeley/events/', maxEvents: 5 },

        // 南湾主要城市
        { name: 'San Jose', url: 'https://www.eventbrite.com/d/ca--san-jose/events/', maxEvents: 8 },
        { name: 'Sunnyvale', url: 'https://www.eventbrite.com/d/ca--sunnyvale/events/', maxEvents: 5 },
        { name: 'Santa Clara', url: 'https://www.eventbrite.com/d/ca--santa-clara/events/', maxEvents: 5 },
        { name: 'Cupertino', url: 'https://www.eventbrite.com/d/ca--cupertino/events/', maxEvents: 5 },

        // 南湾小城市（精品活动多）
        { name: 'Saratoga', url: 'https://www.eventbrite.com/d/ca--saratoga/events/', maxEvents: 5 },
        { name: 'Los Gatos', url: 'https://www.eventbrite.com/d/ca--los-gatos/events/', maxEvents: 5 },
        { name: 'Campbell', url: 'https://www.eventbrite.com/d/ca--campbell/events/', maxEvents: 5 },
        { name: 'Los Altos', url: 'https://www.eventbrite.com/d/ca--los-altos/events/', maxEvents: 5 },

        // 半岛主要城市
        { name: 'Palo Alto', url: 'https://www.eventbrite.com/d/ca--palo-alto/events/', maxEvents: 8 },
        { name: 'Mountain View', url: 'https://www.eventbrite.com/d/ca--mountain-view/events/', maxEvents: 5 },
        { name: 'Redwood City', url: 'https://www.eventbrite.com/d/ca--redwood-city/events/', maxEvents: 5 },
        { name: 'San Mateo', url: 'https://www.eventbrite.com/d/ca--san-mateo/events/', maxEvents: 5 },
        { name: 'Menlo Park', url: 'https://www.eventbrite.com/d/ca--menlo-park/events/', maxEvents: 5 }
      ],
      // 类型定向搜索配置（第二层抓取）
      categorySearches: [
        {
          name: 'food-and-drink',
          displayName: 'Food & Drink',
          maxPerCity: 8,
          enabled: true
        },
        {
          name: 'festivals-fairs',
          displayName: 'Festivals & Fairs',
          maxPerCity: 8,
          enabled: true
        },
        {
          name: 'holiday',
          displayName: 'Holiday Events',
          maxPerCity: 8,
          enabled: true
        }
      ],
      priority: 1,
      enabled: true
    },
    {
      name: 'sfstation',
      baseUrl: 'https://www.sfstation.com/calendar',
      searchParams: '',
      priority: 1,
      enabled: true
    },
    {
      name: 'funcheap',
      baseUrl: 'https://sf.funcheap.com',
      searchParams: '',
      priority: 1,
      enabled: true
    }
  ],

  // 活动类型优先级
  eventTypePriority: {
    market: 10,      // 市集类活动最高优先级
    fair: 10,        // 集市/展会
    festival: 10,    // 节日庆典
    free: 9,         // 免费活动优先级提高到9
    food: 6,         // 美食活动
    music: 4,        // 音乐活动优先级降低到4
    art: 5,          // 艺术活动
    tech: 5,         // 科技活动
    default: 3
  },

  // 地理位置配置 - 明确区分各个区域
  locations: {
    // 旧金山 (San Francisco)
    sanfrancisco: [
      'San Francisco', 'SF', 'SOMA', 'Mission', 'Castro', 'Chinatown', 'Union Square',
      'Financial District', 'North Beach', 'Haight', 'Richmond', 'Sunset', 'Noe Valley',
      'Pacific Heights', 'Marina District', 'Presidio', 'Fisherman\'s Wharf', 'Embarcadero'
    ],

    // 南湾 (South Bay) - San Jose及以南，包括Santa Clara县南部
    southbay: [
      'San Jose', 'Santa Clara', 'Sunnyvale', 'Milpitas', 'Campbell', 'Los Gatos',
      'Saratoga', 'Morgan Hill', 'Gilroy', 'Cupertino', 'Los Altos'
    ],

    // 半岛 (Peninsula) - SF以南到Palo Alto，沿着280和101
    peninsula: [
      'Palo Alto', 'Menlo Park', 'Redwood City', 'San Mateo', 'Burlingame',
      'Millbrae', 'San Bruno', 'South San Francisco', 'Daly City', 'Pacifica',
      'Foster City', 'Belmont', 'San Carlos', 'Atherton', 'Woodside', 'Portola Valley',
      'Half Moon Bay', 'Mountain View'
    ],

    // 东湾 (East Bay) - 海湾东侧
    eastbay: [
      'Oakland', 'Berkeley', 'Alameda', 'Emeryville', 'Richmond', 'Albany',
      'Piedmont', 'San Leandro', 'Hayward', 'Fremont', 'Union City', 'Newark',
      'Pleasanton', 'Livermore', 'Dublin', 'Walnut Creek', 'Concord', 'Pleasant Hill'
    ],

    // 北湾 (North Bay) - 金门大桥以北
    northbay: [
      'Marin', 'San Rafael', 'Sausalito', 'Mill Valley', 'Novato', 'Tiburon',
      'Corte Madera', 'Larkspur', 'San Anselmo', 'Fairfax',
      'Napa', 'Sonoma', 'Petaluma', 'Santa Rosa', 'Vallejo'
    ],

    // 通用关键词
    keywords: [
      'Bay Area', 'San Francisco Bay Area', 'Silicon Valley',
      'Peninsula', 'South Bay', 'East Bay', 'North Bay',
      'Mid-Peninsula', 'South Peninsula', 'North Peninsula'
    ],

    // 为了兼容旧代码，保留primary和secondary
    primary: [
      'San Francisco', 'SF', 'San Jose', 'Santa Clara', 'Sunnyvale', 'Mountain View',
      'Palo Alto', 'Cupertino', 'Redwood City', 'Menlo Park', 'San Mateo', 'Oakland', 'Berkeley'
    ],

    secondary: [
      'Fremont', 'Milpitas', 'Campbell', 'Los Gatos', 'Saratoga', 'Morgan Hill',
      'Burlingame', 'San Carlos', 'Millbrae', 'Daly City', 'Pacifica',
      'Alameda', 'Emeryville', 'Hayward', 'San Rafael', 'Sausalito'
    ]
  },

  // 内容生成配置
  content: {
    maxTitleLength: 50,
    maxDescriptionLength: 80,  // 从18字增加到80字，提供更丰富的活动描述
    postTemplate: `🎉 本周湾区精彩活动 {date_range}

{events_list}`,

    eventTemplate: `{title}
🕒 {time}
📍 {location}
💰 {price}
✨ {description}
🔗 {link}
`,
  },

  // 英文平台配置
  englishPlatforms: {
    reddit: {
      headerTemplate: `# 🎉 Bay Area Events This Week ({date_range})

Compiled a list of local events for the week. Hope you find something fun!

---
`,
      eventTemplate: `**{emoji} {title}**
🕒 {time}
📍 {location}
💰 {price}
✨ {description}
🔗 {link}

`,
      footerTemplate: `---
*Sources: Eventbrite, SFStation, Funcheap. Events listed for informational purposes.*`,
      groupByCategory: true
    },
    nextdoor: {
      headerTemplate: `This Week's Local Events ({date_range}) 🌟

Hi neighbors! I put together a list of events happening around the Bay Area this week. Thought some of you might be interested:
`,
      eventTemplate: `{emoji} {day_date} | {title}
🕒 {time}
📍 {location} | {price}
{description}
→ {link}
`,
      footerTemplate: `
Let me know if you're planning to check any of these out! 😊`,
      groupByCategory: false
    }
  },

  // 去重配置
  deduplication: {
    titleSimilarityThreshold: 0.8,
    timeWindowHours: 2
  },

  // 数据库配置
  database: {
    path: './data/events.db'
  },

  // 输出配置
  output: {
    directory: './output',
    reviewFilename: 'review_{date}.json',
    finalFilename: 'weekly_events_{date}.txt'
  },

  // 抓取限制
  scraping: {
    maxEventsPerSource: 100,  // 增加到100以支持多城市抓取
    totalCandidatesForReview: 40,  // 增加到40以包含更多城市的活动
    requestDelay: 1000,
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

module.exports = config;