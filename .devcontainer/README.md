# Dev Container 配置说明

这个 dev container 为 Bay Area Events Scraper 项目提供了一个完整的、隔离的开发环境。

## 🚀 快速开始

### 前置条件

1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. 安装 [VS Code](https://code.visualstudio.com/)
3. 安装 VS Code 扩展: [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### 启动 Dev Container

1. 在 VS Code 中打开项目
2. 按 `F1` 或 `Cmd/Ctrl + Shift + P` 打开命令面板
3. 输入并选择 `Dev Containers: Reopen in Container`
4. 等待容器构建和启动（首次构建需要几分钟）

或者点击左下角的绿色图标，选择 "Reopen in Container"。

## 📦 包含的内容

### 系统环境

- **Node.js**: v24 (与项目要求匹配)
- **npm**: 最新版本
- **SQLite3**: 用于数据库操作
- **Chrome/Chromium**: Puppeteer 自动安装

### 预装工具

- `nodemon`: 自动重启开发服务器
- `pm2`: 进程管理器
- `typescript`: TypeScript 编译器
- `git`: 版本控制
- `github-cli`: GitHub 命令行工具

### VS Code 扩展

自动安装的扩展包括：

- **JSON 支持**: ZainChen.json
- **SQLite 工具**:
  - alexcvzz.vscode-sqlite (查询和管理)
  - qwtel.sqlite-viewer (可视化查看)
- **代码质量**:
  - ESLint (代码检查)
  - Prettier (代码格式化)
- **React/Next.js 开发**:
  - ES7 React Snippets
  - Styled Components
- **通用工具**:
  - GitLens (Git 增强)
  - Docker (容器管理)
  - npm/path IntelliSense

### Puppeteer 支持

容器已经预配置了运行 Puppeteer 所需的所有依赖：

- Chrome 浏览器和驱动
- 所需的系统库
- 正确的安全选项 (`--no-sandbox`, `--disable-setuid-sandbox`)

### 中文支持

安装了中文字体（Noto CJK, WQY 等），支持生成包含中文的图片和 PDF。

## 🔧 使用方法

### 开发爬虫

```bash
# 在容器内的终端运行
npm run scrape
npm run generate-post ./output/review_2024-XX-XX_XXXX.json
```

### 开发网站

```bash
# 切换到网站目录
cd website

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

端口 3000 会自动转发到你的本地机器，你可以在浏览器中直接访问。

### 数据库操作

```bash
# 使用 SQLite CLI
sqlite3 data/events.db

# 或者使用 VS Code 的 SQLite 扩展
# 右键点击 .db 文件 -> "Open Database"
```

### 查看容器日志

容器启动时会自动：
1. 安装项目根目录的依赖 (`npm install`)
2. 安装网站目录的依赖 (`cd website && npm install`)

## 🎯 环境变量

容器会自动加载项目根目录的 `.env` 文件。确保你已经配置了：

```env
# 复制 .env.example 到 .env
cp .env.example .env

# 然后编辑 .env 添加你的 API keys
SHORTIO_API_KEY=your_key_here
AI_PROVIDER=openai
OPENAI_API_KEY=your_key_here
# ... 其他配置
```

## 🏗️ 架构细节

### 时区设置

容器默认使用 `America/Los_Angeles` (太平洋时间)，与湾区活动相匹配。

### 用户权限

容器使用 `node` 用户（非 root）运行，提高安全性。文件权限已正确配置。

### 性能优化

- `node_modules` 使用 Docker volume 缓存，避免重复安装
- 使用 `consistency=cached` 选项优化文件系统性能
- Puppeteer Chrome 在构建时预下载，加速启动

## 🔄 常见任务

### 重建容器

如果需要更新依赖或修改了 Dockerfile：

1. `F1` -> `Dev Containers: Rebuild Container`
2. 或者 `Dev Containers: Rebuild Container Without Cache` (完全重建)

### 停止容器

1. `F1` -> `Dev Containers: Reopen Folder Locally`
2. 或关闭 VS Code

### 清理旧镜像

```bash
# 在本地终端（不是容器内）
docker system prune -a
```

## 🐛 故障排查

### 问题：容器启动很慢

**原因**: 首次构建需要下载镜像和安装所有依赖。

**解决**: 耐心等待。后续启动会快很多（通常 < 30 秒）。

### 问题：Puppeteer 无法启动浏览器

**解决**: 检查 `runArgs` 中的安全选项是否正确配置在 `devcontainer.json` 中。

### 问题：端口 3000 已被占用

**解决**:
- 停止本地运行的服务
- 或修改 `devcontainer.json` 中的 `forwardPorts` 为其他端口

### 问题：npm install 失败

**解决**:
1. 检查网络连接
2. 尝试重建容器: `Dev Containers: Rebuild Container`
3. 检查 package.json 是否有语法错误

## 📚 更多资源

- [VS Code Dev Containers 文档](https://code.visualstudio.com/docs/devcontainers/containers)
- [Docker 最佳实践](https://docs.docker.com/develop/dev-best-practices/)
- [Puppeteer in Docker](https://pptr.dev/troubleshooting#running-puppeteer-in-docker)

## 🎉 享受开发！

现在你有了一个完全配置好的开发环境，可以立即开始开发，无需担心依赖问题！
