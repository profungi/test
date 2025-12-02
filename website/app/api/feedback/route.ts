import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { join } from 'path';
import crypto from 'crypto';

// Database connection
const dbPath = join(process.cwd(), '..', 'data', 'events.db');

function getDb() {
  // 在 Vercel 环境中，数据库文件不存在
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    throw new Error('Feedback database not configured for Vercel. Please use Turso or another cloud database.');
  }

  try {
    return new Database(dbPath);
  } catch (error) {
    console.error('Failed to open database:', error);
    throw new Error('Database connection failed. Please check configuration.');
  }
}

// Generate anonymous session ID from IP
function generateSessionId(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

// Hash IP for privacy
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      feedbackType,
      comment,
      filterState,
      eventsShown,
      locale,
    } = body;

    // Validate required fields
    if (!feedbackType || !['thumbs_up', 'thumbs_down'].includes(feedbackType)) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      );
    }

    // Get user information
    const ip = request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const referrer = request.headers.get('referer') || '';

    const sessionId = generateSessionId(ip);
    const ipHash = hashIp(ip);

    // Insert feedback
    const db = getDb();

    try {
      const stmt = db.prepare(`
        INSERT INTO user_feedback (
          session_id,
          feedback_type,
          comment,
          filter_state,
          events_shown,
          user_agent,
          referrer,
          locale,
          created_at,
          ip_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        sessionId,
        feedbackType,
        comment || null,
        filterState ? JSON.stringify(filterState) : null,
        eventsShown || null,
        userAgent,
        referrer,
        locale || 'en',
        new Date().toISOString(),
        ipHash
      );

      return NextResponse.json({
        success: true,
        feedbackId: result.lastInsertRowid,
        message: 'Thank you for your feedback!',
      });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve feedback stats (optional, for admin use)
export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    try {
      const stats = db.prepare(`
        SELECT
          feedback_type,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM user_feedback
        WHERE created_at >= datetime('now', '-7 days')
        GROUP BY feedback_type, DATE(created_at)
        ORDER BY date DESC
      `).all();

      const totalStats = db.prepare(`
        SELECT
          feedback_type,
          COUNT(*) as count
        FROM user_feedback
        GROUP BY feedback_type
      `).all();

      return NextResponse.json({
        recentStats: stats,
        totalStats: totalStats,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
