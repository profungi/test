#!/bin/bash

echo "🔍 数据库去重工具"
echo "=================="
echo ""

DB_PATH="data/events.db"

# 检查数据库是否存在
if [ ! -f "$DB_PATH" ]; then
  echo "❌ 数据库文件不存在: $DB_PATH"
  exit 1
fi

# 备份数据库
BACKUP_PATH="data/events.db.backup.$(date +%Y%m%d_%H%M%S)"
echo "📦 创建备份: $BACKUP_PATH"
cp "$DB_PATH" "$BACKUP_PATH"
echo "   ✅ 备份完成"
echo ""

# 统计初始数量
TOTAL_BEFORE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM events;")
echo "📊 初始活动数: $TOTAL_BEFORE"
echo ""

# 1. 删除无效活动
echo "🗑️  删除无效活动（标题是网站域名）..."
INVALID_COUNT=$(sqlite3 "$DB_PATH" "
DELETE FROM events
WHERE normalized_title IN (
  'www sfstation com',
  'www.sfstation.com',
  'eventbrite.com',
  'funcheap.com',
  'eventbrite',
  'funcheap',
  'sfstation'
);
SELECT changes();
")
echo "   ✅ 删除了 $INVALID_COUNT 个无效活动"
echo ""

# 2. 查找重复活动
echo "🔍 查找重复活动..."
DUPLICATES=$(sqlite3 "$DB_PATH" -column -header "
SELECT
  normalized_title,
  COUNT(*) as count
FROM events
GROUP BY normalized_title
HAVING COUNT(*) > 1
ORDER BY count DESC;
")

if [ -z "$DUPLICATES" ]; then
  echo "   ✅ 没有发现重复活动"
else
  echo "$DUPLICATES" | head -20

  # 统计重复组数
  DUP_GROUPS=$(echo "$DUPLICATES" | tail -n +2 | wc -l)
  echo ""
  echo "   发现 $DUP_GROUPS 组重复活动"
  echo ""

  # 3. 删除重复（保留 ID 最小且优先级最高的）
  echo "🗑️  删除重复活动..."

  # 使用 SQL 删除重复，保留每组中 ID 最小的
  sqlite3 "$DB_PATH" "
  -- 创建临时表存储要保留的 ID
  CREATE TEMP TABLE keep_ids AS
  SELECT MIN(id) as id
  FROM events
  GROUP BY normalized_title;

  -- 删除不在保留列表中的记录
  DELETE FROM events
  WHERE id NOT IN (SELECT id FROM keep_ids);
  "

  # 统计删除数量
  TOTAL_AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM events;")
  DELETED=$((TOTAL_BEFORE - TOTAL_AFTER))

  echo "   ✅ 删除了 $DELETED 个重复活动"
fi

echo ""
echo "=================================================="
echo "✅ 去重完成！"
echo ""
echo "📊 统计信息:"
echo "   • 初始活动数: $TOTAL_BEFORE"
echo "   • 最终活动数: $TOTAL_AFTER"
echo "   • 共删除: $DELETED"
echo ""
echo "💾 备份文件: $BACKUP_PATH"
echo "=================================================="
echo ""
