-- ============================================================================
-- 反馈闭环系统数据库Schema迁移
-- 版本: v1.5 - 多review合并支持
-- 创建时间: 2025-11-04
-- 变更说明: 支持多次爬取合并成一个帖子的场景
-- ============================================================================

-- ============================================================================
-- 迁移1: 扩展 posts 表
-- 新增字段支持记录多个来源 review 文件
-- ============================================================================

-- 添加新字段到 posts 表
ALTER TABLE posts ADD COLUMN source_reviews TEXT;      -- JSON数组，记录来源review文件
ALTER TABLE posts ADD COLUMN is_merged_post INTEGER DEFAULT 0;  -- 是否合并帖子 (0/1)

-- source_reviews 字段格式示例:
-- [
--   {"file": "review_2025-11-03_1000.json", "event_count": 15, "scraped_at": "2025-11-03T10:00:00"},
--   {"file": "review_2025-11-03_1030.json", "event_count": 18, "scraped_at": "2025-11-03T10:30:00"}
-- ]


-- ============================================================================
-- 迁移2: 扩展 event_performance 表
-- 新增字段支持记录活动来源
-- ============================================================================

-- 添加新字段到 event_performance 表
ALTER TABLE event_performance ADD COLUMN source_review TEXT;    -- 来自哪个review文件
ALTER TABLE event_performance ADD COLUMN source_website TEXT;   -- 来源网站 (eventbrite/funcheap/meetup等)

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_perf_source_website ON event_performance(source_website);
CREATE INDEX IF NOT EXISTS idx_perf_source_review ON event_performance(source_review);


-- ============================================================================
-- 更新 schema_version
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES ('1.5.0', datetime('now'), 'Add multi-review merge support');
