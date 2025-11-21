#!/usr/bin/env node
/**
 * 初始化用户反馈数据库表
 * 用于收集用户对活动列表的反馈
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'data', 'events.db');
const db = new Database(dbPath);

console.log('Initializing user feedback database tables...');

try {
  // 创建用户反馈表
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,              -- 用户会话ID（匿名）
      feedback_type TEXT NOT NULL,           -- 'thumbs_up' 或 'thumbs_down'
      comment TEXT,                          -- 用户的文字反馈（可选）
      filter_state TEXT,                     -- JSON格式的过滤器状态
      events_shown INTEGER,                  -- 显示的活动数量
      user_agent TEXT,                       -- 浏览器信息
      referrer TEXT,                         -- 来源页面
      locale TEXT,                           -- 语言（en/zh）
      created_at TEXT NOT NULL,              -- 创建时间
      ip_hash TEXT                           -- IP的哈希值（隐私保护）
    );
  `);

  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_feedback_type
    ON user_feedback(feedback_type);

    CREATE INDEX IF NOT EXISTS idx_feedback_created
    ON user_feedback(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_feedback_session
    ON user_feedback(session_id);
  `);

  // 创建用户偏好表（用于analytics，虽然主要用localStorage）
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,       -- 用户会话ID
      location_preference TEXT,              -- 最常用的location
      type_preference TEXT,                  -- 最常用的event type
      week_preference TEXT,                  -- this_week 或 next_week
      price_preference TEXT,                 -- 价格偏好
      locale TEXT,                           -- 语言偏好
      visit_count INTEGER DEFAULT 1,         -- 访问次数
      last_visit TEXT NOT NULL,              -- 最后访问时间
      created_at TEXT NOT NULL               -- 首次访问时间
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_preferences_session
    ON user_preferences(session_id);
  `);

  console.log('✅ User feedback tables created successfully!');

  // 验证表是否创建成功
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND (name='user_feedback' OR name='user_preferences')
  `).all();

  console.log('Created tables:', tables.map(t => t.name).join(', '));

} catch (error) {
  console.error('❌ Error creating tables:', error);
  process.exit(1);
} finally {
  db.close();
}
