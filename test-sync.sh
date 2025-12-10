#!/bin/bash

# 测试同步功能的脚本

set -e

echo "=================================="
echo "🧪 测试 Turso → Local 同步功能"
echo "=================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查环境配置
echo -e "${BLUE}1️⃣ 检查环境配置${NC}"
echo ""

if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  警告: 没有找到 .env 文件${NC}"
    echo "   请创建 .env 文件并配置 Turso 信息"
    exit 1
fi

source .env

if [ -z "$TURSO_DATABASE_URL" ] || [ -z "$TURSO_AUTH_TOKEN" ]; then
    echo -e "${RED}❌ 错误: Turso 配置不完整${NC}"
    echo "   请在 .env 中设置:"
    echo "   - TURSO_DATABASE_URL"
    echo "   - TURSO_AUTH_TOKEN"
    exit 1
fi

echo -e "${GREEN}✅ Turso 配置已设置${NC}"
echo "   URL: ${TURSO_DATABASE_URL:0:40}..."
echo ""

# 检查本地数据库
echo -e "${BLUE}2️⃣ 检查本地数据库${NC}"
echo ""

if [ -f data/events.db ]; then
    LOCAL_COUNT=$(sqlite3 data/events.db "SELECT COUNT(*) FROM events;" 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ 本地数据库存在${NC}"
    echo "   当前记录数: $LOCAL_COUNT"
else
    echo -e "${YELLOW}⚠️  本地数据库不存在，将在同步时创建${NC}"
    LOCAL_COUNT=0
fi
echo ""

# 预览同步
echo -e "${BLUE}3️⃣ 预览同步（不实际写入）${NC}"
echo ""

node sync-from-turso.js --dry-run

echo ""
echo -e "${BLUE}4️⃣ 测试完成${NC}"
echo ""

# 询问是否执行实际同步
read -p "是否执行实际同步？(y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}5️⃣ 执行增量同步${NC}"
    echo ""

    node sync-from-turso.js

    echo ""
    NEW_COUNT=$(sqlite3 data/events.db "SELECT COUNT(*) FROM events;" 2>/dev/null || echo "0")
    DIFF=$((NEW_COUNT - LOCAL_COUNT))

    echo -e "${GREEN}✅ 同步完成！${NC}"
    echo "   同步前: $LOCAL_COUNT 条"
    echo "   同步后: $NEW_COUNT 条"
    echo "   新增: $DIFF 条"
else
    echo ""
    echo -e "${YELLOW}取消同步${NC}"
fi

echo ""
echo "=================================="
echo -e "${GREEN}🎉 测试完成${NC}"
echo "=================================="
echo ""
echo "💡 提示:"
echo "   - 增量同步: npm run sync-from-turso"
echo "   - 全量同步: npm run sync-full"
echo "   - 预览模式: npm run sync-preview"
echo ""
