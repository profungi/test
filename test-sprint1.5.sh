#!/bin/bash

# Sprint 1.5 测试脚本
# 测试多review合并功能

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Sprint 1.5 测试脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "1️⃣ 测试数据库迁移到 v1.5"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node init-feedback-db.js

if [ $? -eq 0 ]; then
  echo "✅ 数据库迁移成功"
else
  echo "❌ 数据库迁移失败"
  exit 1
fi

echo ""
echo "2️⃣ 检查新字段是否添加"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sqlite3 ./data/events.db "PRAGMA table_info(posts);" | grep -E "(source_reviews|is_merged_post)"
sqlite3 ./data/events.db "PRAGMA table_info(event_performance);" | grep -E "(source_review|source_website)"

if [ $? -eq 0 ]; then
  echo "✅ 新字段已添加"
else
  echo "❌ 新字段未找到"
  exit 1
fi

echo ""
echo "3️⃣ 检查 schema 版本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sqlite3 ./data/events.db "SELECT * FROM schema_version;"

echo ""
echo "4️⃣ 测试交互式review选择（手动测试）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "请手动运行以下命令测试："
echo ""
echo "  npm run generate-post"
echo ""
echo "这将启动交互式选择模式"

echo ""
echo "5️⃣ 测试传统单review模式（手动测试）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "请手动运行以下命令测试："
echo ""
echo "  npm run generate-post ./output/review_*.json"
echo ""
echo "这将使用传统的单文件模式"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 自动测试完成！请按上述提示进行手动测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
