# Vercel 部署配置指南

## 项目概况

这是一个 Bay Area 活动聚合网站,包含两个主要组件:
- **爬虫系统** (根目录): 定期抓取活动数据并存储到 SQLite
- **Web 前端** (`website/`): Next.js 应用,展示活动信息

## 数据库解决方案

由于 Vercel 的 serverless 环境不支持持久化文件系统,我们有以下几个推荐方案:

### 方案 1: Turso (推荐) ⭐

**Turso** 是专为边缘计算设计的 SQLite 云服务,完美适合你的项目。

#### 优点:
- ✅ 完全兼容 SQLite,迁移成本极低
- ✅ 支持 `better-sqlite3` 的替代库 `@libsql/client`
- ✅ 免费套餐:500 数据库,9GB 存储,10亿行读取
- ✅ 全球边缘网络,低延迟
- ✅ 支持本地开发 replica 模式

#### 设置步骤:

1. **安装 Turso CLI**
```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

2. **登录并创建数据库**
```bash
turso auth login
turso db create bay-area-events --location sjc  # San Jose 数据中心
```

3. **获取数据库 URL 和 Token**
```bash
turso db show bay-area-events --url
turso db tokens create bay-area-events
```

4. **迁移现有数据**
```bash
# 导出现有数据库
sqlite3 data/events.db .dump > events.sql

# 导入到 Turso
turso db shell bay-area-events < events.sql
```

#### 代码修改:

**安装依赖** (`website/package.json`):
```json
{
  "dependencies": {
    "@libsql/client": "^0.14.0"
  }
}
```

**更新数据库连接** (`website/lib/db.ts`):
```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

// 查询示例
const result = await client.execute({
  sql: 'SELECT * FROM events WHERE week_identifier = ?',
  args: [weekIdentifier]
});
```

**Vercel 环境变量**:
```
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGc...
```

---

### 方案 2: Vercel Postgres

使用 Vercel 自带的 PostgreSQL 数据库服务。

#### 优点:
- ✅ Vercel 原生集成,零配置
- ✅ 免费套餐:256MB 存储,60 小时计算时间
- ✅ 自动备份和扩展

#### 缺点:
- ❌ 需要从 SQLite 迁移到 PostgreSQL
- ❌ SQL 语法有差异,需要调整代码

#### 设置步骤:

1. 在 Vercel Dashboard 中为项目添加 Postgres 数据库
2. 安装 Vercel Postgres SDK:
```bash
cd website
npm install @vercel/postgres
```

3. 创建数据库表结构 (需要转换 SQLite schema)
4. 迁移数据

---

### 方案 3: Supabase

完整的 BaaS 平台,提供 PostgreSQL 数据库。

#### 优点:
- ✅ 免费套餐:500MB 数据库,无限 API 请求
- ✅ 提供 REST API 和实时订阅
- ✅ 自带认证和存储功能

#### 缺点:
- ❌ 需要从 SQLite 迁移到 PostgreSQL
- ❌ 功能过多,可能过度设计

---

### 方案 4: Cloudflare D1 (SQLite-as-a-Service)

Cloudflare 的分布式 SQLite 数据库。

#### 优点:
- ✅ 真正的 SQLite 数据库
- ✅ 免费套餐:每天 10 万次读,10 万次写

#### 缺点:
- ❌ 需要使用 Cloudflare Workers,不能直接在 Vercel 使用
- ❌ API 调用方式,不能用 `better-sqlite3`

---

## 爬虫系统部署

由于爬虫需要定期运行,有以下选择:

### 选项 A: GitHub Actions (推荐)

在 GitHub Actions 中运行爬虫,并将数据推送到云数据库。

**创建 `.github/workflows/scraper.yml`**:
```yaml
name: Event Scraper

on:
  schedule:
    - cron: '0 0 * * 0'  # 每周日午夜运行
  workflow_dispatch:  # 手动触发

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
        run: npm run scrape
```

### 选项 B: Vercel Cron Jobs

使用 Vercel 的 Cron Jobs 功能 (需要 Pro 计划)。

**创建 `website/app/api/cron/scrape/route.ts`**:
```typescript
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 验证 cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 运行爬虫逻辑
  // ...

  return Response.json({ success: true });
}
```

**在 `vercel.json` 中配置**:
```json
{
  "crons": [{
    "path": "/api/cron/scrape",
    "schedule": "0 0 * * 0"
  }]
}
```

### 选项 C: Railway / Render (长期运行服务)

将爬虫部署为独立的后台服务。

- **Railway**: 免费套餐 $5/月额度
- **Render**: 免费套餐但会在不活动时休眠

---

## 推荐方案总结

### 最佳方案 (最小改动):

1. **数据库**: Turso (LibSQL)
   - 几乎零迁移成本
   - 只需替换 `better-sqlite3` 为 `@libsql/client`
   - 免费额度充足

2. **爬虫**: GitHub Actions
   - 完全免费
   - 代码和数据都在 GitHub 生态系统内
   - 容易调试和监控

3. **前端**: Vercel
   - 原生 Next.js 支持
   - 全球 CDN
   - 自动 HTTPS

### 实施步骤:

1. ✅ 创建 Turso 数据库并迁移数据
2. ✅ 更新 `website/lib/db.ts` 使用 `@libsql/client`
3. ✅ 更新爬虫代码使用 Turso
4. ✅ 创建 GitHub Actions workflow
5. ✅ 在 Vercel 中部署 website 目录
6. ✅ 配置环境变量

---

## Vercel 项目配置

### 1. Root Directory

设置为 `website` (因为 Next.js 应用在此目录)

### 2. Build Settings

- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 3. 环境变量

在 Vercel Dashboard → Settings → Environment Variables 中添加:

```
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

### 4. vercel.json

创建 `website/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["sfo1"]
}
```

---

## 费用估算

### 免费方案 (推荐):
- Turso: $0 (免费套餐)
- GitHub Actions: $0 (公开仓库免费)
- Vercel: $0 (Hobby 计划)

**总计: $0/月**

### 未来扩展 (如果流量增长):
- Turso Pro: $29/月 (更多数据库和存储)
- Vercel Pro: $20/月 (团队协作,更多功能)

---

## 下一步

想要我帮你:
1. 创建 Turso 数据库迁移脚本?
2. 更新代码以支持 Turso?
3. 创建 GitHub Actions workflow?
4. 生成完整的 `vercel.json` 配置?

选择一个方案后告诉我,我会帮你完成具体的配置!
