# Bay Area Events - 完整项目指南

## 📚 目录

1. [项目概述](#项目概述)
2. [架构演进](#架构演进)
3. [Vercel 部署配置](#vercel-部署配置)
4. [Turso 数据库设置](#turso-数据库设置)
5. [自动同步解决方案](#自动同步解决方案)
6. [完整使用指南](#完整使用指南)
7. [问题解决历史](#问题解决历史)
8. [文件清单](#文件清单)

---

## 项目概述

### 项目简介
Bay Area Events 是一个湾区活动聚合网站，包含：
- **Backend Scraper**: Node.js 抓取脚本，从多个数据源抓取活动
- **Frontend Website**: Next.js 15 网站（在 `website/` 目录）
- **Database**: Turso (LibSQL) 云数据库

### 技术栈
- **前端**: Next.js 15.5.6 + App Router + next-intl (中英文)
- **后端**: Node.js scraper
- **数据库**: Turso (LibSQL) - SQLite 兼容云数据库
- **部署**: Vercel (前端) + GitHub Actions (定时抓取)
- **AI**: OpenAI/Gemini/Claude (分类和翻译)

---

## 架构演进

### 第一阶段：本地开发 ❌
```
Scraper → 本地 SQLite ← Website (本地运行)
```

**问题**:
- Vercel 不支持持久化 SQLite 文件
- 无法直接部署到生产环境

### 第二阶段：Vercel + 手动同步 ⚠️
```
Scraper → 本地 SQLite → [手动导出导入] → Turso ← Vercel Website
```

**问题**:
- 每次抓取后需要手动同步:
  ```bash
  sqlite3 data/events.db .dump > events.sql
  turso db shell bay-area-events < events.sql
  ```
- 容易忘记，导致网站数据过时
- 不适合频繁更新

### 第三阶段：自动同步 ✅ (当前方案)
```
Scraper → Turso ← Vercel Website
           ↑
    (单一数据源)
```

**优势**:
- ✅ 抓取数据立即在 Turso 中可用
- ✅ 网站自动显示最新数据 (1小时 ISR 缓存)
- ✅ 无需任何手动操作
- ✅ 本地和生产环境共享同一数据库
- ✅ GitHub Actions 可直接写入 Turso

---

## Vercel 部署配置

### 1. Vercel 项目设置

在 Vercel Dashboard 中配置：

#### Root Directory
```
website
```

#### Build Command (使用默认)
```
npm run build
```

#### Environment Variables
```bash
# Turso 数据库
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...

# 其他环境变量（如需要）
NODE_ENV=production
```

### 2. 本地文件配置

#### website/.eslintrc.json
```json
{
  "extends": ["next/core-web-vitals", "next/typescript"]
}
```

**注意**: 删除 `eslint.config.mjs`，Vercel 构建需要传统格式配置。

#### website/.env.local (本地开发)
```bash
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

### 3. 已修复的 Vercel 部署问题

#### 问题 1: ESLint 配置错误
```
⨯ ESLint: Invalid Options: - Unknown options: useEslintrc, extensions
```

**解决**: 删除 `eslint.config.mjs`，使用 `.eslintrc.json`

#### 问题 2: TypeScript 类型错误
```
Type error: Property 'ip' does not exist on type 'NextRequest'
```

**解决**: 修改 `website/app/api/feedback/route.ts`
```javascript
// 之前
const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

// 修复后
const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';
```

#### 问题 3: Middleware 崩溃
```
500: MIDDLEWARE_INVOCATION_FAILED
```

**解决**: 在 `website/lib/db.ts` 中添加 Vercel 环境检测
```typescript
if (process.env.VERCEL || process.env.VERCEL_ENV) {
  console.warn('⚠️  Running in Vercel without database. Using demo mode.');
  return null;
}
```

#### 问题 4: 异步数据调用错误
```
TypeError: events.map is not a function
```

**解决**: 在 `website/app/[locale]/page.tsx` 中使用 `await`
```typescript
// 修复前
const events = getEvents(filters);  // ❌ 返回 Promise

// 修复后
const events = await getEvents(filters);  // ✅ 返回数组
const stats = await getStats();
```

---

## Turso 数据库设置

### 1. 安装 Turso CLI

```bash
# macOS (Homebrew)
brew install tursodatabase/tap/turso

# Linux/macOS (Shell)
curl -sSfL https://get.tur.so/install.sh | bash

# 验证安装
turso --version
```

### 2. 创建数据库

```bash
# 登录
turso auth signup  # 或 turso auth login

# 创建数据库
turso db create bay-area-events --location sfo

# 查看数据库信息
turso db show bay-area-events
```

### 3. 获取连接信息

```bash
# 获取数据库 URL
turso db show bay-area-events --url
# 输出: libsql://bay-area-events-xxx.turso.io

# 创建访问 token
turso db tokens create bay-area-events
# 输出: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

### 4. 导入数据库结构

```bash
# 方式 1: 从本地 SQLite 导入完整数据
sqlite3 data/events.db .dump > events.sql
turso db shell bay-area-events < events.sql

# 方式 2: 只导入表结构
sqlite3 data/events.db .schema > schema.sql
turso db shell bay-area-events < schema.sql
```

### 5. 验证数据库

```bash
# 进入交互式 shell
turso db shell bay-area-events

# 查看表
.tables

# 查看数据
SELECT COUNT(*) FROM events;
SELECT title, start_time FROM events ORDER BY scraped_at DESC LIMIT 5;

# 退出
.quit
```

---

## 自动同步解决方案

### 核心问题
"本地和 turso 不会自动同步的吗？我以后数据库都从本地变更的，并且网站修改也会很频繁，是不是每次都要手动上载数据？"

### 解决方案实现

#### 1. 安装依赖

```bash
# 在项目根目录
npm install @libsql/client
```

已安装版本: `@libsql/client@^0.15.15`

#### 2. 创建 Turso 适配器

**文件**: `src/utils/turso-database.js` (已存在)

实现了与 `src/utils/database.js` 相同的接口：
- `connect()` - 连接数据库
- `saveEvent(event)` - 保存活动（带去重）
- `updateEventTranslation(...)` - 更新翻译
- `logScrapingResult(...)` - 记录抓取日志
- `close()` - 关闭连接

关键特性：
- ✅ 异步操作 (使用 `async/await`)
- ✅ URL 去重（最快）
- ✅ 内容相似度去重（Levenshtein 距离）
- ✅ 跨周去重（不限制 week_identifier）

#### 3. 修改 Scraper 支持切换

**文件**: `src/scrape-events.js`

**修改 1**: 第 8-11 行 - 数据库选择逻辑
```javascript
// 根据环境变量选择数据库: Turso (生产) 或 SQLite (本地测试)
const EventDatabase = process.env.USE_TURSO
  ? require('./utils/turso-database')
  : require('./utils/database');
```

**修改 2**: 第 42-44 行 - 显示数据库类型
```javascript
const dbType = process.env.USE_TURSO ? 'Turso 云数据库' : '本地 SQLite';
console.log(`🚀 开始抓取湾区${weekText}活动...`);
console.log(`💾 数据库: ${dbType}\n`);
```

**修改 3**: 第 292-302 行 - 更新帮助文档
```
用法:
  USE_TURSO=1 npm run scrape               # 直接写入 Turso 数据库

环境变量:
  USE_TURSO=1              直接写入 Turso 云数据库 (推荐用于生产)
                           默认使用本地 SQLite (用于开发测试)
```

#### 4. 配置环境变量

**文件**: `.env.example` (第 38-46 行)

```bash
# Turso Database (可选 - 用于直接写入云数据库)
# 获取方法:
#   turso db show bay-area-events --url
#   turso db tokens create bay-area-events
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...

# 使用 Turso 数据库 (推荐用于生产环境自动同步)
# USE_TURSO=1  # 取消注释以启用
```

---

## 完整使用指南

### 本地开发环境设置

#### 1. 克隆项目并安装依赖

```bash
# 安装 scraper 依赖
npm install

# 安装 website 依赖
cd website
npm install
cd ..
```

#### 2. 配置环境变量

**根目录 `.env`** (scraper 配置):
```bash
# Turso 数据库 (推荐)
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
USE_TURSO=1

# AI 配置
GEMINI_API_KEY=your_gemini_key_here
TRANSLATOR_PROVIDER=auto

# Short.io (可选)
SHORTIO_API_KEY=your_key_here
```

**website/.env.local** (网站配置):
```bash
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

### 日常使用工作流

#### 1. 抓取活动

```bash
# 抓取下周活动（写入 Turso）
npm run scrape

# 抓取本周活动
npm run scrape-current-week

# 或明确指定
npm run scrape -- --week current

# 临时使用 Turso（不修改 .env）
USE_TURSO=1 npm run scrape

# 本地测试（使用 SQLite）
npm run scrape  # 确保 .env 中没有 USE_TURSO=1
```

**预期输出**:
```
🚀 开始抓取湾区下周活动...
💾 数据库: Turso 云数据库

🕷️  开始并行抓取数据源...

开始抓取: Eventbrite
开始抓取: SF Station
开始抓取: Funcheap Weekend
✅ Eventbrite: 45 个活动
✅ SF Station: 23 个活动
✅ Funcheap Weekend: 18 个活动

📈 抓取汇总报告:
   总计: 86 个活动
   ...
```

#### 2. 验证数据

```bash
# 查看 Turso 中的数据
turso db shell bay-area-events "SELECT COUNT(*) FROM events;"

# 查看最新活动
turso db shell bay-area-events "
  SELECT title, start_time, week_identifier
  FROM events
  ORDER BY scraped_at DESC
  LIMIT 10;
"

# 查看翻译统计
turso db shell bay-area-events "
  SELECT
    week_identifier,
    COUNT(*) as total,
    COUNT(CASE WHEN title_zh IS NOT NULL THEN 1 END) as translated
  FROM events
  GROUP BY week_identifier;
"
```

#### 3. 本地运行网站

```bash
cd website

# 开发模式
npm run dev

# 访问
# http://localhost:3000        - 英文
# http://localhost:3000/zh     - 中文
```

#### 4. 部署到 Vercel

```bash
# 方式 1: 通过 GitHub 自动部署
git add .
git commit -m "Update events data"
git push origin main

# 方式 2: 手动部署
cd website
vercel --prod
```

### GitHub Actions 自动化

#### 配置文件: `.github/workflows/scraper.yml`

```yaml
name: Scrape Events

on:
  schedule:
    - cron: '0 8 * * 1'  # 每周一早上 8:00 运行
  workflow_dispatch:      # 支持手动触发

jobs:
  scrape:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run scraper
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          USE_TURSO: "1"  # 重要：直接写入 Turso
        run: npm run scrape
```

#### GitHub Secrets 配置

在 GitHub Repository → Settings → Secrets and variables → Actions 中添加：

- `TURSO_DATABASE_URL`: Turso 数据库 URL
- `TURSO_AUTH_TOKEN`: Turso 访问 token
- `GEMINI_API_KEY`: Gemini API key
- 其他需要的 API keys

---

## 问题解决历史

### 问题 1: Vercel 部署失败 - ESLint 配置

**错误**:
```
⨯ ESLint: Invalid Options: - Unknown options: useEslintrc, extensions
```

**原因**: Vercel 不支持 ESLint 9 的 flat config 格式

**解决**:
1. 删除 `website/eslint.config.mjs`
2. 创建 `website/.eslintrc.json`:
   ```json
   {
     "extends": ["next/core-web-vitals", "next/typescript"]
   }
   ```

### 问题 2: TypeScript 编译错误

**错误**:
```
Type error: Property 'ip' does not exist on type 'NextRequest'
```

**位置**: `website/app/api/feedback/route.ts`

**解决**:
```typescript
// 修复前
const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

// 修复后
const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';
```

### 问题 3: Middleware 崩溃

**错误**:
```
500: MIDDLEWARE_INVOCATION_FAILED
```

**原因**: Vercel 环境无法访问本地 SQLite 文件

**解决**: 在 `website/lib/db.ts` 添加环境检测
```typescript
if (process.env.VERCEL || process.env.VERCEL_ENV) {
  console.warn('⚠️  Running in Vercel without database. Using demo mode.');
  return null;
}
```

### 问题 4: 异步数据未等待

**错误**:
```
TypeError: events.map is not a function
```

**原因**: Turso 函数是异步的，但没有使用 `await`

**解决**: `website/app/[locale]/page.tsx`
```typescript
// 修复前
const events = getEvents(filters);  // 返回 Promise
const stats = getStats();           // 返回 Promise

// 修复后
const events = await getEvents(filters);  // 返回数组
const stats = await getStats();           // 返回对象
```

### 问题 5: 中文翻译不显示

**错误**: 选择中文语言后，活动标题仍显示英文

**原因**: Turso 数据库中的数据缺少 `title_zh` 字段

**诊断**:
```bash
# 本地 SQLite 有翻译
sqlite3 data/events.db "SELECT title, title_zh FROM events LIMIT 3;"

# Turso 缺少翻译
turso db shell bay-area-events "SELECT title, title_zh FROM events LIMIT 3;"
```

**解决**:
```bash
# 方式 1: 重新导入数据
sqlite3 data/events.db .dump > events-with-translations.sql
turso db shell bay-area-events < events-with-translations.sql

# 方式 2: 使用 Turso 重新抓取
USE_TURSO=1 npm run scrape
```

### 问题 6: 手动同步数据太繁琐

**问题**: "本地和turso不会自动同步的吗？我以后数据库都从本地变更的，并且网站修改也会很频繁，是不是每次都要手动上载数据？"

**解决**: 实现 Scraper 直接写入 Turso

**实现步骤**:
1. 安装 `@libsql/client`
2. 创建 `src/utils/turso-database.js` 适配器
3. 修改 `src/scrape-events.js` 支持环境变量切换
4. 配置 `USE_TURSO=1` 环境变量

**结果**: ✅ 无需手动同步，抓取数据立即在 Turso 中可用

### 问题 7: 跨周去重失败

**问题**: "可以保证即使 scrape 时间相差很久也去重吗？比如上次我 scrape 是一周前，现在 scrape 的结果出来在存到数据库之前还能够去重吗？"

**原因**: 去重逻辑限制了 `week_identifier`，只在同一周内去重

**解决**: 修改 `src/utils/database.js` 和 `src/utils/turso-database.js`

```javascript
// 修复前
const query = `SELECT ... FROM events WHERE location = ? AND week_identifier = ? ...`;

// 修复后 (移除 week_identifier 限制)
const query = `SELECT ... FROM events WHERE location = ? AND ABS(julianday(start_time) - julianday(?)) < ?`;
```

**添加 URL 去重**:
```javascript
// 最快的去重：检查 URL
if (event.originalUrl) {
  const urlQuery = `SELECT id FROM events WHERE original_url = ? LIMIT 1`;
  const existing = db.prepare(urlQuery).get(event.originalUrl);
  if (existing) return { saved: false, duplicate: true };
}
```

---

## 文件清单

### 核心配置文件

#### Scraper (根目录)
```
.env                              # 环境变量 (不提交到 git)
.env.example                      # 环境变量模板
package.json                      # 依赖配置
src/
  scrape-events.js               # 主抓取脚本 ⭐ (已修改)
  utils/
    database.js                   # SQLite 适配器
    turso-database.js            # Turso 适配器 ⭐ (新增)
    ai-classifier.js              # AI 分类
    translator.js                 # 翻译器
  scrapers/
    base-scraper.js              # 基础爬虫类
    eventbrite-scraper.js        # Eventbrite
    sfstation-scraper.js         # SF Station
    funcheap-weekend-scraper.js  # Funcheap
```

#### Website (website/)
```
.env.local                        # 本地环境变量 (不提交)
.eslintrc.json                   # ESLint 配置 ⭐ (修复)
package.json                      # 依赖配置
app/
  [locale]/
    page.tsx                      # 首页 ⭐ (添加 await)
  api/
    feedback/
      route.ts                    # 反馈 API ⭐ (修复 IP)
  components/
    EventCard.tsx                 # 活动卡片 (支持中文)
lib/
  db.ts                           # SQLite 适配器 ⭐ (添加环境检测)
  turso-db.ts                     # Turso 适配器
middleware.ts                     # next-intl 路由
```

### 文档文件

```
VERCEL_DEPLOYMENT_GUIDE.md       # Vercel 部署指南
TURSO_SETUP_STEPS.md            # Turso 初始设置
USE_TURSO_FOR_SCRAPER.md        # Scraper Turso 集成
TURSO_AUTO_SYNC_COMPLETE.md     # 自动同步完整指南
PROJECT_COMPLETE_GUIDE.md       # 本文档 (综合指南)
```

### Git 忽略文件

```
.gitignore 应包含:
.env
.env.local
node_modules/
data/events.db
data/events.db-wal
data/events.db-shm
```

---

## 快速参考命令

### Scraper 命令

```bash
# 抓取活动 (写入 Turso)
npm run scrape                    # 下周活动
npm run scrape-current-week      # 本周活动
USE_TURSO=1 npm run scrape       # 明确使用 Turso

# 查看帮助
npm run scrape -- --help

# 本地测试 (SQLite)
npm run scrape                    # .env 中不设置 USE_TURSO
```

### Turso 命令

```bash
# 数据库管理
turso db list                     # 列出所有数据库
turso db show bay-area-events    # 查看数据库信息
turso db shell bay-area-events   # 进入交互式 shell

# 数据操作
turso db shell bay-area-events "SELECT COUNT(*) FROM events;"
turso db shell bay-area-events "SELECT * FROM events ORDER BY scraped_at DESC LIMIT 10;"

# 数据导入
turso db shell bay-area-events < events.sql
```

### Website 命令

```bash
cd website

# 开发
npm run dev                       # 本地开发服务器
npm run build                     # 构建生产版本
npm run start                     # 运行生产版本

# 部署
vercel                           # 预览部署
vercel --prod                    # 生产部署
```

### Git 命令

```bash
# 常用工作流
git status
git add .
git commit -m "描述" --trailer "Co-authored-by: Sculptor <sculptor@imbue.com>"
git push origin sculptor/setup-vercel-deployment
```

---

## 总结

### ✅ 已完成的功能

1. **Vercel 部署**
   - ✅ 修复所有构建错误
   - ✅ 配置 Turso 数据库
   - ✅ 中英文国际化支持
   - ✅ ISR 缓存优化 (1小时)

2. **Turso 数据库**
   - ✅ 创建云数据库
   - ✅ 导入表结构和数据
   - ✅ 配置访问凭据
   - ✅ Website 集成

3. **自动同步**
   - ✅ Scraper 支持 Turso 切换
   - ✅ 环境变量控制
   - ✅ 无需手动同步数据
   - ✅ GitHub Actions 配置

4. **功能增强**
   - ✅ 支持抓取本周/下周活动
   - ✅ 跨周去重
   - ✅ URL 快速去重
   - ✅ AI 翻译集成

### 🎯 推荐配置

**生产环境** (推荐):
```bash
# 根目录 .env
USE_TURSO=1
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=eyJ...
```

**工作流**:
1. 运行 `npm run scrape`
2. 数据自动写入 Turso
3. Vercel 网站自动显示新数据
4. 无需任何手动操作 🎉

### 📚 参考文档优先级

1. **TURSO_AUTO_SYNC_COMPLETE.md** - 自动同步完整指南 (⭐ 最重要)
2. **PROJECT_COMPLETE_GUIDE.md** - 本文档 (综合参考)
3. **VERCEL_DEPLOYMENT_GUIDE.md** - Vercel 部署细节
4. **TURSO_SETUP_STEPS.md** - Turso 初始设置
5. **USE_TURSO_FOR_SCRAPER.md** - Scraper 技术细节

---

## 联系和支持

- **GitHub Issues**: 问题反馈和功能请求
- **文档**: 项目根目录下的 `.md` 文件
- **帮助命令**: `npm run scrape -- --help`

---

**最后更新**: 2025-12-02
**版本**: v2.0 (Turso 自动同步版)
