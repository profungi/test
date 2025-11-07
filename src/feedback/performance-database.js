/**
 * 性能数据库管理模块
 * 负责管理反馈闭环系统的数据库操作
 *
 * 主要功能:
 * - 发布记录管理 (posts)
 * - 活动表现记录管理 (event_performance)
 * - 权重调整历史管理 (weight_adjustments)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

class PerformanceDatabase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || config.database.path;
    this.db = null;
  }

  /**
   * 连接数据库
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('📊 连接到性能数据库');
          resolve();
        }
      });
    });
  }

  /**
   * 初始化反馈系统表结构
   */
  async initializeFeedbackTables() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // 移除注释行
    const cleanedSql = schemaSql
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      })
      .join('\n');

    // 分割SQL语句并逐个执行
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await this.run(statement);
      } catch (err) {
        // 忽略 "already exists" 错误
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }

    console.log('✅ 反馈系统表结构初始化完成');

    // 运行迁移到 v1.5
    await this.migrateToV15();

    // 运行迁移到 v1.6
    await this.migrateToV16();
  }

  /**
   * 迁移到 v1.5 - 添加多review合并支持
   */
  async migrateToV15() {
    try {
      // 检查是否已经迁移过
      const version = await this.get(
        "SELECT * FROM schema_version WHERE version = '1.5.0'"
      );

      if (version) {
        // console.log('✅ Schema v1.5 已应用');
        return;
      }

      console.log('🔄 开始迁移到 Schema v1.5...');

      const schemaPath = path.join(__dirname, 'schema-v1.5.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      // 移除注释行
      const cleanedSql = schemaSql
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        })
        .join('\n');

      // 分割SQL语句并逐个执行
      const statements = cleanedSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await this.run(statement);
        } catch (err) {
          // 忽略 "already exists" 或 "duplicate column" 错误
          if (!err.message.includes('already exists') &&
              !err.message.includes('duplicate column')) {
            throw err;
          }
        }
      }

      console.log('✅ Schema v1.5 迁移完成');
    } catch (err) {
      console.warn('⚠️  Schema v1.5 迁移警告:', err.message);
      // 不抛出错误，允许继续使用
    }
  }

  /**
   * 迁移到 v1.6 - 添加发布内容追踪支持
   */
  async migrateToV16() {
    try {
      // 检查是否已经迁移过
      const version = await this.get(
        "SELECT * FROM schema_version WHERE version = '1.6.0'"
      );

      if (version) {
        // console.log('✅ Schema v1.6 已应用');
        return;
      }

      console.log('🔄 开始迁移到 Schema v1.6...');

      const schemaPath = path.join(__dirname, 'schema-v1.6.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      // 移除注释行
      const cleanedSql = schemaSql
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        })
        .join('\n');

      // 分割SQL语句并逐个执行
      const statements = cleanedSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await this.run(statement);
        } catch (err) {
          // 忽略 "already exists" 或 "duplicate column" 错误
          if (!err.message.includes('already exists') &&
              !err.message.includes('duplicate column')) {
            throw err;
          }
        }
      }

      console.log('✅ Schema v1.6 迁移完成');
    } catch (err) {
      console.warn('⚠️  Schema v1.6 迁移警告:', err.message);
      // 不抛出错误，允许继续使用
    }
  }

  /**
   * 执行SQL语句 (通用方法)
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  /**
   * 查询单条记录
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * 查询多条记录
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // ============================================================================
  // 发布记录管理 (posts)
  // ============================================================================

  /**
   * 创建发布记录
   * @param {Object} postData - 发布数据
   * @returns {Promise<string>} - post_id
   */
  async createPost(postData) {
    const {
      post_id,
      published_at,
      week_identifier,
      platform = 'xiaohongshu',
      total_events,
      review_file_path,
      output_file_path,
      cover_image_path,
      xiaohongshu_url = null,
      xiaohongshu_post_id = null,
      source_reviews = null,  // v1.5: 新增字段
      is_merged_post = 0,     // v1.5: 新增字段
      generated_content = null,  // v1.6: 生成的原始内容
      published_content = null,  // v1.6: 实际发布的内容
      content_modified = 0,      // v1.6: 是否被编辑过
      manual_events_added = 0    // v1.6: 手动添加的活动数量
    } = postData;

    const sql = `
      INSERT INTO posts (
        post_id, published_at, week_identifier, platform, total_events,
        review_file_path, output_file_path, cover_image_path,
        xiaohongshu_url, xiaohongshu_post_id,
        source_reviews, is_merged_post,
        generated_content, published_content, content_modified, manual_events_added,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      post_id,
      published_at,
      week_identifier,
      platform,
      total_events,
      review_file_path,
      output_file_path,
      cover_image_path,
      xiaohongshu_url,
      xiaohongshu_post_id,
      source_reviews ? JSON.stringify(source_reviews) : null,
      is_merged_post ? 1 : 0,
      generated_content,
      published_content,
      content_modified ? 1 : 0,
      manual_events_added,
      new Date().toISOString()
    ];

    await this.run(sql, params);
    return post_id;
  }

  /**
   * 获取发布记录
   */
  async getPost(postId) {
    const sql = 'SELECT * FROM posts WHERE post_id = ?';
    return await this.get(sql, [postId]);
  }

  /**
   * 获取最近N次发布
   */
  async getRecentPosts(limit = 10) {
    const sql = `
      SELECT * FROM posts
      ORDER BY published_at DESC
      LIMIT ?
    `;
    return await this.all(sql, [limit]);
  }

  /**
   * 获取没有反馈数据的发布
   */
  async getPostsWithoutFeedback() {
    const sql = `
      SELECT p.* FROM posts p
      WHERE NOT EXISTS (
        SELECT 1 FROM event_performance ep
        WHERE ep.post_id = p.post_id
        AND ep.engagement_score > 0
      )
      ORDER BY p.published_at DESC
    `;
    return await this.all(sql);
  }

  /**
   * 更新发布记录
   */
  async updatePost(postId, updates) {
    const allowedFields = ['xiaohongshu_url', 'xiaohongshu_post_id', 'updated_at'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return;
    }

    values.push(postId);

    const sql = `
      UPDATE posts
      SET ${fields.join(', ')}, updated_at = ?
      WHERE post_id = ?
    `;
    values.splice(values.length - 1, 0, new Date().toISOString());

    await this.run(sql, values);
  }

  // ============================================================================
  // 活动表现记录管理 (event_performance)
  // ============================================================================

  /**
   * 创建活动表现记录
   * @param {Object} eventData - 活动数据
   * @returns {Promise<number>} - 记录ID
   */
  async createEventPerformance(eventData) {
    const {
      post_id,
      event_id = null,
      event_title,
      event_type,
      event_url,
      location,
      location_category,
      price,
      price_category,
      start_time,
      is_weekend = 0,
      is_free = 0,
      is_outdoor = 0,
      is_chinese_relevant = 0,
      engagement_score = 0,
      source_review = null,   // v1.5: 新增字段
      source_website = null,  // v1.5: 新增字段
      manually_added_at_publish = 0  // v1.6: 发布时手动添加
    } = eventData;

    const sql = `
      INSERT INTO event_performance (
        post_id, event_id, event_title, event_type, event_url,
        location, location_category, price, price_category, start_time,
        is_weekend, is_free, is_outdoor, is_chinese_relevant,
        engagement_score,
        source_review, source_website, manually_added_at_publish
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      post_id,
      event_id,
      event_title,
      event_type,
      event_url,
      location,
      location_category,
      price,
      price_category,
      start_time,
      is_weekend ? 1 : 0,
      is_free ? 1 : 0,
      is_outdoor ? 1 : 0,
      is_chinese_relevant ? 1 : 0,
      engagement_score,
      source_review,
      source_website,
      manually_added_at_publish ? 1 : 0
    ];

    const result = await this.run(sql, params);
    return result.lastID;
  }

  /**
   * 更新活动反馈数据
   */
  async updateEventPerformance(eventPerfId, feedbackData) {
    const {
      shortio_clicks = 0,
      xiaohongshu_likes = 0,
      xiaohongshu_favorites = 0,
      xiaohongshu_comments = 0,
      xiaohongshu_shares = 0,
      data_source = 'manual'
    } = feedbackData;

    // 计算 engagement score
    const engagement_score = this.calculateEngagementScore({
      shortio_clicks,
      xiaohongshu_likes,
      xiaohongshu_favorites,
      xiaohongshu_comments,
      xiaohongshu_shares
    });

    const now = new Date().toISOString();

    const sql = `
      UPDATE event_performance
      SET
        shortio_clicks = ?,
        xiaohongshu_likes = ?,
        xiaohongshu_favorites = ?,
        xiaohongshu_comments = ?,
        xiaohongshu_shares = ?,
        engagement_score = ?,
        data_source = ?,
        feedback_collected_at = COALESCE(feedback_collected_at, ?),
        feedback_updated_at = ?
      WHERE id = ?
    `;

    const params = [
      shortio_clicks,
      xiaohongshu_likes,
      xiaohongshu_favorites,
      xiaohongshu_comments,
      xiaohongshu_shares,
      engagement_score,
      data_source,
      now,
      now,
      eventPerfId
    ];

    await this.run(sql, params);
    return engagement_score;
  }

  /**
   * 计算 Engagement Score
   * 公式: clicks * 5.0 + comments * 3.0 + likes * 2.0 + favorites * 2.0 + shares * 4.0
   */
  calculateEngagementScore(metrics) {
    const WEIGHTS = {
      CLICK: 5.0,       // Short.io 点击 - 最高权重
      COMMENT: 3.0,     // 评论 - 高质量互动
      LIKE: 2.0,        // 点赞 - 轻度认可
      FAVORITE: 2.0,    // 收藏 - 轻度认可
      SHARE: 4.0        // 分享 - 强传播力
    };

    const {
      shortio_clicks = 0,
      xiaohongshu_comments = 0,
      xiaohongshu_likes = 0,
      xiaohongshu_favorites = 0,
      xiaohongshu_shares = 0
    } = metrics;

    const score =
      shortio_clicks * WEIGHTS.CLICK +
      xiaohongshu_comments * WEIGHTS.COMMENT +
      xiaohongshu_likes * WEIGHTS.LIKE +
      xiaohongshu_favorites * WEIGHTS.FAVORITE +
      xiaohongshu_shares * WEIGHTS.SHARE;

    return Math.round(score * 10) / 10; // 保留1位小数
  }

  /**
   * 获取某次发布的所有活动表现
   */
  async getEventsByPost(postId) {
    const sql = `
      SELECT * FROM event_performance
      WHERE post_id = ?
      ORDER BY engagement_score DESC
    `;
    return await this.all(sql, [postId]);
  }

  /**
   * 获取有反馈数据的活动 (用于分析)
   */
  async getEventsWithFeedback(limit = null) {
    let sql = `
      SELECT * FROM event_performance
      WHERE engagement_score > 0
      ORDER BY feedback_updated_at DESC
    `;

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    return await this.all(sql);
  }

  /**
   * 按类型统计活动表现
   */
  async getPerformanceByType() {
    const sql = `
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
      WHERE engagement_score > 0
      GROUP BY event_type
      ORDER BY avg_engagement DESC
    `;
    return await this.all(sql);
  }

  /**
   * 按地理位置统计活动表现
   */
  async getPerformanceByLocation() {
    const sql = `
      SELECT
        location_category,
        COUNT(*) as total_events,
        AVG(engagement_score) as avg_engagement,
        SUM(shortio_clicks) as total_clicks
      FROM event_performance
      WHERE engagement_score > 0 AND location_category IS NOT NULL
      GROUP BY location_category
      ORDER BY avg_engagement DESC
    `;
    return await this.all(sql);
  }

  /**
   * 按价格统计活动表现
   */
  async getPerformanceByPrice() {
    const sql = `
      SELECT
        price_category,
        COUNT(*) as total_events,
        AVG(engagement_score) as avg_engagement,
        SUM(shortio_clicks) as total_clicks
      FROM event_performance
      WHERE engagement_score > 0 AND price_category IS NOT NULL
      GROUP BY price_category
      ORDER BY avg_engagement DESC
    `;
    return await this.all(sql);
  }

  // ============================================================================
  // 权重调整历史管理 (weight_adjustments)
  // ============================================================================

  /**
   * 保存权重调整记录
   */
  async saveWeightAdjustment(adjustmentData) {
    const {
      adjustment_id,
      adjusted_at,
      adjustment_reason,
      adjustment_type = 'manual',
      based_on_posts,
      based_on_events,
      analysis_period_start,
      analysis_period_end,
      avg_engagement_score,
      total_clicks,
      total_engagement,
      adjustments_json,
      config_before,
      config_after,
      requires_approval = true,
      approved_by = null,
      approved_at = null,
      is_applied = false,
      notes = null
    } = adjustmentData;

    const sql = `
      INSERT INTO weight_adjustments (
        adjustment_id, adjusted_at, adjustment_reason, adjustment_type,
        based_on_posts, based_on_events, analysis_period_start, analysis_period_end,
        avg_engagement_score, total_clicks, total_engagement,
        adjustments_json, config_before, config_after,
        requires_approval, approved_by, approved_at, is_applied,
        created_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      adjustment_id,
      adjusted_at,
      adjustment_reason,
      adjustment_type,
      based_on_posts,
      based_on_events,
      analysis_period_start,
      analysis_period_end,
      avg_engagement_score,
      total_clicks,
      total_engagement,
      JSON.stringify(adjustments_json),
      JSON.stringify(config_before),
      JSON.stringify(config_after),
      requires_approval ? 1 : 0,
      approved_by,
      approved_at,
      is_applied ? 1 : 0,
      new Date().toISOString(),
      notes
    ];

    await this.run(sql, params);
    return adjustment_id;
  }

  /**
   * 获取权重调整记录
   */
  async getWeightAdjustment(adjustmentId) {
    const sql = 'SELECT * FROM weight_adjustments WHERE adjustment_id = ?';
    const row = await this.get(sql, [adjustmentId]);

    if (row) {
      // 解析JSON字段
      row.adjustments_json = JSON.parse(row.adjustments_json);
      row.config_before = JSON.parse(row.config_before);
      row.config_after = JSON.parse(row.config_after);
    }

    return row;
  }

  /**
   * 获取权重调整历史
   */
  async getWeightAdjustmentHistory(limit = 10) {
    const sql = `
      SELECT * FROM weight_adjustments
      ORDER BY adjusted_at DESC
      LIMIT ?
    `;
    const rows = await this.all(sql, [limit]);

    // 解析JSON字段
    return rows.map(row => ({
      ...row,
      adjustments_json: JSON.parse(row.adjustments_json),
      config_before: JSON.parse(row.config_before),
      config_after: JSON.parse(row.config_after)
    }));
  }

  /**
   * 标记权重调整为已应用
   */
  async markAdjustmentAsApplied(adjustmentId) {
    const sql = `
      UPDATE weight_adjustments
      SET is_applied = 1, approved_at = ?
      WHERE adjustment_id = ?
    `;
    await this.run(sql, [new Date().toISOString(), adjustmentId]);
  }

  // ============================================================================
  // 分析查询
  // ============================================================================

  /**
   * 获取整体统计数据
   */
  async getOverallStats(recentPosts = null) {
    let whereClauses = ['ep.engagement_score > 0'];
    let params = [];

    if (recentPosts) {
      const postIds = recentPosts.map(p => p.post_id);
      whereClauses.push(`ep.post_id IN (${postIds.map(() => '?').join(', ')})`);
      params = postIds;
    }

    const sql = `
      SELECT
        COUNT(DISTINCT ep.post_id) as total_posts,
        COUNT(*) as total_events,
        AVG(ep.engagement_score) as avg_engagement,
        SUM(ep.shortio_clicks) as total_clicks,
        SUM(ep.xiaohongshu_likes) as total_likes,
        SUM(ep.xiaohongshu_favorites) as total_favorites,
        SUM(ep.xiaohongshu_comments) as total_comments,
        SUM(ep.xiaohongshu_shares) as total_shares,
        MIN(p.published_at) as period_start,
        MAX(p.published_at) as period_end
      FROM event_performance ep
      JOIN posts p ON ep.post_id = p.post_id
      WHERE ${whereClauses.join(' AND ')}
    `;

    return await this.get(sql, params);
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('📊 数据库连接已关闭');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = PerformanceDatabase;
