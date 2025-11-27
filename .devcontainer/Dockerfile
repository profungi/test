# 使用官方 Node.js 24 镜像作为基础
# 使用 slim 版本减少镜像大小，加速下载
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim

# 避免交互式提示
ENV DEBIAN_FRONTEND=noninteractive

# 更新包列表并安装必要的系统依赖
# 使用单个 RUN 命令减少层数，加速构建
RUN apt-get update && apt-get install -y --no-install-recommends \
    # 基础工具
    git \
    curl \
    wget \
    ca-certificates \
    # SQLite3 和开发库
    sqlite3 \
    libsqlite3-dev \
    # Puppeteer 和 Chrome 依赖
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    # 额外的浏览器依赖
    libu2f-udev \
    libvulkan1 \
    # 中文字体支持（小红书内容相关）
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    # 清理
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 设置时区为太平洋时间（湾区）
ENV TZ=America/Los_Angeles
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 创建非 root 用户（安全最佳实践）
ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# 确保 node 用户存在（基础镜像已创建）
RUN groupmod --gid $USER_GID $USERNAME \
    && usermod --uid $USER_UID --gid $USER_GID $USERNAME \
    && chown -R $USER_UID:$USER_GID /home/$USERNAME

# 配置 npm 全局安装路径（避免权限问题）
RUN mkdir -p /home/$USERNAME/.npm-global \
    && chown -R $USERNAME:$USERNAME /home/$USERNAME/.npm-global

ENV NPM_CONFIG_PREFIX=/home/$USERNAME/.npm-global
ENV PATH=/home/$USERNAME/.npm-global/bin:$PATH

# 安装常用的全局 npm 包
RUN npm install -g \
    npm@latest \
    nodemon \
    pm2 \
    typescript

# 设置工作目录
WORKDIR /workspace

# 为 Puppeteer 设置环境变量
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 预安装 Puppeteer 的 Chrome（加速首次启动）
# 这会在构建时下载 Chrome，避免每次创建容器时下载
RUN npx puppeteer browsers install chrome || true

# 🚀 Sculptor 优化说明：
# 项目依赖会在 postCreateCommand 中安装
# 但 Chrome 和系统依赖已经预装在镜像中，这能节省大量时间

# 切换到 node 用户
USER $USERNAME

# 设置 shell 为 bash
ENV SHELL=/bin/bash

# 健康检查（确保 Node.js 可用）
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# 默认命令
CMD ["/bin/bash"]
