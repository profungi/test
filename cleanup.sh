#!/bin/bash

echo "🧹 数据和文档清理工具"
echo "===================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 清理临时测试文件
echo "1️⃣ 清理临时测试文件..."
TEST_FILES=(
  "test_week.js"
  "test-week-fix.js"
  "test-logic.js"
  "verify-fix.js"
)

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "   ${YELLOW}删除:${NC} $file"
    rm "$file"
  fi
done

# 2. 清理旧的数据库备份（保留最新的2个）
echo ""
echo "2️⃣ 清理数据库备份文件..."
cd data
BACKUPS=($(ls -t events.db.backup* 2>/dev/null))
BACKUP_COUNT=${#BACKUPS[@]}

if [ $BACKUP_COUNT -gt 2 ]; then
  echo "   找到 $BACKUP_COUNT 个备份文件，保留最新的 2 个..."
  for ((i=2; i<$BACKUP_COUNT; i++)); do
    echo -e "   ${YELLOW}删除:${NC} ${BACKUPS[$i]}"
    rm "${BACKUPS[$i]}"
  done
else
  echo -e "   ${GREEN}✓${NC} 备份文件数量合理 ($BACKUP_COUNT 个)"
fi
cd ..

# 3. 清理旧的 review 文件（可选）
echo ""
echo "3️⃣ 检查旧的 review 文件..."
cd output
OLD_REVIEWS=($(find . -name "review_*.json" -mtime +30 2>/dev/null))
OLD_COUNT=${#OLD_REVIEWS[@]}

if [ $OLD_COUNT -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️${NC}  发现 $OLD_COUNT 个超过 30 天的 review 文件"
  echo "   这些文件可以安全删除（已经生成过帖子）:"
  for file in "${OLD_REVIEWS[@]}"; do
    echo "      - $file"
  done
  echo ""
  read -p "   是否删除这些旧文件? [y/N]: " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    for file in "${OLD_REVIEWS[@]}"; do
      rm "$file"
      echo -e "   ${GREEN}✓${NC} 已删除: $file"
    done
  else
    echo -e "   ${YELLOW}跳过${NC}"
  fi
else
  echo -e "   ${GREEN}✓${NC} 没有超过 30 天的旧文件"
fi
cd ..

# 4. 清理 Next.js 缓存（可选）
echo ""
echo "4️⃣ Next.js 缓存..."
if [ -d "website/.next" ]; then
  CACHE_SIZE=$(du -sh website/.next 2>/dev/null | cut -f1)
  echo "   当前缓存大小: $CACHE_SIZE"
  read -p "   是否清理 Next.js 缓存? [y/N]: " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf website/.next
    echo -e "   ${GREEN}✓${NC} 缓存已清理"
  else
    echo -e "   ${YELLOW}跳过${NC}"
  fi
else
  echo -e "   ${GREEN}✓${NC} 没有缓存"
fi

# 5. 整理调试脚本
echo ""
echo "5️⃣ 整理调试脚本..."
DEBUG_SCRIPTS=(
  "debug-website.sh"
  "diagnose-website.sh"
  "test-feedback-api.sh"
)

if [ ! -d "scripts/debug" ]; then
  mkdir -p scripts/debug
  echo -e "   ${GREEN}✓${NC} 创建 scripts/debug 目录"
fi

for script in "${DEBUG_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    echo -e "   ${YELLOW}移动:${NC} $script -> scripts/debug/"
    mv "$script" scripts/debug/
  fi
done

# 6. 生成清理报告
echo ""
echo "===================="
echo "📊 清理完成！"
echo ""
echo "当前空间使用情况:"
echo "  数据库: $(du -sh data/*.db 2>/dev/null | cut -f1)"
echo "  备份文件: $(du -sh data/*.backup* 2>/dev/null | cut -f1 | head -1)"
echo "  输出文件: $(du -sh output 2>/dev/null | cut -f1)"
if [ -d "website/.next" ]; then
  echo "  Next.js 缓存: $(du -sh website/.next 2>/dev/null | cut -f1)"
else
  echo "  Next.js 缓存: 0B (已清理)"
fi
echo ""
echo "建议:"
echo "  • 定期运行此脚本保持项目整洁"
echo "  • 数据库备份文件会自动保留最新 2 个"
echo "  • review 文件在生成帖子后可以删除"
echo ""
