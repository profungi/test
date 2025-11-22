import { NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync } from 'fs';
import { getEvents, getCurrentWeekIdentifier, getNextWeekIdentifier } from '@/lib/db';

export async function GET() {
  try {
    const dbPath = join(process.cwd(), '..', 'data', 'events.db');

    const debugInfo: any = {
      cwd: process.cwd(),
      dbPath: dbPath,
      dbExists: existsSync(dbPath),
      nodeVersion: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV,
    };

    // Try to connect to database
    try {
      const Database = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true, fileMustExist: true });

      // Total count
      const totalResult = db.prepare('SELECT COUNT(*) as count FROM events').get() as any;
      debugInfo.dbConnection = 'SUCCESS';
      debugInfo.totalEvents = totalResult.count;

      // Week identifiers
      const currentWeek = getCurrentWeekIdentifier();
      const nextWeek = getNextWeekIdentifier();
      debugInfo.currentWeek = currentWeek;
      debugInfo.nextWeek = nextWeek;

      // Get weeks in database
      const weeksResult = db.prepare(`
        SELECT week_identifier, COUNT(*) as count
        FROM events
        GROUP BY week_identifier
        ORDER BY week_identifier DESC
      `).all() as any[];
      debugInfo.weeksInDb = weeksResult;

      // Query for current week
      const currentWeekResult = db.prepare(
        'SELECT COUNT(*) as count FROM events WHERE week_identifier = ?'
      ).get(currentWeek) as any;
      debugInfo.currentWeekCount = currentWeekResult.count;

      // Query for next week
      const nextWeekResult = db.prepare(
        'SELECT COUNT(*) as count FROM events WHERE week_identifier = ?'
      ).get(nextWeek) as any;
      debugInfo.nextWeekCount = nextWeekResult.count;

      // Test getEvents function
      const nextWeekEvents = getEvents({ week: 'next' });
      debugInfo.getEventsNextWeek = nextWeekEvents.length;

      const currentWeekEvents = getEvents({ week: 'current' });
      debugInfo.getEventsCurrentWeek = currentWeekEvents.length;

      db.close();
    } catch (dbError: any) {
      debugInfo.dbConnection = 'FAILED';
      debugInfo.dbError = dbError.message;
      debugInfo.dbStack = dbError.stack;
    }

    return NextResponse.json(debugInfo, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
