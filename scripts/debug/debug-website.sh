#!/bin/bash

echo "🔍 网站调试检查"
echo "================"
echo ""

# 1. 检查数据库
echo "1️⃣ 检查数据库..."
if [ ! -f "data/events.db" ]; then
  echo "   ❌ 数据库文件不存在: data/events.db"
  exit 1
fi
echo "   ✅ 数据库文件存在"

# 2. 检查活动数量
echo ""
echo "2️⃣ 检查活动数据..."
TOTAL=$(sqlite3 data/events.db "SELECT COUNT(*) FROM events;")
echo "   📊 总活动数: $TOTAL"

# 3. 检查本周和下周的活动
echo ""
echo "3️⃣ 检查周数据..."
sqlite3 data/events.db -column -header "
SELECT
  week_identifier,
  COUNT(*) as count
FROM events
GROUP BY week_identifier
ORDER BY week_identifier DESC
LIMIT 5;
"

# 4. 计算当前应该显示的周
echo ""
echo "4️⃣ 计算当前周标识符..."
TODAY=$(date +%Y-%m-%d)
echo "   今天: $TODAY"

# 获取本周一（周从周一开始）
DOW=$(date +%u)  # 1=Monday, 7=Sunday
DAYS_TO_MONDAY=$((DOW - 1))
THIS_MONDAY=$(date -d "$TODAY - $DAYS_TO_MONDAY days" +%Y-%m-%d 2>/dev/null || date -v-${DAYS_TO_MONDAY}d +%Y-%m-%d)
THIS_SUNDAY=$(date -d "$THIS_MONDAY + 6 days" +%Y-%m-%d 2>/dev/null || date -v+6d -j -f "%Y-%m-%d" "$THIS_MONDAY" +%Y-%m-%d)

NEXT_MONDAY=$(date -d "$THIS_MONDAY + 7 days" +%Y-%m-%d 2>/dev/null || date -v+7d -j -f "%Y-%m-%d" "$THIS_MONDAY" +%Y-%m-%d)
NEXT_SUNDAY=$(date -d "$NEXT_MONDAY + 6 days" +%Y-%m-%d 2>/dev/null || date -v+6d -j -f "%Y-%m-%d" "$NEXT_MONDAY" +%Y-%m-%d)

THIS_WEEK="${THIS_MONDAY}_to_${THIS_SUNDAY}"
NEXT_WEEK="${NEXT_MONDAY}_to_${NEXT_SUNDAY}"

echo "   本周 (current): $THIS_WEEK"
echo "   下周 (next): $NEXT_WEEK"

# 5. 查询这两周的活动数
echo ""
echo "5️⃣ 检查这两周的活动数..."
THIS_WEEK_COUNT=$(sqlite3 data/events.db "SELECT COUNT(*) FROM events WHERE week_identifier = '$THIS_WEEK';")
NEXT_WEEK_COUNT=$(sqlite3 data/events.db "SELECT COUNT(*) FROM events WHERE week_identifier = '$NEXT_WEEK';")

echo "   本周活动数: $THIS_WEEK_COUNT"
echo "   下周活动数: $NEXT_WEEK_COUNT"

# 6. 检查网站依赖
echo ""
echo "6️⃣ 检查网站依赖..."
if [ -d "website/node_modules" ]; then
  echo "   ✅ node_modules 存在"
else
  echo "   ❌ node_modules 不存在，需要运行: cd website && npm install"
fi

# 7. 检查 Next.js 配置
echo ""
echo "7️⃣ 检查 Next.js 配置..."
if [ -f "website/next.config.ts" ]; then
  echo "   ✅ next.config.ts 存在"
else
  echo "   ⚠️  next.config.ts 不存在"
fi

# 8. 测试数据库查询（模拟网站查询）
echo ""
echo "8️⃣ 模拟网站查询..."
echo "   查询: SELECT * FROM events WHERE week_identifier = '$NEXT_WEEK' LIMIT 3"
sqlite3 data/events.db -column -header "
SELECT
  id,
  title,
  week_identifier,
  location
FROM events
WHERE week_identifier = '$NEXT_WEEK'
LIMIT 3;
"

echo ""
echo "================"
echo "✅ 诊断完成"
echo ""
echo "📝 下一步:"
echo "   1. 如果 node_modules 不存在: cd website && npm install"
echo "   2. 启动开发服务器: cd website && npm run dev"
echo "   3. 访问: http://localhost:3000/zh"
echo "   4. 如果看不到活动，检查浏览器控制台的错误信息"
echo ""
