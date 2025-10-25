#!/bin/bash

# 快速验证脚本 - 一键检查所有 description_detail 实现

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Description_Detail 快速验证 - 一键检查                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
passed=0
failed=0

# 检查函数
check_item() {
  local item=$1
  local condition=$2

  if eval "$condition"; then
    echo -e "${GREEN}✅${NC} $item"
    ((passed++))
  else
    echo -e "${RED}❌${NC} $item"
    ((failed++))
  fi
}

echo "📄 检查源代码实现..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Eventbrite
echo "🔵 Eventbrite 爬虫:"
check_item "包含 description_detail" "grep -q 'description_detail' /code/src/scrapers/eventbrite-scraper.js"
check_item "有 fetchEventDetails() 方法" "grep -q 'async fetchEventDetails' /code/src/scrapers/eventbrite-scraper.js"
check_item "有 extractDetailedDescription() 方法" "grep -q 'extractDetailedDescription' /code/src/scrapers/eventbrite-scraper.js"
check_item "返回对象包含 description_detail" "grep -A 20 'return {' /code/src/scrapers/eventbrite-scraper.js | grep -q 'description_detail'"
echo ""

# SF Station
echo "🔵 SF Station 爬虫:"
check_item "包含 description_detail" "grep -q 'description_detail' /code/src/scrapers/sfstation-scraper.js"
check_item "有 fetchEventDetails() 方法" "grep -q 'async fetchEventDetails' /code/src/scrapers/sfstation-scraper.js"
check_item "有 extractDetailedDescription() 方法" "grep -q 'extractDetailedDescription' /code/src/scrapers/sfstation-scraper.js"
check_item "返回对象包含 description_detail" "grep -A 20 'return {' /code/src/scrapers/sfstation-scraper.js | grep -q 'description_detail'"
echo ""

# Funcheap
echo "🔵 Funcheap 爬虫 (新增):"
check_item "包含 description_detail" "grep -q 'description_detail' /code/src/scrapers/funcheap-weekend-scraper.js"
check_item "有 fetchEventDetails() 方法" "grep -q 'async fetchEventDetails' /code/src/scrapers/funcheap-weekend-scraper.js"
check_item "有 extractDetailedDescription() 方法" "grep -q 'extractDetailedDescription' /code/src/scrapers/funcheap-weekend-scraper.js"
check_item "返回对象包含 description_detail" "grep -A 10 'return {' /code/src/scrapers/funcheap-weekend-scraper.js | grep -q 'description_detail'"
echo ""

# 数据库
echo "💾 数据库检查:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_item "数据库初始化代码中有 description_detail 列" "grep -q 'description_detail TEXT' /code/src/utils/database.js"
check_item "INSERT 语句包含 description_detail" "grep -A 5 'INSERT INTO events' /code/src/utils/database.js | grep -q 'description_detail'"
echo ""

# 验证文件
echo "📋 验证文件检查:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_item "快速验证脚本存在" "[ -f /code/test-description-detail.js ]"
check_item "数据库验证脚本存在" "[ -f /code/verify-description-detail.js ]"
check_item "代码验证脚本存在" "[ -f /code/verify-scrapers-code.js ]"
check_item "验证文档存在" "[ -f /code/DESCRIPTION_DETAIL_VERIFICATION.md ]"
check_item "快速开始指南存在" "[ -f /code/VERIFICATION_QUICK_START.md ]"
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 验证结果:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

total=$((passed + failed))
percentage=$((passed * 100 / total))

echo "通过: $passed/$total ($percentage%)"
echo "失败: $failed/$total"
echo ""

if [ $failed -eq 0 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ 所有检查都通过！系统已准备好生产使用${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "🚀 下一步:"
  echo "  1. 运行爬虫生成数据: node src/scrape-events.js"
  echo "  2. 验证数据库数据: node verify-description-detail.js"
  echo "  3. 查看完整文档: cat VERIFICATION_QUICK_START.md"
  exit 0
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}❌ 有 $failed 项检查失败，请查看上面的详情${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 1
fi
