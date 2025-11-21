import { NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET() {
  try {
    const dbPath = join(process.cwd(), '..', 'data', 'events.db');

    const debugInfo = {
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
      const result = db.prepare('SELECT COUNT(*) as count FROM events').get();
      db.close();

      debugInfo['dbConnection'] = 'SUCCESS';
      debugInfo['eventsCount'] = result.count;
    } catch (dbError: any) {
      debugInfo['dbConnection'] = 'FAILED';
      debugInfo['dbError'] = dbError.message;
    }

    return NextResponse.json(debugInfo);
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
