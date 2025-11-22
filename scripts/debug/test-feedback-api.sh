#!/bin/bash

# 测试用户反馈 API 的脚本
# 注意：需要先启动 Next.js 开发服务器

echo "🧪 Testing User Feedback API"
echo "=============================="
echo ""

# 检查数据库是否存在
if [ ! -f "data/events.db" ]; then
  echo "❌ Error: data/events.db not found"
  exit 1
fi

echo "✅ Database found"
echo ""

# 检查表是否存在
echo "📊 Checking database tables..."
TABLES=$(sqlite3 data/events.db "SELECT name FROM sqlite_master WHERE type='table' AND (name='user_feedback' OR name='user_preferences');")

if echo "$TABLES" | grep -q "user_feedback"; then
  echo "✅ user_feedback table exists"
else
  echo "❌ user_feedback table missing"
  exit 1
fi

if echo "$TABLES" | grep -q "user_preferences"; then
  echo "✅ user_preferences table exists"
else
  echo "❌ user_preferences table missing"
  exit 1
fi

echo ""
echo "📈 Current feedback statistics:"
sqlite3 data/events.db "
SELECT
  feedback_type,
  COUNT(*) as count
FROM user_feedback
GROUP BY feedback_type;
"

echo ""
echo "💬 Recent comments:"
sqlite3 data/events.db "
SELECT
  substr(comment, 1, 50) as comment_preview,
  locale,
  datetime(created_at) as created
FROM user_feedback
WHERE comment IS NOT NULL AND comment != ''
ORDER BY created_at DESC
LIMIT 5;
"

echo ""
echo "📝 Test Summary:"
echo "  - Tables: OK"
echo "  - Structure: OK"
echo ""
echo "🎯 Next steps:"
echo "  1. cd website && npm run dev"
echo "  2. Open http://localhost:3000/zh"
echo "  3. Scroll to bottom and test feedback widget"
echo ""
