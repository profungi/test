const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class PerformanceEventMatcher {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.stats = {
      total: 0,
      uniqueTitleMatch: 0,
      multipleMatchResolvedByUrl: 0,
      noMatch: 0,
      multipleMatchNotResolved: 0,
      updated: 0
    };
    this.unmatchedRecords = [];
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getAllPerformanceRecords() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM event_performance ORDER BY event_id',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async findEventsByTitle(title) {
    const trimmedTitle = title.trim();
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT id, title, original_url FROM events WHERE TRIM(title) = ? COLLATE NOCASE',
        [trimmedTitle],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async updatePerformanceEventId(performanceId, newEventId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE event_performance SET event_id = ? WHERE id = ?',
        [newEventId, performanceId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async matchRecord(perfRecord, dryRun = true) {
    const { id, event_id, event_title, event_url } = perfRecord;

    // Step 1: Find by title
    const matchedEvents = await this.findEventsByTitle(event_title);

    if (matchedEvents.length === 0) {
      // No match found
      this.stats.noMatch++;
      this.unmatchedRecords.push({
        performance_id: id,
        current_event_id: event_id,
        event_title,
        event_url,
        reason: 'No matching title found',
        matched_events: 0
      });
      console.log(`  ❌ [ID ${id}] No match for: "${event_title}"`);
      return null;
    }

    if (matchedEvents.length === 1) {
      // Unique title match
      const newEventId = matchedEvents[0].id;
      this.stats.uniqueTitleMatch++;

      if (!dryRun) {
        await this.updatePerformanceEventId(id, newEventId);
        this.stats.updated++;
      }

      console.log(`  ✅ [ID ${id}] Title match: ${event_id} → ${newEventId}`);
      return newEventId;
    }

    // Multiple matches - check URL
    console.log(`  ⚠️  [ID ${id}] Multiple title matches (${matchedEvents.length}), checking URL...`);

    const trimmedUrl = event_url ? event_url.trim() : '';
    const urlMatches = matchedEvents.filter(e =>
      e.original_url && e.original_url.trim().toLowerCase() === trimmedUrl.toLowerCase()
    );

    if (urlMatches.length === 1) {
      // Resolved by URL
      const newEventId = urlMatches[0].id;
      this.stats.multipleMatchResolvedByUrl++;

      if (!dryRun) {
        await this.updatePerformanceEventId(id, newEventId);
        this.stats.updated++;
      }

      console.log(`  ✅ [ID ${id}] URL resolved: ${event_id} → ${newEventId}`);
      return newEventId;
    }

    // Cannot resolve
    this.stats.multipleMatchNotResolved++;
    this.unmatchedRecords.push({
      performance_id: id,
      current_event_id: event_id,
      event_title,
      event_url,
      reason: urlMatches.length === 0 ? 'URL not found in matched events' : 'Multiple URL matches',
      matched_events: matchedEvents.length,
      possible_event_ids: matchedEvents.map(e => e.id).join(', '),
      possible_urls: matchedEvents.map(e => e.original_url).join(' | ')
    });

    console.log(`  ❌ [ID ${id}] Cannot resolve: ${matchedEvents.length} title matches, ${urlMatches.length} URL matches`);
    return null;
  }

  async processAll(dryRun = true) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(dryRun ? '🧪 DRY RUN MODE - No changes will be made' : '🔧 EXECUTION MODE - Updating database');
    console.log(`${'='.repeat(60)}\n`);

    const records = await this.getAllPerformanceRecords();
    this.stats.total = records.length;

    console.log(`📊 Total performance records to process: ${records.length}\n`);

    for (const record of records) {
      await this.matchRecord(record, dryRun);
    }

    this.printSummary();

    if (this.unmatchedRecords.length > 0) {
      this.saveUnmatchedToCSV();
    }
  }

  printSummary() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('📈 MATCHING SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total records:                    ${this.stats.total}`);
    console.log(`✅ Unique title match:            ${this.stats.uniqueTitleMatch}`);
    console.log(`✅ Multiple matches (URL solved): ${this.stats.multipleMatchResolvedByUrl}`);
    console.log(`❌ No title match:                ${this.stats.noMatch}`);
    console.log(`❌ Multiple matches (unresolved): ${this.stats.multipleMatchNotResolved}`);
    console.log(`\n🔄 Records updated:               ${this.stats.updated}`);
    console.log(`⚠️  Records need manual review:   ${this.unmatchedRecords.length}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  saveUnmatchedToCSV() {
    const csvPath = path.join(__dirname, 'unmatched-performance-records.csv');

    // CSV header
    const headers = [
      'performance_id',
      'current_event_id',
      'event_title',
      'event_url',
      'reason',
      'matched_events',
      'possible_event_ids',
      'possible_urls'
    ];

    // CSV rows
    const rows = this.unmatchedRecords.map(record => {
      return headers.map(header => {
        const value = record[header] || '';
        // Escape quotes and wrap in quotes if contains comma or quotes
        const escaped = String(value).replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
      }).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    fs.writeFileSync(csvPath, csv, 'utf8');
    console.log(`📄 Unmatched records saved to: ${csvPath}\n`);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

async function backup(dbPath) {
  const timestamp = Date.now();
  const backupPath = `${dbPath}.backup.${timestamp}`;

  console.log(`📦 Creating backup: ${backupPath}`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Backup created successfully\n`);

  return backupPath;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--confirm');
  const dbPath = path.join(__dirname, 'data', 'events.db');

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    process.exit(1);
  }

  // Always backup before running
  await backup(dbPath);

  const matcher = new PerformanceEventMatcher(dbPath);

  try {
    await matcher.init();
    await matcher.processAll(dryRun);

    if (dryRun) {
      console.log('💡 To execute the changes, run:');
      console.log('   node fix-performance-event-ids.js --confirm\n');
    } else {
      console.log('✅ Database updated successfully!\n');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    matcher.close();
  }
}

main();
