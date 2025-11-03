-- ============================================================================
-- 反馈闭环系统数据库Schema
-- 版本: v1.0
-- 创建时间: 2025-11-01
-- ============================================================================

-- ============================================================================
-- 表1: 发布记录表 (posts)
-- 用途: 记录每次小红书发布的基本信息
-- ============================================================================

CREATE TABLE IF NOT EXISTS posts (
  -- 主键
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 发布标识
  post_id TEXT UNIQUE NOT NULL,           -- 如: post_2025-11-04_1530

  -- 时间信息
  published_at TEXT NOT NULL,             -- ISO 8601格式
  week_identifier TEXT NOT NULL,          -- 如: 2025-11-04_to_2025-11-10

  -- 发布配置
  platform TEXT DEFAULT 'xiaohongshu',    -- 发布平台
  total_events INTEGER NOT NULL,          -- 包含的活动数量

  -- 关联信息
  review_file_path TEXT,                  -- 审核文件路径
  output_file_path TEXT,                  -- 生成的发布文件路径
  cover_image_path TEXT,                  -- 封面图片路径

  -- 外部链接 (可选)
  xiaohongshu_url TEXT,                   -- 小红书帖子链接
  xiaohongshu_post_id TEXT,               -- 小红书帖子ID

  -- 元数据
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- 发布记录表索引
CREATE INDEX IF NOT EXISTS idx_posts_week ON posts(week_identifier);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);
CREATE INDEX IF NOT EXISTS idx_posts_post_id ON posts(post_id);


-- ============================================================================
-- 表2: 活动表现记录表 (event_performance)
-- 用途: 记录每个活动的表现数据和反馈指标
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_performance (
  -- 主键
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 关联关系
  post_id TEXT NOT NULL,                  -- 关联 posts 表
  event_id INTEGER,                       -- 关联 events 表 (可为空)

  -- 活动基本信息 (冗余存储，便于查询)
  event_title TEXT NOT NULL,
  event_type TEXT,                        -- market/festival/food/music/art/tech/free
  event_url TEXT,
  location TEXT,
  location_category TEXT,                 -- sanfrancisco/southbay/peninsula/eastbay/northbay
  price TEXT,                             -- 原始价格字符串
  price_category TEXT,                    -- free/paid/expensive
  start_time TEXT,                        -- ISO 8601

  -- 活动特征 (用于分析)
  is_weekend INTEGER DEFAULT 0,           -- 是否周末 (0/1)
  is_free INTEGER DEFAULT 0,              -- 是否免费 (0/1)
  is_outdoor INTEGER DEFAULT 0,           -- 是否户外 (0/1)
  is_chinese_relevant INTEGER DEFAULT 0,  -- 是否中文相关 (0/1)

  -- 反馈指标 (核心数据)
  shortio_clicks INTEGER DEFAULT 0,       -- Short.io 点击次数 ⭐ 最重要
  xiaohongshu_likes INTEGER DEFAULT 0,    -- 小红书点赞数
  xiaohongshu_favorites INTEGER DEFAULT 0,-- 小红书收藏数
  xiaohongshu_comments INTEGER DEFAULT 0, -- 小红书评论数
  xiaohongshu_shares INTEGER DEFAULT 0,   -- 小红书分享数

  -- 计算字段
  engagement_score REAL DEFAULT 0,        -- 综合参与度分数 (自动计算)
  normalized_score REAL DEFAULT 0,        -- 归一化分数 (0-1)

  -- 元数据
  feedback_collected_at TEXT,             -- 反馈收集时间
  feedback_updated_at TEXT,               -- 最后更新时间
  data_source TEXT DEFAULT 'manual',      -- manual/api/hybrid

  -- 外键约束
  FOREIGN KEY (post_id) REFERENCES posts(post_id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- 活动表现表索引
CREATE INDEX IF NOT EXISTS idx_perf_post ON event_performance(post_id);
CREATE INDEX IF NOT EXISTS idx_perf_type ON event_performance(event_type);
CREATE INDEX IF NOT EXISTS idx_perf_location ON event_performance(location_category);
CREATE INDEX IF NOT EXISTS idx_perf_score ON event_performance(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_perf_post_type ON event_performance(post_id, event_type);
CREATE INDEX IF NOT EXISTS idx_perf_composite ON event_performance(
  event_type,
  location_category,
  price_category,
  engagement_score
);


-- ============================================================================
-- 表3: 权重调整历史表 (weight_adjustments)
-- 用途: 记录每次权重调整的详细信息，用于审计和回滚
-- ============================================================================

CREATE TABLE IF NOT EXISTS weight_adjustments (
  -- 主键
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 调整信息
  adjustment_id TEXT UNIQUE NOT NULL,     -- 如: adj_2025-11-11_1200
  adjusted_at TEXT NOT NULL,              -- 调整时间
  adjustment_reason TEXT,                 -- 调整原因
  adjustment_type TEXT,                   -- auto/manual/hybrid

  -- 数据基础
  based_on_posts INTEGER,                 -- 基于多少次发布
  based_on_events INTEGER,                -- 基于多少个活动
  analysis_period_start TEXT,             -- 分析起始时间
  analysis_period_end TEXT,               -- 分析结束时间

  -- 整体统计
  avg_engagement_score REAL,              -- 平均参与度分数
  total_clicks INTEGER,                   -- 总点击数
  total_engagement INTEGER,               -- 总互动数

  -- 调整详情 (JSON格式存储)
  adjustments_json TEXT NOT NULL,         -- 详细调整内容

  -- 调整前后配置快照
  config_before TEXT,                     -- 调整前的完整配置 (JSON)
  config_after TEXT,                      -- 调整后的完整配置 (JSON)

  -- 审批信息
  requires_approval INTEGER DEFAULT 1,    -- 是否需要人工审批 (0/1)
  approved_by TEXT,                       -- 审批人 (manual/auto)
  approved_at TEXT,                       -- 审批时间
  is_applied INTEGER DEFAULT 0,           -- 是否已应用 (0/1)

  -- 效果追踪
  effectiveness_score REAL,               -- 调整后的效果评分 (延迟更新)

  -- 元数据
  created_at TEXT NOT NULL,
  notes TEXT                              -- 备注
);

-- 权重调整历史表索引
CREATE INDEX IF NOT EXISTS idx_adj_date ON weight_adjustments(adjusted_at);
CREATE INDEX IF NOT EXISTS idx_adj_applied ON weight_adjustments(is_applied);
CREATE INDEX IF NOT EXISTS idx_adj_id ON weight_adjustments(adjustment_id);


-- ============================================================================
-- 视图: 活动表现汇总视图
-- 用途: 方便查询和分析
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_event_performance_summary AS
SELECT
  p.post_id,
  p.published_at,
  p.week_identifier,
  ep.event_type,
  ep.location_category,
  ep.price_category,
  COUNT(*) as event_count,
  AVG(ep.engagement_score) as avg_engagement,
  SUM(ep.shortio_clicks) as total_clicks,
  SUM(ep.xiaohongshu_likes) as total_likes,
  SUM(ep.xiaohongshu_favorites) as total_favorites,
  SUM(ep.xiaohongshu_comments) as total_comments,
  SUM(ep.xiaohongshu_shares) as total_shares
FROM event_performance ep
JOIN posts p ON ep.post_id = p.post_id
GROUP BY p.post_id, ep.event_type, ep.location_category, ep.price_category;


-- ============================================================================
-- 视图: 类型表现排名视图
-- 用途: 快速查看各类型活动的表现排名
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_type_performance_ranking AS
SELECT
  event_type,
  COUNT(*) as total_events,
  AVG(engagement_score) as avg_engagement,
  MIN(engagement_score) as min_engagement,
  MAX(engagement_score) as max_engagement,
  SUM(shortio_clicks) as total_clicks,
  SUM(xiaohongshu_likes) as total_likes,
  SUM(xiaohongshu_favorites) as total_favorites,
  SUM(xiaohongshu_comments) as total_comments
FROM event_performance
WHERE engagement_score > 0  -- 只统计有反馈的活动
GROUP BY event_type
ORDER BY avg_engagement DESC;


-- ============================================================================
-- 初始化完成标记
-- ============================================================================

-- 记录Schema版本
CREATE TABLE IF NOT EXISTS schema_version (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  description TEXT
);

INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES ('1.0.0', datetime('now'), 'Initial feedback loop schema');
