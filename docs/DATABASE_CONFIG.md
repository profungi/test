# 数据库配置指南

## 两种数据库选项

本项目支持两种数据库：

1. **本地 SQLite**（默认）
   - 文件路径：`./data/events.db`
   - 适合：本地开发、测试
   - 优点：简单、快速、无需配置
   - 缺点：只在本地，无法共享

2. **Turso 云数据库**（可选）
   - 适合：生产环境、多人协作
   - 优点：云端存储、可共享、自动备份
   - 缺点：需要配置、需要网络

## 如何选择数据库

### 方式 1: 使用 .env 文件（推荐）

创建 `.env` 文件在项目根目录：

```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env 文件
nano .env
```

在 `.env` 文件中设置：

```bash
# 使用本地 SQLite（默认）
# 不需要设置任何变量，或者注释掉 USE_TURSO

# 使用 Turso 数据库
USE_TURSO=1
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

### 方式 2: 使用环境变量

```bash
# 使用本地 SQLite
npm run scrape

# 使用 Turso
USE_TURSO=1 npm run scrape
```

## 配置一致性

**重要**：确保所有脚本使用相同的数据库配置。

以下脚本都会读取 `.env` 文件：
- ✅ `node src/scrape-events.js` (scraper)
- ✅ `node translate-missing.js` (翻译工具)
- ✅ `node src/generate-post.js` (生成帖子)

如果你在 `.env` 中设置了 `USE_TURSO=1`，**所有脚本**都会使用 Turso 数据库。

## 当前状态检查

检查你当前使用的是哪个数据库：

```bash
# 检查环境变量
node -e "require('dotenv').config(); console.log('USE_TURSO:', process.env.USE_TURSO); console.log('Database:', process.env.USE_TURSO ? 'Turso' : 'Local SQLite')"

# 检查本地数据库记录数
sqlite3 data/events.db "SELECT COUNT(*) as count FROM events;"

# 检查 Turso 数据库（如果配置了）
# 需要先安装 turso CLI: curl -sSfL https://get.tur.so/install.sh | bash
turso db shell your-database-name "SELECT COUNT(*) FROM events;"
```

## 获取 Turso 配置

如果你想使用 Turso 数据库，需要：

```bash
# 1. 安装 Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# 2. 登录
turso auth login

# 3. 创建数据库（如果还没有）
turso db create bay-area-events

# 4. 获取数据库 URL
turso db show bay-area-events --url

# 5. 创建认证令牌
turso db tokens create bay-area-events

# 6. 将 URL 和 Token 添加到 .env 文件
```

## 常见问题

### Q: 我的 scraper 和 translate-missing 使用不同的数据库怎么办？

A: 检查 `.env` 文件配置。两个脚本现在都会读取同一个 `.env` 文件，应该使用相同的数据库。

### Q: 我想在本地开发，但生产环境用 Turso？

A:
1. 本地开发：不设置 `USE_TURSO` 或设置为空
2. 生产环境：设置 `USE_TURSO=1`

### Q: 如何同步本地和 Turso 数据库？

A: 目前没有自动同步机制。你可以：
1. 选择一个主数据库（推荐 Turso）
2. 所有脚本都设置 `USE_TURSO=1` 使用同一个数据库
3. 或者手动导出/导入数据

### Q: 如何查看当前使用的是哪个数据库？

A: 运行脚本时会显示：
```
💾 数据库: 本地 SQLite
# 或
💾 数据库: Turso 云数据库
```

## 推荐配置

### 个人项目（单人使用）
```bash
# .env
# 不设置 USE_TURSO，使用本地 SQLite
```

### 团队协作或生产环境
```bash
# .env
USE_TURSO=1
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_token_here
```

## 验证配置

运行此命令验证所有脚本使用相同配置：

```bash
# 创建测试脚本
cat > check-db-config.js << 'EOF'
require('dotenv').config();
console.log('═══════════════════════════════════════');
console.log('数据库配置检查');
console.log('═══════════════════════════════════════');
console.log('USE_TURSO:', process.env.USE_TURSO || '(未设置)');
console.log('数据库类型:', process.env.USE_TURSO ? 'Turso 云数据库' : '本地 SQLite');
console.log('本地路径: ./data/events.db');
if (process.env.USE_TURSO) {
  console.log('Turso URL:', process.env.TURSO_DATABASE_URL || '(未设置)');
  console.log('Turso Token:', process.env.TURSO_AUTH_TOKEN ? '已设置 (' + process.env.TURSO_AUTH_TOKEN.substring(0, 20) + '...)' : '(未设置)');
}
console.log('═══════════════════════════════════════');
EOF

# 运行检查
node check-db-config.js
```
