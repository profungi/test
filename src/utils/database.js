const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

class EventDatabase {
  constructor() {
    this.dbPath = config.database.path;
    this.ensureDirectoryExists();
    this.db = null;
  }

  ensureDirectoryExists() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.initTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async initTables() {
    return new Promise((resolve, reject) => {
      const createEventsTable = `
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          normalized_title TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT,
          location TEXT NOT NULL,
          price TEXT,
          description TEXT,
          description_detail TEXT,
          original_url TEXT NOT NULL,
          short_url TEXT,
          source TEXT NOT NULL,
          event_type TEXT,
          priority INTEGER DEFAULT 0,
          scraped_at TEXT NOT NULL,
          week_identifier TEXT NOT NULL,
          is_processed BOOLEAN DEFAULT 0,
          UNIQUE(normalized_title, start_time, location)
        )
      `;

      const createScrapingLogsTable = `
        CREATE TABLE IF NOT EXISTS scraping_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          scraped_at TEXT NOT NULL,
          events_found INTEGER,
          success BOOLEAN,
          error_message TEXT
        )
      `;

      this.db.run(createEventsTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(createScrapingLogsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }

          // 创建索引以优化查询性能
          this.createIndexes().then(() => {
            // 迁移：为现有表添加 description_detail 列（如果不存在）
            this.migrateAddDescriptionDetail().then(resolve).catch(reject);
          }).catch(reject);
        });
      });
    });
  }

  async createIndexes() {
    const indexQueries = [
      // 主要去重查询的复合索引
      `CREATE INDEX IF NOT EXISTS idx_events_dedup
       ON events(week_identifier, location, date(start_time))`,

      // 加速 week_identifier 查询
      `CREATE INDEX IF NOT EXISTS idx_events_week
       ON events(week_identifier)`,

      // 加速 location 查询
      `CREATE INDEX IF NOT EXISTS idx_events_location
       ON events(location)`,

      // 加速标题查询（用于相似度匹配）
      `CREATE INDEX IF NOT EXISTS idx_events_normalized_title
       ON events(normalized_title)`,

      // 加速来源查询
      `CREATE INDEX IF NOT EXISTS idx_events_source
       ON events(source)`
    ];

    return new Promise((resolve, reject) => {
      let completed = 0;
      let errors = [];

      if (indexQueries.length === 0) {
        resolve();
        return;
      }

      indexQueries.forEach((query, index) => {
        this.db.run(query, (err) => {
          if (err) {
            // "index already exists" 错误是可以接受的，其他错误需要报告
            if (!err.message.includes('already exists')) {
              errors.push({ query, error: err.message });
            } else {
              console.log(`  ℹ️  ${query.split('\n')[0].substring(0, 40)}... (already exists)`);
            }
          }
          completed++;
          if (completed === indexQueries.length) {
            if (errors.length > 0) {
              console.warn(`⚠️  Some indexes could not be created:`, errors);
              // 索引失败不是致命错误，仍然继续
              resolve();
            } else {
              console.log('✅ Database indexes created/verified');
              resolve();
            }
          }
        });
      });
    });
  }

  async migrateAddDescriptionDetail() {
    return new Promise((resolve, reject) => {
      // 检查列是否已存在
      this.db.all("PRAGMA table_info(events)", (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const hasDescriptionDetail = rows.some(row => row.name === 'description_detail');

        if (!hasDescriptionDetail) {
          console.log('🔄 Migrating database: adding description_detail column...');
          this.db.run("ALTER TABLE events ADD COLUMN description_detail TEXT", (err) => {
            if (err) {
              reject(err);
            } else {
              console.log('✅ Migration complete: description_detail column added');
              resolve();
            }
          });
        } else {
          // 列已存在，无需迁移
          resolve();
        }
      });
    });
  }

  normalizeTitle(title) {
    return title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
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

  async isDuplicate(event) {
    return new Promise((resolve, reject) => {
      const normalizedTitle = this.normalizeTitle(event.title);

      // 策略1：时间接近 + 地点 + 标题相似（原有逻辑）
      const query1 = `
        SELECT title, normalized_title, start_time, location
        FROM events
        WHERE week_identifier = ?
        AND location = ?
        AND ABS(julianday(start_time) - julianday(?)) < ?
      `;

      const timeWindowDays = config.deduplication.timeWindowHours / 24;

      this.db.all(query1, [
        event.weekIdentifier,
        event.location,
        event.startTime,
        timeWindowDays
      ], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        // 检查时间接近的活动
        if (rows.length > 0) {
          for (const row of rows) {
            const similarity = this.calculateStringSimilarity(
              normalizedTitle,
              row.normalized_title
            );

            if (similarity >= config.deduplication.titleSimilarityThreshold) {
              console.log(`[DB Dedup] Duplicate found: "${event.title}" matches "${row.title}" (similarity: ${similarity.toFixed(2)})`);
              resolve(true);
              return;
            }
          }
        }

        // 策略2：同地点 + 高度相似标题 + 时间在同一周内（用于多日活动检测）
        // 例如："The Box SF ... (Nov 1-2)" 可能在Funcheap分成两个条目
        const query2 = `
          SELECT title, normalized_title, start_time, location
          FROM events
          WHERE week_identifier = ?
          AND location = ?
        `;

        this.db.all(query2, [
          event.weekIdentifier,
          event.location
        ], (err2, rows2) => {
          if (err2) {
            reject(err2);
            return;
          }

          if (rows2.length === 0) {
            resolve(false);
            return;
          }

          // 检查标题高度相似的活动（即使时间差较大）
          // 这用于检测跨多天的同一活动
          const highSimilarityThreshold = 0.85;  // 更严格的相似度阈值

          for (const row of rows2) {
            const similarity = this.calculateStringSimilarity(
              normalizedTitle,
              row.normalized_title
            );

            // 只有在标题高度相似时才认为是重复（即使时间差很大）
            if (similarity >= highSimilarityThreshold) {
              console.log(`[DB Dedup] Multi-day event duplicate found: "${event.title}" matches "${row.title}" (similarity: ${similarity.toFixed(2)})`);
              resolve(true);
              return;
            }
          }

          resolve(false);
        });
      });
    });
  }

  async saveEvent(event) {
    return new Promise(async (resolve, reject) => {
      try {
        const isDup = await this.isDuplicate(event);
        if (isDup) {
          console.log(`Duplicate event skipped: ${event.title}`);
          resolve({ saved: false, reason: 'duplicate' });
          return;
        }

        const query = `
          INSERT INTO events (
            title, normalized_title, start_time, end_time, location,
            price, description, description_detail, original_url, source, event_type,
            priority, scraped_at, week_identifier
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
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
          event.weekIdentifier
        ];

        this.db.run(query, values, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ saved: true, id: this.lastID });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async getWeekEvents(weekIdentifier) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM events 
        WHERE week_identifier = ? 
        ORDER BY priority DESC, start_time ASC
      `;
      
      this.db.all(query, [weekIdentifier], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async logScrapingResult(source, eventsFound, success, errorMessage = null) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO scraping_logs (source, scraped_at, events_found, success, error_message)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        source,
        new Date().toISOString(),
        eventsFound,
        success,
        errorMessage
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = EventDatabase;