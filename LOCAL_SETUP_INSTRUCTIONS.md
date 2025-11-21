# 本地环境设置说明

## ⚠️ 重要提示

你现在在 **Sculptor 沙箱环境**中，这是一个隔离的开发环境。要运行 Next.js 网站，你需要在**本地电脑**上进行以下操作。

## 📋 前置要求

确保你的本地电脑已安装：
- **Node.js** (推荐 v18 或更高版本)
- **npm** (通常随 Node.js 一起安装)

检查是否已安装：
```bash
node --version   # 应该显示 v18.x.x 或更高
npm --version    # 应该显示 9.x.x 或更高
```

如果没有安装，请访问：https://nodejs.org/

## 🚀 本地运行步骤

### 1. 同步代码到本地

使用 Sculptor 的同步功能将代码同步到你的本地 IDE：

```bash
# 在 Sculptor CLI 中
/sync
```

这会将所有代码从沙箱同步到你的本地仓库。

### 2. 在本地终端中运行

打开你的本地终端（不是 Sculptor 终端），进入项目目录：

```bash
cd /path/to/your/project/website
```

### 3. 安装依赖

```bash
npm install
```

这会安装所有需要的包（React, Next.js, TypeScript 等）。

### 4. 启动开发服务器

```bash
npm run dev
```

你应该看到类似这样的输出：
```
  ▲ Next.js 15.1.0
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000

 ✓ Ready in 2.5s
```

### 5. 访问网站

打开浏览器访问：
- 中文版：http://localhost:3000/zh
- 英文版：http://localhost:3000/en

## 🔍 故障排除

### 问题 1: "没有任何活动"

**原因**：数据库路径配置问题

**解决方法**：检查数据库文件是否存在

```bash
# 在项目根目录
ls -la data/events.db
```

如果数据库文件存在但网站还是没有活动，检查终端输出是否有数据库连接错误。

### 问题 2: "Cannot find module 'better-sqlite3'"

**原因**：依赖没有正确安装

**解决方法**：
```bash
cd website
rm -rf node_modules package-lock.json
npm install
```

### 问题 3: 编译错误

**原因**：TypeScript 或依赖版本问题

**解决方法**：
```bash
cd website
npm run build  # 检查是否有编译错误
```

如果有错误，查看具体的错误信息并修复。

### 问题 4: 端口已被占用

**错误信息**：`Error: Port 3000 is already in use`

**解决方法**：
```bash
# 使用其他端口
npm run dev -- -p 3001

# 或者杀掉占用端口的进程
lsof -ti:3000 | xargs kill -9
```

## 📊 验证数据库

在本地运行网站之前，可以先验证数据库：

```bash
# 在项目根目录
sqlite3 data/events.db "SELECT COUNT(*) FROM events;"
```

应该显示 252（或其他数字）。

查看本周和下周的活动：
```bash
sqlite3 data/events.db "
SELECT
  week_identifier,
  COUNT(*) as count
FROM events
GROUP BY week_identifier
ORDER BY week_identifier DESC
LIMIT 5;
"
```

## 🎯 测试反馈功能

网站运行后：

1. **测试反馈组件**
   - 滚动到活动列表底部
   - 点击 👍 或 👎 测试反馈提交
   - 打开浏览器开发者工具（F12）查看 Network 标签
   - 应该看到 POST 请求到 `/api/feedback`

2. **测试偏好记忆**
   - 选择筛选器（地区、类型等）
   - 关闭浏览器标签
   - 重新打开网站
   - 应该自动应用之前的筛选器

3. **查看收集的反馈**
   ```bash
   sqlite3 data/events.db "SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 5;"
   ```

## 📁 项目结构

```
项目根目录/
├── data/
│   └── events.db          # SQLite 数据库
├── website/               # Next.js 网站
│   ├── app/
│   │   ├── api/
│   │   │   └── feedback/  # 反馈 API
│   │   ├── components/    # React 组件
│   │   ├── hooks/         # React Hooks
│   │   └── [locale]/      # 多语言页面
│   ├── lib/               # 工具函数
│   ├── messages/          # 翻译文件
│   └── package.json       # 依赖配置
├── src/                   # 爬虫脚本
└── *.md                   # 文档
```

## 🌐 生产环境部署

如果要部署到生产环境（如 Vercel）：

```bash
cd website
npm run build
npm run start
```

或直接部署到 Vercel：
```bash
cd website
npx vercel
```

## 💡 提示

1. **开发服务器会自动热重载**：修改代码后无需手动重启
2. **数据库是只读的**：网站不会修改 events 表，只会写入反馈表
3. **反馈数据存储在本地**：user_feedback 表在你的本地数据库中

## 📞 需要帮助？

如果遇到问题：

1. 检查终端输出的错误信息
2. 查看浏览器控制台（F12）的错误
3. 确认数据库文件存在且可访问
4. 确认 Node.js 版本 >= 18

## 🎉 下一步

网站运行成功后，你可以：

- 查看实时活动列表
- 测试反馈功能
- 收集真实用户反馈
- 分析用户偏好数据
- 根据反馈优化活动推荐

---

**注意**：Sculptor 沙箱环境主要用于代码开发，不用于运行 Node.js 应用。所有 Next.js 网站都应该在本地或生产环境中运行。
