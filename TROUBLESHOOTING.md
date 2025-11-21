# 故障排查指南

## 已修复的问题

### ✅ 修复 1: Suspense 边界

**问题**: Internal Server Error - `useSearchParams` 必须被 Suspense 包裹

**修复**: 已在 `app/[locale]/page.tsx` 中添加 Suspense 边界包裹 `FeedbackSection` 组件

**改动**:
```typescript
<Suspense fallback={<div className="mt-8 text-center text-gray-500">Loading...</div>}>
  <FeedbackSection eventsCount={events.length} />
</Suspense>
```

## 验证步骤

### 1. 重启开发服务器

```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
cd website
npm run dev
```

### 2. 清除 Next.js 缓存（如果问题仍存在）

```bash
cd website
rm -rf .next
npm run dev
```

### 3. 访问调试端点

打开浏览器访问：
```
http://localhost:3000/api/debug
```

你应该看到类似这样的 JSON 响应：
```json
{
  "cwd": "/path/to/project/website",
  "dbPath": "/path/to/project/data/events.db",
  "dbExists": true,
  "nodeVersion": "v18.x.x",
  "platform": "darwin",
  "env": "development",
  "dbConnection": "SUCCESS",
  "eventsCount": 252
}
```

### 4. 访问主页

```
http://localhost:3000/zh
```

应该能看到活动列表和反馈组件。

## 常见错误及解决方案

### 错误 1: "Cannot find module 'better-sqlite3'"

**解决方法**:
```bash
cd website
npm install better-sqlite3 --save
```

### 错误 2: "Database file not found"

**原因**: 数据库路径不正确

**检查**:
```bash
# 在项目根目录
ls -la data/events.db
```

**解决方法**: 确保在项目根目录有 `data/events.db` 文件

### 错误 3: "useSearchParams() should be wrapped in a suspense boundary"

**状态**: ✅ 已修复

**验证**: 查看 `website/app/[locale]/page.tsx` 确认有 Suspense 包裹

### 错误 4: TypeScript 编译错误

**解决方法**:
```bash
cd website
npm run build
```

查看具体的错误信息并修复。

### 错误 5: 端口被占用

**错误信息**: `Port 3000 is already in use`

**解决方法**:
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# 或使用其他端口
npm run dev -- -p 3001
```

## 检查列表

重启服务器前，确认：

- [ ] `website/.next` 目录已删除（清除缓存）
- [ ] `data/events.db` 文件存在
- [ ] `website/node_modules` 已安装
- [ ] Node.js 版本 >= 18
- [ ] 没有其他进程占用 3000 端口

## 查看日志

### 服务器日志

开发服务器终端会显示：
- ✅ 正常: `✓ Ready in X.Xs`
- ✅ 正常: `○ Compiling / ...`
- ❌ 错误: 会显示具体的错误堆栈

### 浏览器控制台

按 F12 打开开发者工具：
- **Console** 标签: 查看 JavaScript 错误
- **Network** 标签: 查看 API 请求是否成功
- **Application** 标签 → Local Storage: 查看保存的偏好

## 逐步调试

### 步骤 1: 测试数据库连接

```bash
cd /code
./test-feedback-api.sh
```

应该显示：
```
✅ Database found
✅ user_feedback table exists
✅ user_preferences table exists
```

### 步骤 2: 测试 API 端点

```bash
# 启动服务器后
curl http://localhost:3000/api/debug
```

检查 `dbConnection` 字段是否为 `SUCCESS`。

### 步骤 3: 测试主页面

访问 http://localhost:3000/zh

**预期结果**:
- 看到活动列表（71 个活动，如果查看下周）
- 滚动到底部看到反馈组件
- 组件显示："这些活动对你有帮助吗？👍 👎"

### 步骤 4: 测试反馈提交

1. 点击 👍 按钮
2. 打开浏览器开发者工具 → Network 标签
3. 应该看到一个 POST 请求到 `/api/feedback`
4. 状态码应该是 200
5. 响应应该包含 `"success": true`

### 步骤 5: 验证数据已保存

```bash
sqlite3 data/events.db "SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 1;"
```

应该看到刚才提交的反馈。

## 获取帮助

如果问题仍然存在，请提供：

1. **错误信息**: 终端中的完整错误堆栈
2. **浏览器控制台**: F12 → Console 中的错误
3. **调试信息**: http://localhost:3000/api/debug 的输出
4. **Node 版本**: `node --version` 的输出
5. **操作系统**: macOS / Windows / Linux

### 示例错误报告

```
环境信息:
- Node.js: v18.17.0
- npm: 9.6.7
- 操作系统: macOS 14.0
- 浏览器: Chrome 120

错误信息:
[终端输出复制到这里]

浏览器控制台:
[控制台错误复制到这里]

调试端点输出:
[/api/debug 的 JSON 输出]
```

## 成功标志

当一切正常时，你应该看到：

✅ 终端显示 `✓ Ready in X.Xs`
✅ 浏览器显示活动列表
✅ 反馈组件在列表底部
✅ 点击反馈按钮有响应
✅ Network 标签显示 API 请求成功
✅ 数据库中保存了反馈记录

## 联系支持

如果以上步骤都无法解决问题，请在 GitHub 上提 issue 或联系开发者。
