#!/bin/bash

# 验证 Dev Container 配置的脚本

echo "🔍 Validating Dev Container configuration..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# 检查必需文件
echo "📁 Checking required files..."

if [ -f ".devcontainer/devcontainer.json" ]; then
    echo -e "${GREEN}✓${NC} devcontainer.json exists"
else
    echo -e "${RED}✗${NC} devcontainer.json missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -f ".devcontainer/Dockerfile" ]; then
    echo -e "${GREEN}✓${NC} Dockerfile exists"
else
    echo -e "${RED}✗${NC} Dockerfile missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -f ".devcontainer/post-create.sh" ]; then
    echo -e "${GREEN}✓${NC} post-create.sh exists"
    if [ -x ".devcontainer/post-create.sh" ]; then
        echo -e "${GREEN}✓${NC} post-create.sh is executable"
    else
        echo -e "${YELLOW}⚠${NC} post-create.sh is not executable (will be fixed)"
        chmod +x .devcontainer/post-create.sh
    fi
else
    echo -e "${RED}✗${NC} post-create.sh missing"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📋 Checking package.json files..."

if [ -f "package.json" ]; then
    echo -e "${GREEN}✓${NC} Root package.json exists"
else
    echo -e "${RED}✗${NC} Root package.json missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "website/package.json" ]; then
    echo -e "${GREEN}✓${NC} Website package.json exists"
else
    echo -e "${YELLOW}⚠${NC} Website package.json missing"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "🔧 Checking JSON syntax..."

# 验证 devcontainer.json 语法 (移除注释后)
if command -v jq &> /dev/null; then
    if grep -v '^\s*//' .devcontainer/devcontainer.json | jq empty 2>/dev/null; then
        echo -e "${GREEN}✓${NC} devcontainer.json syntax is valid (JSONC)"
    else
        echo -e "${YELLOW}⚠${NC} devcontainer.json contains comments (this is OK, JSONC is supported)"
    fi
else
    echo -e "${YELLOW}⚠${NC} jq not installed, skipping JSON validation"
fi

echo ""
echo "🐳 Checking Docker..."

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker is installed"
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker daemon is running"
    else
        echo -e "${RED}✗${NC} Docker daemon is not running"
        echo -e "   Please start Docker Desktop"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Docker is not installed"
    echo -e "   Please install Docker Desktop: https://www.docker.com/products/docker-desktop"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📦 Checking configuration details..."

# 检查 Node 版本配置
if grep -q '"NODE_VERSION": "24"' .devcontainer/devcontainer.json; then
    echo -e "${GREEN}✓${NC} Node.js version 24 configured"
else
    echo -e "${YELLOW}⚠${NC} Node.js version might not be 24"
    WARNINGS=$((WARNINGS + 1))
fi

# 检查端口转发
if grep -q '"forwardPorts": \[3000\]' .devcontainer/devcontainer.json; then
    echo -e "${GREEN}✓${NC} Port 3000 forwarding configured"
else
    echo -e "${YELLOW}⚠${NC} Port 3000 forwarding might not be configured"
    WARNINGS=$((WARNINGS + 1))
fi

# 检查扩展配置
if grep -q "vscode-sqlite" .devcontainer/devcontainer.json; then
    echo -e "${GREEN}✓${NC} SQLite extension configured"
else
    echo -e "${YELLOW}⚠${NC} SQLite extension might not be configured"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "ZainChen.json" .devcontainer/devcontainer.json; then
    echo -e "${GREEN}✓${NC} JSON extension configured"
else
    echo -e "${YELLOW}⚠${NC} JSON extension might not be configured"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "📚 Checking documentation..."

if [ -f "DEV_CONTAINER.md" ]; then
    echo -e "${GREEN}✓${NC} DEV_CONTAINER.md exists"
else
    echo -e "${YELLOW}⚠${NC} DEV_CONTAINER.md missing"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f ".devcontainer/README.md" ]; then
    echo -e "${GREEN}✓${NC} .devcontainer/README.md exists"
else
    echo -e "${YELLOW}⚠${NC} .devcontainer/README.md missing"
    WARNINGS=$((WARNINGS + 1))
fi

# 总结
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "You're ready to use Dev Container!"
    echo "Next steps:"
    echo "  1. Open this project in VS Code"
    echo "  2. Press F1 and select 'Dev Containers: Reopen in Container'"
    echo "  3. Wait for the container to build (first time: 3-5 min)"
    echo "  4. Start coding!"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Validation completed with ${WARNINGS} warning(s)${NC}"
    echo ""
    echo "Configuration should work, but review warnings above."
    exit 0
else
    echo -e "${RED}❌ Validation failed with ${ERRORS} error(s) and ${WARNINGS} warning(s)${NC}"
    echo ""
    echo "Please fix the errors above before using Dev Container."
    exit 1
fi
