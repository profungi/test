# 🔀 混合开发模式指南

## 问题背景

在使用 dev container 时遇到架构冲突：
- **本地机器**: macOS ARM64 (Apple Silicon)
- **Dev Container**: Linux x86_64
- **问题**: `node_modules` 中的二进制文件不兼容

错误示例：
```
Cannot find module '../lightningcss.darwin-arm64.node'
```

## 💡 解决方案：Docker Volumes 隔离

我们使用 **Docker Volumes** 来完全隔离容器和本地的 `node_modules`：

```
本地机器 (macOS ARM64)              Dev Container (Linux x86_64)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/project/                           /workspace/
├── src/                      ←→    ├── src/                 (共享)
├── package.json              ←→    ├── package.json         (共享)
├── node_modules/             ✗     ├── node_modules/        (Docker Volume，独立)
│   └── *darwin-arm64.node          │   └── *linux-x64.node
└── website/                        └── website/
    ├── src/                  ←→        ├── src/             (共享)
    └── node_modules/         ✗         └── node_modules/    (Docker Volume，独立)
        └── *darwin-arm64.node            └── *linux-x64.node
```

**关键点**：
- ✅ 源代码文件：双向同步
- ✅ 配置文件：双向同步
- ❌ `node_modules`：完全隔离，各自独立

## 🚀 使用流程

### 场景 1：本地开发（不使用容器）

这是你开发网站的主要方式：

```bash
# 1. 确保不在 dev container 中
# 在 VS Code: 左下角应该显示你的本地路径，而不是 "Dev Container"
# 如果在容器中，按 F1 -> "Reopen Folder Locally"

# 2. 清理并重新安装依赖（只需第一次）
rm -rf node_modules website/node_modules
npm install
cd website && npm install

# 3. 开发网站
cd website
npm run dev

# 4. 访问 http://localhost:3000
# ✅ 正常工作，所有二进制文件都是 macOS 版本
```

**优点**：
- ✅ 网站正常运行
- ✅ 热重载快速
- ✅ 没有架构冲突
- ✅ 性能最佳（原生 macOS）

### 场景 2：使用 Dev Container（可选，用于测试）

只在需要测试 Linux 环境时使用：

```bash
# 1. 在 VS Code 中
# F1 -> "Dev Containers: Reopen in Container"

# 2. 等待容器启动
# 容器会自动安装 Linux 版本的依赖到 Docker Volumes

# 3. 在容器内运行
npm run scrape              # 测试爬虫
cd website && npm run dev   # 测试网站（Linux 环境）

# 4. 完成后退出容器
# F1 -> "Reopen Folder Locally"
```

**注意**：
- 容器内的 `node_modules` 在 Docker Volume 中
- 不会影响本地的 `node_modules`
- 退出容器后，本地开发继续正常

### 场景 3：Sculptor Agent（自动使用容器）

Sculptor 会自动使用 dev container 配置：

```
Sculptor Agent 工作流程：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 克隆你的 Git 仓库到 /code
2. 检测到 .devcontainer/devcontainer.json
3. 构建 Docker 镜像（第一次，或使用缓存）
4. 创建 Docker Volumes 用于 node_modules
5. 运行 postCreateCommand (npm ci)
6. 开始执行任务

node_modules 位置：
- /code/node_modules          → Docker Volume
- /code/website/node_modules  → Docker Volume

✅ 完全独立，不影响你的本地环境
✅ 使用 Linux 版本的二进制文件
✅ 快速启动（镜像缓存 + Docker Volumes）
```

## 📋 工作流程总结

### 日常开发网站

```bash
# 始终在本地环境（不使用容器）
cd /your/project
cd website
npm run dev

# 编辑代码，查看热重载
# Git commit & push
```

**永远不要在容器中开发网站**（除非你想测试 Linux 环境）

### 测试爬虫功能

```bash
# 可以在本地或容器中
npm run scrape

# 本地运行：使用 macOS 版本的 Puppeteer
# 容器运行：使用 Linux 版本的 Puppeteer
# 两者都可以工作
```

### 使用 Sculptor

```bash
# 1. 本地开发和测试
git add .
git commit -m "更新功能"
git push origin master

# 2. 创建 Sculptor agent
# Sculptor 自动使用 dev container 配置
# 快速启动（1-2分钟而不是 4-5分钟）

# 3. Agent 在独立的 Docker 环境中运行
# 完全不影响你的本地开发
```

## 🔧 配置说明

### devcontainer.json 关键配置

```json
{
  "mounts": [
    // Docker Volumes for node_modules
    "source=bay-area-events-node-modules,target=/workspace/node_modules,type=volume",
    "source=bay-area-events-website-node-modules,target=/workspace/website/node_modules,type=volume"
  ]
}
```

这告诉 Docker：
1. 创建两个独立的 volumes
2. 将它们挂载到容器的 `node_modules` 目录
3. 本地的 `node_modules` 目录被"覆盖"（只在容器内）
4. 容器关闭后，volumes 保留（加速下次启动）

### .gitignore 配置

```gitignore
node_modules/           # ✅ 已配置
website/node_modules/   # ✅ 已配置
```

确保 `node_modules` 不会被提交到 Git。

## ⚠️ 常见问题

### Q1: 我在容器中修改了依赖，本地需要同步吗？

**A**: 不需要！它们是完全独立的。

- 容器中：`package.json` 改变 → 容器内 `npm install`
- 本地：`package.json` 改变 → 本地 `npm install`

### Q2: Docker Volumes 在哪里？

**A**: 在 Docker 的内部存储中，你不需要关心。

```bash
# 查看 volumes（可选）
docker volume ls | grep bay-area-events

# 清理 volumes（如果需要重新开始）
docker volume rm bay-area-events-node-modules
docker volume rm bay-area-events-website-node-modules
```

### Q3: 为什么不把整个项目放在 Docker Volume 中？

**A**: 因为我们需要源代码同步！

- ✅ 源代码需要同步：你在本地编辑，容器立即看到
- ❌ node_modules 不需要同步：它们有架构差异

### Q4: 我应该什么时候使用容器？

**A**: 几乎从不！

- **本地开发网站**: ❌ 不要用容器
- **本地测试爬虫**: 可选（本地或容器都行）
- **Sculptor Agent**: ✅ 自动使用容器（你不需要做任何事）

### Q5: 容器启动后，npm install 很慢怎么办？

**A**: 第一次会慢，因为要安装所有依赖到 Docker Volume。之后会快很多：

- 第一次：`npm ci` 完整安装（1-2分钟）
- 第二次：增量更新（10-30秒）
- Docker Volume 保留了 node_modules，类似本地缓存

### Q6: 我的本地 node_modules 和容器的会冲突吗？

**A**: 绝对不会！

```bash
本地文件系统:
/project/node_modules/     ← 本地看到的
  └── lightningcss.darwin-arm64.node

容器内（Docker Volume）:
/workspace/node_modules/   ← 容器看到的（不同的存储！）
  └── lightningcss.linux-x64-gnu.node

两者完全独立，互不干扰！
```

## 🎯 最佳实践

### ✅ 推荐做法

1. **本地开发**: 始终在本地环境运行 `npm run dev`
2. **定期提交**: Git commit & push
3. **使用 Sculptor**: 让它使用 dev container（自动）
4. **忽略容器**: 除非测试，否则不要手动进入容器

### ❌ 避免做法

1. **不要**在容器中长期开发网站
2. **不要**手动复制 node_modules
3. **不要**删除 Docker Volumes（除非重新开始）
4. **不要**提交 node_modules 到 Git

## 📊 性能对比

| 场景 | 本地 macOS | Dev Container | Sculptor Agent |
|------|-----------|---------------|----------------|
| **网站热重载** | ⚡ 极快 | 🐢 慢（不推荐） | N/A |
| **爬虫运行** | ⚡ 快 | ⚡ 快 | ⚡ 快 |
| **npm install** | ⚡ 快 | 🐢 较慢（首次） | ⚡ 快（缓存） |
| **启动时间** | ⚡ 即时 | 🐢 10-30秒 | ⚡ 1-2分钟 |

## 🎉 总结

使用这个混合开发模式，你可以：

- ✅ 在本地正常开发网站（无冲突）
- ✅ Sculptor 快速启动 agent（1-2分钟）
- ✅ 完全隔离的环境（互不干扰）
- ✅ 无需手动管理 node_modules

**记住**：
- 本地开发 = 不用容器
- Sculptor = 自动用容器（快速启动）
- 一切都是自动的！
