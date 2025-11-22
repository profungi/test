#!/bin/bash

echo "🔍 网站连接诊断工具"
echo "===================="
echo ""

# 检查进程
echo "1️⃣ 检查 Next.js 进程是否运行..."
NEXT_PROCESS=$(ps aux | grep "next dev" | grep -v grep)
if [ -z "$NEXT_PROCESS" ]; then
  echo "   ❌ Next.js 开发服务器未运行"
  echo ""
  echo "   请在另一个终端运行："
  echo "   cd website && npm run dev"
  exit 1
else
  echo "   ✅ Next.js 进程正在运行"
  echo "   $NEXT_PROCESS"
fi

echo ""
echo "2️⃣ 检查端口占用情况..."
echo "   检查端口 3000-3005..."

for port in 3000 3001 3002 3003 3004 3005; do
  if lsof -i :$port > /dev/null 2>&1; then
    PROCESS=$(lsof -i :$port | tail -1)
    echo "   ✅ 端口 $port 被占用: $PROCESS"
  else
    echo "   ⚪ 端口 $port 空闲"
  fi
done

echo ""
echo "3️⃣ 尝试连接到服务器..."

for port in 3000 3001 3002 3003; do
  echo "   测试端口 $port..."

  # 测试根路径
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/ 2>/dev/null)
  if [ "$HTTP_CODE" != "000" ]; then
    echo "      GET / → HTTP $HTTP_CODE"
  fi

  # 测试 /zh 路径
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/zh 2>/dev/null)
  if [ "$HTTP_CODE" != "000" ]; then
    echo "      GET /zh → HTTP $HTTP_CODE"
    if [ "$HTTP_CODE" = "200" ]; then
      echo "      ✅ 成功！访问 http://localhost:$port/zh"
    fi
  fi

  # 测试 /en 路径
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/en 2>/dev/null)
  if [ "$HTTP_CODE" != "000" ]; then
    echo "      GET /en → HTTP $HTTP_CODE"
  fi
done

echo ""
echo "4️⃣ 检查防火墙和网络..."
if command -v netstat > /dev/null; then
  echo "   监听的端口:"
  netstat -an | grep LISTEN | grep -E ":(3000|3001|3002|3003)" || echo "   没有找到 3000-3003 端口在监听"
fi

echo ""
echo "===================="
echo "💡 诊断建议:"
echo ""
echo "如果看到 HTTP 200，但浏览器仍然无法访问："
echo "  1. 检查浏览器是否有代理设置"
echo "  2. 尝试清除浏览器缓存"
echo "  3. 尝试无痕模式访问"
echo "  4. 尝试其他浏览器"
echo "  5. 检查本地防火墙设置"
echo ""
echo "如果服务器未运行："
echo "  cd website && npm run dev"
echo ""
echo "查看服务器日志以获取更多信息"
