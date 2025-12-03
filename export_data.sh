#!/bin/bash
# 导出本地 SQLite 数据库中的数据

DB_FILE="/code/data/events.db"

echo "=== 导出 events 表数据 ==="
sqlite3 "$DB_FILE" <<SQL
.mode insert events
SELECT * FROM events;
SQL

echo ""
echo "=== 导出 scraping_logs 表数据 ==="
sqlite3 "$DB_FILE" <<SQL
.mode insert scraping_logs
SELECT * FROM scraping_logs;
SQL

echo ""
echo "=== 导出完成 ==="
echo "总共导出:"
sqlite3 "$DB_FILE" "SELECT COUNT(*) || ' events' FROM events;"
sqlite3 "$DB_FILE" "SELECT COUNT(*) || ' scraping_logs' FROM scraping_logs;"
