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
          } else {
            resolve();
          }
        });
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

      const query = `
        SELECT title, normalized_title, start_time, location
        FROM events
        WHERE week_identifier = ?
        AND location = ?
        AND ABS(julianday(start_time) - julianday(?)) < ?
      `;

      const timeWindowDays = config.deduplication.timeWindowHours / 24;

      this.db.all(query, [
        event.weekIdentifier,
        event.location,
        event.startTime,
        timeWindowDays
      ], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        if (rows.length === 0) {
          resolve(false);
          return;
        }

        // console.log(`[DB Dedup] Checking "${event.title}" against ${rows.length} existing events`);

        for (const row of rows) {
          const similarity = this.calculateStringSimilarity(
            normalizedTitle,
            row.normalized_title
          );

          // console.log(`  Similarity with "${row.title}": ${similarity.toFixed(2)}`);

          if (similarity >= config.deduplication.titleSimilarityThreshold) {
            console.log(`[DB Dedup] Duplicate found: "${event.title}" matches "${row.title}" (similarity: ${similarity.toFixed(2)})`);
            resolve(true);
            return;
          }
        }

        resolve(false);
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