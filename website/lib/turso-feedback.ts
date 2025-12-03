import { createClient } from '@libsql/client';

// Turso 数据库连接
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export interface FeedbackData {
  sessionId: string;
  feedbackType: 'thumbs_up' | 'thumbs_down';
  comment?: string;
  filterState?: string;
  eventsShown?: number;
  userAgent: string;
  referrer: string;
  locale: string;
  ipHash: string;
}

/**
 * 保存用户反馈到 Turso
 */
export async function saveFeedback(data: FeedbackData): Promise<{ feedbackId: number }> {
  const result = await turso.execute({
    sql: `
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
    `,
    args: [
      data.sessionId,
      data.feedbackType,
      data.comment || null,
      data.filterState || null,
      data.eventsShown || null,
      data.userAgent,
      data.referrer,
      data.locale,
      new Date().toISOString(),
      data.ipHash,
    ],
  });

  return {
    feedbackId: Number(result.lastInsertRowid),
  };
}

/**
 * 获取反馈统计（最近 7 天）
 */
export async function getRecentFeedbackStats() {
  const result = await turso.execute({
    sql: `
      SELECT
        feedback_type,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM user_feedback
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY feedback_type, DATE(created_at)
      ORDER BY date DESC
    `,
  });

  return result.rows;
}

/**
 * 获取总体反馈统计
 */
export async function getTotalFeedbackStats() {
  const result = await turso.execute({
    sql: `
      SELECT
        feedback_type,
        COUNT(*) as count
      FROM user_feedback
      GROUP BY feedback_type
    `,
  });

  return result.rows;
}
