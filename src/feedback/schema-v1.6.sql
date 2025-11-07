-- ============================================================================
-- 反馈闭环系统数据库Schema迁移
-- 版本: v1.6 - 发布内容追踪支持
-- 创建时间: 2025-11-07
-- 变更说明: 添加字段以追踪生成内容和实际发布内容
-- ============================================================================

-- ============================================================================
-- 迁移1: 扩展 posts 表
-- 新增字段支持记录生成内容和发布内容
-- ============================================================================

-- 添加新字段到 posts 表
ALTER TABLE posts ADD COLUMN generated_content TEXT;      -- AI生成的原始内容
ALTER TABLE posts ADD COLUMN published_content TEXT;      -- 实际发布的内容（可能经过编辑）
ALTER TABLE posts ADD COLUMN content_modified INTEGER DEFAULT 0;  -- 是否被编辑过 (0/1)
ALTER TABLE posts ADD COLUMN manual_events_added INTEGER DEFAULT 0;  -- 发布时手动添加的活动数量

-- ============================================================================
-- 迁移2: 扩展 event_performance 表
-- 新增字段标记发布时手动添加的活动
-- ============================================================================

-- 添加新字段到 event_performance 表
ALTER TABLE event_performance ADD COLUMN manually_added_at_publish INTEGER DEFAULT 0;  -- 是否在发布时手动添加 (0/1)

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_perf_manual_added ON event_performance(manually_added_at_publish);

-- ============================================================================
-- 更新 schema_version
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, applied_at, description)
VALUES ('1.6.0', datetime('now'), 'Add published content tracking support');
