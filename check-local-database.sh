#!/bin/bash

# 检查本地数据库中的 description_detail 数据

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         检查本地数据库中的 Description_Detail              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 查找数据库文件
echo "🔍 查找数据库文件..."
echo ""

# 常见的数据库位置
DB_LOCATIONS=(
  "./data/events.db"
  "./data/bay-area-events.db"
  "./events.db"
  "~/bay-area-events/data/events.db"
)

DB_FILE=""

for location in "${DB_LOCATIONS[@]}"; do
  expanded_location=$(eval echo "$location")
  if [ -f "$expanded_location" ]; then
    echo "✅ 找到数据库: $expanded_location"
    DB_FILE="$expanded_location"
    break
  fi
done

if [ -z "$DB_FILE" ]; then
  echo "❌ 未找到数据库文件"
  echo ""
  echo "请提供数据库文件的完整路径："
  echo "例如: bash check-local-database.sh /path/to/events.db"
  echo ""
  echo "或者运行爬虫生成数据："
  echo "  node src/scrape-events.js"
  exit 1
fi

# 如果命令行提供了数据库路径，使用它
if [ -n "$1" ]; then
  DB_FILE="$1"
  if [ ! -f "$DB_FILE" ]; then
    echo "❌ 文件不存在: $DB_FILE"
    exit 1
  fi
fi

echo ""
echo "📊 数据库文件: $DB_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查 sqlite3 是否可用
if ! command -v sqlite3 &> /dev/null; then
  echo "❌ sqlite3 未安装"
  echo ""
  echo "请安装 sqlite3:"
  echo "  macOS:   brew install sqlite3"
  echo "  Ubuntu:  sudo apt-get install sqlite3"
  echo "  CentOS:  sudo yum install sqlite"
  exit 1
fi

# 获取总事件数
echo "📈 统计信息:"
echo ""

TOTAL_EVENTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM events;" 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "❌ 无法读取数据库"
  exit 1
fi

echo "  总事件数: $TOTAL_EVENTS"

if [ "$TOTAL_EVENTS" -eq 0 ]; then
  echo ""
  echo "⚠️  数据库是空的！"
  echo ""
  echo "请运行爬虫生成数据:"
  echo "  node src/scrape-events.js"
  exit 0
fi

# 检查 description_detail 列是否存在
HAS_COLUMN=$(sqlite3 "$DB_FILE" "PRAGMA table_info(events);" | grep description_detail | wc -l)

if [ "$HAS_COLUMN" -eq 0 ]; then
  echo ""
  echo "❌ description_detail 列不存在！"
  echo ""
  echo "数据库需要迁移。请删除旧数据库并重新运行爬虫："
  echo "  rm $DB_FILE"
  echo "  node src/scrape-events.js"
  exit 1
fi

echo "  ✅ description_detail 列存在"
echo ""

# 统计有 description_detail 的事件
WITH_DETAIL=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM events WHERE description_detail IS NOT NULL AND description_detail != '';" 2>/dev/null)
WITHOUT_DETAIL=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM events WHERE description_detail IS NULL OR description_detail = '';" 2>/dev/null)

PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($WITH_DETAIL / $TOTAL_EVENTS) * 100}")

echo "📊 Description_Detail 覆盖率:"
echo ""
echo "  有值: $WITH_DETAIL/$TOTAL_EVENTS ($PERCENTAGE%)"
echo "  为空: $WITHOUT_DETAIL/$TOTAL_EVENTS"
echo ""

# 按来源统计
echo "📍 按来源统计:"
echo ""

sqlite3 "$DB_FILE" "
SELECT
  source,
  COUNT(*) as total,
  SUM(CASE WHEN description_detail IS NOT NULL AND description_detail != '' THEN 1 ELSE 0 END) as with_detail,
  PRINTF('%.1f%%',
    CAST(SUM(CASE WHEN description_detail IS NOT NULL AND description_detail != '' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100
  ) as percentage
FROM events
GROUP BY source
ORDER BY total DESC;
" -column -header 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 显示样本数据
echo "📋 样本数据 (前 3 个有 description_detail 的事件):"
echo ""

sqlite3 "$DB_FILE" "
SELECT
  SUBSTR(title, 1, 50) || '...' as title,
  source,
  LENGTH(description_detail) as detail_length,
  SUBSTR(description_detail, 1, 80) || '...' as detail_preview
FROM events
WHERE description_detail IS NOT NULL AND description_detail != ''
LIMIT 3;
" -column -header 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 结论
if [ "$WITH_DETAIL" -eq "$TOTAL_EVENTS" ]; then
  echo "✅ 完美！所有事件都有 description_detail"
elif [ "$WITH_DETAIL" -gt 0 ]; then
  echo "⚠️  部分事件有 description_detail ($PERCENTAGE%)"
  echo ""
  echo "这可能是因为："
  echo "  - 详情页抓取失败（网络问题）"
  echo "  - 某些事件没有详细描述"
  echo "  - CSS 选择器需要更新"
else
  echo "❌ 没有任何事件有 description_detail！"
  echo ""
  echo "可能原因："
  echo "  - 数据库是在添加 description_detail 功能之前生成的"
  echo "  - 需要重新运行爬虫"
  echo ""
  echo "解决方案："
  echo "  rm $DB_FILE"
  echo "  node src/scrape-events.js"
fi

echo ""
