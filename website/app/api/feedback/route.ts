import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { saveFeedback, getRecentFeedbackStats, getTotalFeedbackStats } from '@/lib/turso-feedback';

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

    // Save feedback to Turso
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
    const [recentStats, totalStats] = await Promise.all([
      getRecentFeedbackStats(),
      getTotalFeedbackStats(),
    ]);

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
