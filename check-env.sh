#!/bin/bash

echo "=================================="
echo "环境检查"
echo "=================================="
echo ""
echo "当前位置: $(pwd)"
echo "用户: $(whoami)"
echo "主机名: $(hostname)"
echo ""
echo "=== 环境变量 ==="
echo "USE_TURSO: ${USE_TURSO:-(未设置)}"
echo "TURSO_DATABASE_URL: ${TURSO_DATABASE_URL:0:40}${TURSO_DATABASE_URL:+...}"
echo "TRANSLATOR_PROVIDER: ${TRANSLATOR_PROVIDER:-(未设置)}"
echo ""
echo "=== .env 文件 ==="
if [ -f .env ]; then
  echo "✅ 找到 .env 文件"
  echo "内容预览:"
  grep -E "USE_TURSO|TURSO_DATABASE_URL|TRANSLATOR_PROVIDER" .env 2>/dev/null | sed 's/=.*/=***/' || echo "  (没有相关配置)"
else
  echo "❌ 没有 .env 文件"
fi
echo ""
echo "=== Node.js 检查 ==="
node -e "
require('dotenv').config();
console.log('通过 dotenv 读取:');
console.log('  USE_TURSO:', process.env.USE_TURSO || '(未设置)');
console.log('  数据库类型:', process.env.USE_TURSO ? 'Turso' : 'Local SQLite');
" 2>&1
echo ""
echo "=================================="
