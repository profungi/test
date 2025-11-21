#!/bin/bash

echo "🔧 修复和重启开发服务器"
echo "========================"
echo ""

# 进入 website 目录
cd website || exit 1

# 1. 清除 Next.js 缓存
echo "1️⃣ 清除 Next.js 缓存..."
if [ -d ".next" ]; then
  rm -rf .next
  echo "   ✅ .next 目录已删除"
else
  echo "   ℹ️  .next 目录不存在（首次运行？）"
fi

# 2. 检查 node_modules
echo ""
echo "2️⃣ 检查依赖..."
if [ -d "node_modules" ]; then
  echo "   ✅ node_modules 存在"
else
  echo "   ⚠️  node_modules 不存在，正在安装..."
  npm install
fi

# 3. 验证数据库
echo ""
echo "3️⃣ 验证数据库..."
if [ -f "../data/events.db" ]; then
  echo "   ✅ 数据库文件存在"
  EVENT_COUNT=$(sqlite3 ../data/events.db "SELECT COUNT(*) FROM events;" 2>/dev/null)
  if [ $? -eq 0 ]; then
    echo "   ✅ 数据库连接正常 (活动数: $EVENT_COUNT)"
  else
    echo "   ❌ 无法连接数据库"
  fi
else
  echo "   ❌ 数据库文件不存在: ../data/events.db"
fi

# 4. 检查必要文件
echo ""
echo "4️⃣ 检查关键文件..."
FILES=(
  "app/components/FeedbackWidget.tsx"
  "app/components/FeedbackSection.tsx"
  "app/hooks/useUserPreferences.ts"
  "app/api/feedback/route.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file 缺失"
  fi
done

# 5. 提示启动
echo ""
echo "========================"
echo "✅ 准备完成！"
echo ""
echo "📝 下一步："
echo "   1. 运行: npm run dev"
echo "   2. 访问: http://localhost:3000/zh"
echo "   3. 测试: http://localhost:3000/api/debug"
echo ""
echo "🐛 如果仍有错误，查看 TROUBLESHOOTING.md"
echo ""
