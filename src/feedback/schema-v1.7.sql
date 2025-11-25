-- ============================================================================
-- Schema Migration v1.7
-- 用途: 添加posts表的小红书整体互动数据字段
-- 创建时间: 2025-11-25
-- ============================================================================

-- 为posts表添加小红书整体互动数据字段
-- 这些字段存储整个帖子的总互动数据，与单个活动的数据分开

ALTER TABLE posts ADD COLUMN xiaohongshu_total_likes INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN xiaohongshu_total_favorites INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN xiaohongshu_total_comments INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN xiaohongshu_total_shares INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN xiaohongshu_total_views INTEGER DEFAULT 0;

-- 添加反馈收集时间戳
ALTER TABLE posts ADD COLUMN feedback_collected_at TEXT;

-- 记录schema版本
INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES ('1.7.0', datetime('now'), 'Add xiaohongshu post-level engagement fields');
