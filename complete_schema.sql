-- Events table
CREATE TABLE events (
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
  title_zh TEXT,
  UNIQUE(normalized_title, start_time, location)
);

-- Events indexes
CREATE INDEX idx_events_week ON events(week_identifier);
CREATE INDEX idx_events_location ON events(location);
CREATE INDEX idx_events_source ON events(source);
CREATE INDEX idx_events_normalized_title ON events(normalized_title);
CREATE INDEX idx_events_original_url ON events(original_url);
CREATE INDEX idx_events_location_time ON events(location, start_time);
CREATE INDEX idx_events_dedup ON events(week_identifier, location, date(start_time));

-- Scraping logs table
CREATE TABLE scraping_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  scraped_at TEXT NOT NULL,
  events_found INTEGER,
  success BOOLEAN,
  error_message TEXT
);

-- User feedback table
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

-- Feedback indexes
CREATE INDEX idx_feedback_type ON user_feedback(feedback_type);
CREATE INDEX idx_feedback_created ON user_feedback(created_at DESC);
CREATE INDEX idx_feedback_session ON user_feedback(session_id);
