#!/bin/bash

# Dev Container 创建后执行的脚本
# 这个脚本会在容器首次创建时自动运行

set -e

echo "🚀 Setting up Bay Area Events Scraper dev environment..."

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js 版本
echo -e "${BLUE}📦 Checking Node.js version...${NC}"
node --version
npm --version

# 修复 node_modules 权限（Docker volume 可能权限不对）
echo -e "${BLUE}🔧 Fixing node_modules permissions...${NC}"
sudo chown -R node:node /workspace/node_modules 2>/dev/null || true
sudo chown -R node:node /workspace/website/node_modules 2>/dev/null || true

# 验证 Chromium 安装
echo -e "${BLUE}🎭 Verifying Chromium installation...${NC}"
if command -v chromium &> /dev/null; then
    CHROMIUM_VERSION=$(chromium --version)
    echo -e "${GREEN}✅ Chromium installed: $CHROMIUM_VERSION${NC}"
    echo -e "${GREEN}   Architecture: $(uname -m)${NC}"
else
    echo -e "${YELLOW}⚠️  Chromium not found${NC}"
fi


# 安装根目录依赖
echo -e "${BLUE}📦 Installing root dependencies...${NC}"
# 使用 npm ci 代替 npm install（更快，更可靠）
if [ -f "package-lock.json" ]; then
    npm ci || npm install
else
    npm install
fi

# 安装网站依赖
if [ -d "website" ]; then
    echo -e "${BLUE}🌐 Installing website dependencies...${NC}"
    cd website
    if [ -f "package-lock.json" ]; then
        npm ci || npm install
    else
        npm install
    fi
    cd ..
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo -e "${YELLOW}   Copying .env.example to .env...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}   Please edit .env and add your API keys!${NC}"
    else
        echo -e "${YELLOW}   .env.example not found. Please create .env manually.${NC}"
    fi
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# 检查数据库目录
if [ ! -d "data" ]; then
    echo -e "${BLUE}📁 Creating data directory...${NC}"
    mkdir -p data
fi

# 检查输出目录
if [ ! -d "output" ]; then
    echo -e "${BLUE}📁 Creating output directory...${NC}"
    mkdir -p output
fi

# 验证 Puppeteer 安装
echo -e "${BLUE}🎭 Verifying Puppeteer installation...${NC}"
if command -v google-chrome &> /dev/null || command -v chromium &> /dev/null; then
    echo -e "${GREEN}✅ Chrome/Chromium found${NC}"
else
    echo -e "${YELLOW}⚠️  Chrome not found, Puppeteer will download it on first run${NC}"
fi

# 显示可用命令
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Available commands:${NC}"
echo "  npm run scrape              - Scrape events from all sources"
echo "  npm run generate-post       - Generate post from review file"
echo "  npm run generate-english    - Generate English posts"
echo "  cd website && npm run dev   - Start Next.js website"
echo ""
echo -e "${BLUE}Useful scripts:${NC}"
echo "  npm run init-feedback-db    - Initialize feedback database"
echo "  npm run collect-feedback    - Collect user feedback"
echo ""
echo -e "${GREEN}Happy coding! 🎉${NC}"
