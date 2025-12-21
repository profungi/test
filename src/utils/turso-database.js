/**
 * Turso 数据库适配器 (用于 Scraper)
 * 替代原来的 SQLite database.js
 */

const { createClient } = require('@libsql/client');
require('dotenv').config();

class TursoDatabase {
  constructor() {
    this.client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('✅ Connected to Turso database');
  }

  async connect() {
    // Turso 客户端不需要显式连接
    return Promise.resolve();
  }

  async initTables() {
    // 表结构应该已经在 Turso 中创建好了
    // 如果需要检查，可以运行 SELECT 测试
    try {
      await this.client.execute('SELECT 1 FROM events LIMIT 1');
      console.log('✅ Events table exists');
    } catch (error) {
      console.error('⚠️  Events table may not exist. Please run schema migration.');
      throw error;
    }
  }

  async saveEvent(event) {
    // 先检查是否重复
    const isDup = await this.isDuplicate(event);
    if (isDup) {
      // 重复的活动：更新数据库中的信息，但不进入审核文件
      await this.updateEvent(event);
      return { saved: false, reason: 'duplicate' };
    }

    const sql = `
      INSERT INTO events (
        title, normalized_title, start_time, end_time, location,
        price, description, description_detail, original_url, source,
        event_type, priority, scraped_at, week_identifier, title_zh,
        summary_en, summary_zh
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.client.execute({
        sql,
        args: [
          event.title,
          this.normalizeTitle(event.title),
          event.startTime,
          event.endTime || null,
          event.location,
          event.price || 'Free',
          event.description || '',
          event.description_detail || null,
          event.originalUrl,
          event.source,
          event.eventType || 'other',
          event.priority || 0,
          new Date().toISOString(),
          event.weekIdentifier,
          event.title_zh || null,
          event.summary_en || null,
          event.summary_zh || null
        ]
      });

      return { saved: true };
    } catch (error) {
      console.error('Error saving event to Turso:', error);
      return { saved: false, error: error.message };
    }
  }

  async updateEvent(event) {
    const sql = `
      UPDATE events SET
        title = ?,
        description = ?,
        description_detail = ?,
        end_time = ?,
        event_type = ?,
        priority = ?,
        price = ?,
        scraped_at = ?,
        title_zh = ?,
        summary_en = ?,
        summary_zh = ?
      WHERE normalized_title = ?
        AND location = ?
        AND ABS(julianday(start_time) - julianday(?)) < 1
    `;

    try {
      await this.client.execute({
        sql,
        args: [
          event.title,
          event.description || '',
          event.description_detail || null,
          event.endTime || null,
          event.eventType || 'other',
          event.priority || 0,
          event.price || 'Free',
          new Date().toISOString(),
          event.title_zh || null,
          event.summary_en || null,
          event.summary_zh || null,
          this.normalizeTitle(event.title),
          event.location,
          event.startTime
        ]
      });
    } catch (error) {
      console.error('Error updating event in Turso:', error);
    }
  }

  async isDuplicate(event) {
    const normalizedTitle = this.normalizeTitle(event.title);

    // 策略1: 时间接近 + 地点 + 标题相似
    const sql1 = `
      SELECT title, normalized_title, start_time, location, week_identifier
      FROM events
      WHERE location = ?
      AND ABS(julianday(start_time) - julianday(?)) < ?
    `;

    try {
      const result = await this.client.execute({
        sql: sql1,
        args: [event.location, event.startTime, 1] // 1 天窗口
      });

      // 检查标题相似度
      for (const row of result.rows) {
        const similarity = this.calculateStringSimilarity(
          normalizedTitle,
          row.normalized_title
        );

        if (similarity >= 0.75) {
          console.log(`[DB Dedup - Content] Duplicate found: "${event.title}" matches "${row.title}" in week ${row.week_identifier} (similarity: ${similarity.toFixed(2)})`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return false;
    }
  }

  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '') // 保留中文字符
      .trim();
  }

  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  async getWeekEvents(weekIdentifier) {
    const result = await this.client.execute({
      sql: 'SELECT * FROM events WHERE week_identifier = ? ORDER BY priority DESC, start_time ASC',
      args: [weekIdentifier]
    });
    return result.rows;
  }

  async logScrapingResult(source, eventsFound, success, errorMessage = null) {
    const sql = `
      INSERT INTO scraping_logs (source, scraped_at, events_found, success, error_message)
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      await this.client.execute({
        sql,
        args: [
          source,
          new Date().toISOString(),
          eventsFound,
          success ? 1 : 0,
          errorMessage
        ]
      });
    } catch (error) {
      console.error('Error logging scraping result:', error);
    }
  }

  async close() {
    // Turso 客户端不需要显式关闭
    console.log('✅ Turso connection closed');
    return Promise.resolve();
  }
}

module.exports = TursoDatabase;
