require('dotenv').config();

const config = {
  // API配置
  apis: {
    shortio: {
      key: process.env.SHORTIO_API_KEY,
      baseUrl: 'https://api.short.io/links'
    },
    
    // AI服务配置
    ai: {
      // 当前使用的AI提供商 (openai, gemini, claude)
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
        model: 'gemini-1.5-flash',
        maxTokens: 2048
      },
      
      // Anthropic Claude配置
      claude: {
        key: process.env.CLAUDE_API_KEY,
        model: 'claude-3-haiku-20240307',
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
      priority: 1,
      enabled: true
    },
    {
      name: 'sfstation', 
      baseUrl: 'https://www.sfstation.com/events/',
      searchParams: '',
      priority: 1,
      enabled: true
    },
    {
      name: 'dothebay',
      baseUrl: 'https://dothebay.com/events',
      searchParams: '',
      priority: 1,
      enabled: true
    }
  ],

  // 活动类型优先级
  eventTypePriority: {
    market: 10,
    fair: 10,
    festival: 10,
    food: 7,
    music: 7,
    free: 5,
    default: 3
  },

  // 地理位置配置 - 重点：SF、南湾、半岛
  locations: {
    // 最高优先级区域
    primary: [
      // 旧金山
      'San Francisco', 'SF', 'SOMA', 'Mission', 'Castro', 'Chinatown', 'Union Square',
      // 南湾核心
      'San Jose', 'Santa Clara', 'Sunnyvale', 'Mountain View', 'Palo Alto', 'Cupertino',
      // 半岛核心  
      'Redwood City', 'Menlo Park', 'San Mateo', 'Foster City', 'Belmont'
    ],
    
    // 次要优先级区域
    secondary: [
      // 南湾其他
      'Fremont', 'Milpitas', 'Campbell', 'Los Gatos', 'Saratoga', 'Morgan Hill',
      // 半岛其他
      'Burlingame', 'San Carlos', 'Millbrae', 'Daly City', 'Pacifica',
      // 东湾（较低优先级）
      'Oakland', 'Berkeley', 'Alameda', 'Emeryville'
    ],
    
    // 地区关键词
    keywords: [
      'Bay Area', 'San Francisco Bay Area', 'Silicon Valley', 
      'Peninsula', 'South Bay', 'Mid-Peninsula',
      'South Peninsula', 'North Peninsula'
    ]
  },

  // 内容生成配置
  content: {
    maxTitleLength: 50,
    maxDescriptionLength: 18,
    postTemplate: `🎉 本周湾区精彩活动 {date_range}

{events_list}

📍 更多活动信息请点击链接
🔖 记得提前购票哦！

#湾区生活 #旧金山 #硅谷 #活动推荐 #周末去哪儿`,
    
    eventTemplate: `📅 {title}
🕒 {time}
📍 {location}
💰 {price}
📝 {description}
🔗 {link}
`,
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
    maxEventsPerSource: 50,
    totalCandidatesForReview: 20,
    requestDelay: 1000,
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

module.exports = config;