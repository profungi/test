import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 检查是否在 Vercel 环境
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);

// 只在非 Vercel 环境导入 better-sqlite3
let Database: any = null;
let dbPath: string | null = null;

if (!isVercel) {
  Database = require('better-sqlite3');
  const { join } = require('path');
  dbPath = join(process.cwd(), '..', 'data', 'events.db');
}

function getDb() {
  // 在 Vercel 环境中，返回 null（不保存数据）
  if (isVercel) {
    return null;
  }

  try {
    return new Database(dbPath);
  } catch (error) {
    console.error('Failed to open database:', error);
    return null;
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

    // 在 Vercel 环境中，不保存到数据库，直接返回成功
    if (!db) {
      console.log('[Feedback] Vercel environment - feedback not saved:', {
        feedbackType,
        locale,
        eventsShown,
      });

      return NextResponse.json({
        success: true,
        feedbackId: Date.now(), // 虚拟 ID
        message: 'Thank you for your feedback!',
      });
    }

    try {
      const result = await saveFeedback({
        sessionId,
        feedbackType,
        comment,
        filterState: filterState ? JSON.stringify(filterState) : undefined,
        eventsShown,
        userAgent,
        referrer,
        locale: locale || 'en',
        ipHash,
      });

      return NextResponse.json({
        success: true,
        feedbackId: result.feedbackId,
        message: 'Thank you for your feedback!',
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save feedback to database' },
        { status: 500 }
      );
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

    // 在 Vercel 环境中，返回空统计
    if (!db) {
      return NextResponse.json({
        recentStats: [],
        totalStats: [],
        message: 'Stats not available in Vercel environment',
      });
    }

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
      recentStats,
      totalStats,
    });
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
