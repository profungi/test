#!/bin/bash

# 修复本地开发环境的脚本
# 解决 node_modules 架构冲突问题

set -e

echo "🔧 修复本地开发环境..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否在容器中
if [ -f "/.dockerenv" ] || [ -n "$REMOTE_CONTAINERS" ]; then
    echo -e "${RED}❌ 错误: 请在本地机器上运行此脚本，不要在 dev container 中！${NC}"
    echo ""
    echo "如果你在 VS Code 中:"
    echo "  1. 按 F1"
    echo "  2. 选择 'Dev Containers: Reopen Folder Locally'"
    echo "  3. 然后重新运行此脚本"
    exit 1
fi

echo -e "${BLUE}📍 当前目录:${NC} $(pwd)"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到 Node.js${NC}"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js 版本: $(node --version)"
echo -e "${GREEN}✓${NC} npm 版本: $(npm --version)"
echo ""

# 清理根目录 node_modules
echo -e "${BLUE}🗑️  清理根目录 node_modules...${NC}"
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo -e "${GREEN}✓${NC} 已删除 node_modules/"
else
    echo -e "${YELLOW}⚠${NC} node_modules/ 不存在（跳过）"
fi

# 清理 website node_modules
echo -e "${BLUE}🗑️  清理 website node_modules...${NC}"
if [ -d "website/node_modules" ]; then
    rm -rf website/node_modules
    echo -e "${GREEN}✓${NC} 已删除 website/node_modules/"
else
    echo -e "${YELLOW}⚠${NC} website/node_modules/ 不存在（跳过）"
fi

echo ""

# 重新安装根目录依赖
echo -e "${BLUE}📦 安装根目录依赖...${NC}"
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi
echo -e "${GREEN}✓${NC} 根目录依赖安装完成"
echo ""

# 重新安装 website 依赖
if [ -d "website" ]; then
    echo -e "${BLUE}🌐 安装 website 依赖...${NC}"
    cd website
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    cd ..
    echo -e "${GREEN}✓${NC} website 依赖安装完成"
else
    echo -e "${YELLOW}⚠${NC} website/ 目录不存在（跳过）"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ 修复完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}现在你可以:${NC}"
echo "  cd website"
echo "  npm run dev"
echo ""
echo -e "${BLUE}然后访问:${NC} http://localhost:3000"
echo ""
echo -e "${YELLOW}注意:${NC}"
echo "  - 始终在本地环境开发网站（不要使用 dev container）"
echo "  - Dev container 只用于 Sculptor agent（自动）"
echo "  - 详细说明: .devcontainer/HYBRID_DEVELOPMENT.md"
echo ""
