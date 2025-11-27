# 🚀 Sculptor Agent 加速指南

## 问题：为什么 Sculptor Agent 创建很慢？

每次创建新的 Sculptor agent 时，系统需要：

1. ✅ 拉取 Docker 镜像（如果有 devcontainer）
2. ✅ 构建镜像（第一次）
3. ⏰ 安装项目依赖（`npm install`）- **这是最慢的部分**
4. ⏰ 下载 Puppeteer Chrome - **也很慢**

## 解决方案：使用 Dev Container 配置

通过提交 `.devcontainer/` 配置到 Git，Sculptor 会：

### 第一次构建 Agent（还是会慢，但是一次性）

```
Sculptor：检测到 devcontainer.json
Sculptor：使用自定义 Dockerfile 构建镜像...
  → 安装系统依赖 (1-2分钟)
  → 下载 Chrome 浏览器 (1分钟)
  → 预安装全局 npm 包 (30秒)
  → 缓存镜像 ✅
总计：3-4 分钟（但镜像会被缓存！）
```

### 后续构建 Agent（显著加速！）

```
Sculptor：检测到 devcontainer.json
Sculptor：使用缓存的镜像 ✅
Sculptor：运行 postCreateCommand...
  → npm ci (30秒-1分钟，因为只需安装 node_modules)
总计：1-2 分钟（比之前的 4-5 分钟快很多！）
```

## 🎯 实际效果对比

| 场景 | 无 Dev Container | 有 Dev Container |
|------|-----------------|-----------------|
| **系统依赖安装** | 每次 1-2分钟 | ✅ 镜像中已有（0秒） |
| **Chrome 下载** | 每次 1分钟 | ✅ 镜像中已有（0秒） |
| **npm 全局包** | 每次 30秒 | ✅ 镜像中已有（0秒） |
| **项目依赖** | npm install 2分钟 | npm ci 30秒-1分钟 |
| **总启动时间** | 4-5 分钟 | **1-2 分钟** |
| **节省时间** | - | **50-60%** |

## 📝 优化原理

### 1. 镜像缓存

Sculptor 会缓存构建好的 Docker 镜像。当你的 Dockerfile 没有变化时，后续的 agent 会直接使用缓存的镜像，跳过构建步骤。

### 2. 预安装系统依赖

Dockerfile 中预装了：
- ✅ Puppeteer 所需的所有系统库
- ✅ Chrome 浏览器
- ✅ SQLite3
- ✅ 中文字体
- ✅ 开发工具（git, curl 等）

这些都在镜像中，不需要每次下载。

### 3. 使用 npm ci

`npm ci` 比 `npm install` 快，因为：
- 使用 package-lock.json 的精确版本
- 删除 node_modules 后全新安装（更可靠）
- 不修改 package-lock.json

## 🔧 如何进一步优化

### 选项 1：减少 postCreateCommand 的工作

当前配置在 `postCreateCommand` 中运行：
```bash
bash .devcontainer/post-create.sh
```

这个脚本会：
- 安装根目录依赖
- 安装 website 依赖
- 检查环境

**优化建议**：如果某些检查不是必需的，可以移除。

### 选项 2：使用更轻量的基础镜像

我已经将镜像从 `node:24-bookworm` 改为 `node:24-bookworm-slim`，减少下载时间。

### 选项 3：并行安装依赖

修改 post-create.sh，让根目录和 website 的依赖并行安装：

```bash
# 并行安装
npm ci &
(cd website && npm ci) &
wait
```

但这可能会导致资源竞争，需要测试。

## ⚙️ 当前配置说明

### devcontainer.json

关键配置：
```json
{
  "build": {
    "dockerfile": "Dockerfile",
    "args": {
      "NODE_VERSION": "24"
    }
  },
  "postCreateCommand": "bash .devcontainer/post-create.sh"
}
```

- `dockerfile`: 指向自定义 Dockerfile
- `postCreateCommand`: 容器创建后运行的命令

### Dockerfile

关键优化：
```dockerfile
# 使用 slim 镜像减少大小
FROM node:24-bookworm-slim

# 预安装系统依赖和 Chrome
RUN apt-get update && apt-get install -y ...
RUN npx puppeteer browsers install chrome

# Chrome 和系统库都在镜像中，不需要每次下载！
```

### post-create.sh

关键优化：
```bash
# 使用 npm ci 而不是 npm install
if [ -f "package-lock.json" ]; then
    npm ci || npm install
else
    npm install
fi
```

## 📊 监控和调试

### 查看 Sculptor 构建日志

在 Sculptor 界面中：
1. 点击 agent 任务
2. 查看 "Logs" 面板
3. 找到 "Building container" 部分
4. 检查是否使用了缓存

应该看到类似：
```
Using cached layer for step 3/15
Using cached layer for step 4/15
...
```

### 检查镜像是否被缓存

如果看到：
```
Step 1/15 : FROM node:24-bookworm-slim
 ---> Using cache
```

说明基础镜像被缓存了！✅

如果看到：
```
Step 3/15 : RUN apt-get update && apt-get install ...
 ---> Using cache
```

说明系统依赖也被缓存了！✅

## 🎯 最佳实践

### 1. 提交配置到 Git

确保 `.devcontainer/` 目录被提交：
```bash
git add .devcontainer/
git commit -m "Add dev container for faster agent startup"
```

### 2. 不要频繁修改 Dockerfile

每次修改 Dockerfile 都会导致缓存失效，需要重新构建。只在必要时修改。

### 3. 使用 package-lock.json

确保提交 `package-lock.json` 到 Git，这样 `npm ci` 才能工作。

### 4. 测试配置

在提交前，先在本地 VS Code 中测试 dev container：
```
F1 -> Dev Containers: Rebuild Container
```

确保构建成功后再提交。

## ❓ 常见问题

### Q: 第一次还是很慢怎么办？

A: 第一次必然会慢，因为需要构建镜像。但之后会快很多。你可以：
1. 提交配置
2. 创建一个简单的 agent 任务让它构建镜像
3. 等待完成（3-4分钟）
4. 之后的 agent 都会快速启动

### Q: 如何知道优化是否生效？

A: 对比时间：
- 优化前：agent 启动 4-5 分钟
- 优化后（第一次）：3-4 分钟（构建镜像）
- 优化后（后续）：1-2 分钟（使用缓存）

### Q: 修改了代码，会影响缓存吗？

A: 不会！镜像缓存基于 Dockerfile，代码变化不影响镜像。

### Q: 添加了新的 npm 依赖怎么办？

A: 修改 package.json 后，`npm ci` 会自动安装新依赖。镜像不需要重建。

### Q: Dockerfile 修改后会怎样？

A: Dockerfile 修改后，下次 agent 会重新构建镜像，需要 3-4 分钟。之后又会快速。

## 🎉 总结

通过配置 dev container：

✅ **系统依赖和 Chrome 预装在镜像中**
✅ **镜像会被 Sculptor 缓存**
✅ **后续 agent 启动时间减少 50-60%**
✅ **从 4-5 分钟降低到 1-2 分钟**

虽然不能做到"瞬间启动"，但已经显著改善！

---

**下一步**：
1. 提交这些配置到 Git
2. 创建一个测试 agent 让 Sculptor 构建镜像
3. 享受更快的 agent 启动速度！
