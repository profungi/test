# 使用官方 Node.js 24 镜像作为基础
# 使用标准版本（包含更多工具）以便安装 Chromium
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm

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
    # 安装 Chromium（Debian 提供 ARM64 版本）
    chromium \
    chromium-driver \
    # Puppeteer 和 Chrome 依赖
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

# 给 node 用户 sudo 权限（Dev Container 需要）
RUN apt-get update && apt-get install -y sudo \
    && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME \
    && rm -rf /var/lib/apt/lists/*

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
# 跳过下载 Chrome，使用系统的 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 🚀 Sculptor 优化说明：
# 使用系统的 Chromium 而不是 Puppeteer 下载的 Chrome
# 这样可以在 ARM64 系统上正常工作

# 切换到 node 用户（在安装 Chrome 之前切换）
USER $USERNAME

# 设置 Puppeteer 缓存路径为 node 用户的 home 目录
ENV PUPPETEER_CACHE_DIR=/home/$USERNAME/.cache/puppeteer

# 注意：Chrome 会在 post-create.sh 中安装（有网络保证）
# 这里不预装是为了避免构建时的网络问题

# 设置 shell 为 bash
ENV SHELL=/bin/bash

# 健康检查（确保 Node.js 可用）
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# 默认命令
CMD ["/bin/bash"]
