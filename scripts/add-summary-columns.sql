-- Add summary columns to events table
-- Run this on both Turso and local SQLite

ALTER TABLE events ADD COLUMN summary_en TEXT;
ALTER TABLE events ADD COLUMN summary_zh TEXT;
