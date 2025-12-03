CREATE TABLE user_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  comment TEXT,
  filter_state TEXT,
  events_shown INTEGER,
  user_agent TEXT,
  referrer TEXT,
  locale TEXT,
  created_at TEXT NOT NULL,
  ip_hash TEXT
);
CREATE INDEX idx_feedback_type ON user_feedback(feedback_type);
CREATE INDEX idx_feedback_created ON user_feedback(created_at DESC);
CREATE INDEX idx_feedback_session ON user_feedback(session_id);
