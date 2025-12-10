# Turso 数据库迁移指南

本指南帮助你将现有的 SQLite 数据库迁移到 Turso (LibSQL),以便在 Vercel 上部署。

## 为什么选择 Turso?

1. **完全兼容 SQLite**: 使用 LibSQL,是 SQLite 的开源分支
2. **边缘计算优化**: 全球分布式,低延迟访问
3. **慷慨的免费套餐**:
   - 500 个数据库
   - 9GB 总存储
   - 10 亿行读取/月
   - 2500 万行写入/月
4. **简单迁移**: API 与 SQLite 几乎相同

---

## 第一步: 安装和设置 Turso

### 1.1 安装 Turso CLI

**macOS/Linux**:
```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

**验证安装**:
```bash
turso --version
```

### 1.2 登录 Turso

```bash
turso auth login
```

这会打开浏览器,使用 GitHub 账号登录。

### 1.3 创建数据库

```bash
# 创建数据库 (选择最近的数据中心)
turso db create bay-area-events --location sjc

# 查看数据库信息
turso db show bay-area-events
```

**可用的数据中心位置**:
- `sjc`: San Jose, CA (推荐,离 Bay Area 最近)
- `lax`: Los Angeles, CA
- `iad`: Washington DC
- `fra`: Frankfurt, Germany

### 1.4 获取连接信息

```bash
# 获取数据库 URL
turso db show bay-area-events --url

# 创建认证 Token
turso db tokens create bay-area-events
```

**保存这两个值**,稍后会用到:
- `TURSO_DATABASE_URL`: libsql://bay-area-events-xxx.turso.io
- `TURSO_AUTH_TOKEN`: eyJhbGciOi...

---

## 第二步: 迁移现有数据

### 2.1 导出现有 SQLite 数据

```bash
# 在项目根目录运行
sqlite3 data/events.db .dump > events-dump.sql
```

### 2.2 导入到 Turso

```bash
# 方法 1: 使用 Turso Shell
turso db shell bay-area-events < events-dump.sql

# 方法 2: 使用 Turso CLI 逐条执行
turso db shell bay-area-events
```

在 shell 中:
```sql
.read events-dump.sql
.quit
```

### 2.3 验证数据

```bash
turso db shell bay-area-events "SELECT COUNT(*) FROM events;"
```

---

## 第三步: 更新 Website 代码

### 3.1 安装依赖

```bash
cd website
npm install @libsql/client
```

### 3.2 创建新的数据库连接文件

**创建 `website/lib/turso-db.ts`**:

```typescript
import { createClient } from '@libsql/client';
import { Event, EventFilters, WeekIdentifier } from './types';

// Turso 数据库连接
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

/**
 * 获取下周的周标识符
 */
export function getNextWeekIdentifier(): string {
  const now = new Date();
  const day = now.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - daysFromMonday);

  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);

  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return `${formatDate(nextMonday)}_to_${formatDate(nextSunday)}`;
}

/**
 * 获取本周的周标识符
 */
export function getCurrentWeekIdentifier(): string {
  const now = new Date();
  const day = now.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - daysFromMonday);

  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisMonday.getDate() + 6);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return `${formatDate(thisMonday)}_to_${formatDate(thisSunday)}`;
}

/**
 * 获取活动列表
 */
export async function getEvents(filters: EventFilters = {}): Promise<Event[]> {
  const {
    week = 'next',
    location = 'all',
    type = 'all',
    price = 'all',
    search = '',
  } = filters;

  // 构建 WHERE 子句
  const conditions: string[] = [];
  const params: any[] = [];

  // 1. 周筛选
  let weekIdentifier: string;
  if (week === 'current') {
    weekIdentifier = getCurrentWeekIdentifier();
  } else if (week === 'next') {
    weekIdentifier = getNextWeekIdentifier();
  } else {
    weekIdentifier = week;
  }

  conditions.push('week_identifier = ?');
  params.push(weekIdentifier);

  // 2. 地理位置筛选
  if (location !== 'all') {
    const locationMap: { [key: string]: string[] } = {
      sanfrancisco: ['San Francisco', 'SF', 'SOMA', 'Mission', 'Castro'],
      southbay: ['San Jose', 'Santa Clara', 'Sunnyvale', 'Milpitas', 'Campbell', 'Los Gatos', 'Saratoga', 'Cupertino'],
      peninsula: ['Palo Alto', 'Menlo Park', 'Redwood City', 'San Mateo', 'Mountain View'],
      eastbay: ['Oakland', 'Berkeley', 'Alameda', 'Fremont'],
      northbay: ['Marin', 'San Rafael', 'Sausalito', 'Napa', 'Sonoma'],
    };

    const locations = locationMap[location] || [];
    if (locations.length > 0) {
      const locationConditions = locations.map(() => 'location LIKE ?');
      conditions.push(`(${locationConditions.join(' OR ')})`);
      locations.forEach(loc => params.push(`%${loc}%`));
    }
  }

  // 3. 活动类型筛选
  if (type !== 'all') {
    conditions.push('event_type = ?');
    params.push(type);
  }

  // 4. 价格筛选
  if (price === 'free') {
    conditions.push("(price LIKE '%free%' OR price LIKE '%Free%' OR price = '$0')");
  } else if (price === '0-20') {
    conditions.push("(price LIKE '$%' AND CAST(REPLACE(REPLACE(price, '$', ''), ',', '') AS REAL) <= 20)");
  } else if (price === '20-50') {
    conditions.push("(price LIKE '$%' AND CAST(REPLACE(REPLACE(price, '$', ''), ',', '') AS REAL) > 20 AND CAST(REPLACE(REPLACE(price, '$', ''), ',', '') AS REAL) <= 50)");
  } else if (price === '50+') {
    conditions.push("(price LIKE '$%' AND CAST(REPLACE(REPLACE(price, '$', ''), ',', '') AS REAL) > 50)");
  }

  // 5. 搜索
  if (search) {
    conditions.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  // 构建完整 SQL
  const sql = `
    SELECT * FROM events
    WHERE ${conditions.join(' AND ')}
    ORDER BY priority DESC, start_time ASC
  `;

  try {
    const result = await turso.execute({ sql, args: params });
    return result.rows as unknown as Event[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * 获取单个活动详情
 */
export async function getEventById(id: number): Promise<Event | null> {
  try {
    const result = await turso.execute({
      sql: 'SELECT * FROM events WHERE id = ?',
      args: [id]
    });
    return result.rows[0] as unknown as Event || null;
  } catch (error) {
    console.error('Database query error:', error);
    return null;
  }
}

/**
 * 获取统计数据
 */
export async function getStats(weekIdentifier?: string) {
  const week = weekIdentifier || getNextWeekIdentifier();

  try {
    // 总数
    const totalResult = await turso.execute({
      sql: 'SELECT COUNT(*) as count FROM events WHERE week_identifier = ?',
      args: [week]
    });

    // 按类型统计
    const typeResult = await turso.execute({
      sql: `
        SELECT event_type, COUNT(*) as count
        FROM events
        WHERE week_identifier = ?
        GROUP BY event_type
      `,
      args: [week]
    });

    const byType: { [key: string]: number } = {};
    typeResult.rows.forEach((row: any) => {
      byType[row.event_type] = row.count;
    });

    return {
      total: (totalResult.rows[0] as any).count,
      by_type: byType,
    };
  } catch (error) {
    console.error('Database stats error:', error);
    return {
      total: 0,
      by_type: {},
    };
  }
}

/**
 * 获取可用的周列表
 */
export async function getAvailableWeeks(): Promise<WeekIdentifier[]> {
  try {
    const result = await turso.execute({
      sql: `
        SELECT DISTINCT week_identifier, COUNT(*) as event_count
        FROM events
        GROUP BY week_identifier
        ORDER BY week_identifier DESC
        LIMIT 10
      `
    });

    const currentWeek = getCurrentWeekIdentifier();
    const nextWeek = getNextWeekIdentifier();

    return result.rows.map((row: any) => ({
      identifier: row.week_identifier,
      readable: formatWeekReadable(row.week_identifier),
      event_count: row.event_count,
      is_current: row.week_identifier === currentWeek,
      is_next: row.week_identifier === nextWeek,
    }));
  } catch (error) {
    console.error('Database weeks error:', error);
    return [];
  }
}

/**
 * 格式化周标识符为可读格式
 */
function formatWeekReadable(identifier: string): string {
  const [start, end] = identifier.split('_to_');
  if (!start || !end) return identifier;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return `${formatDate(start)} - ${formatDate(end)}`;
}
```

### 3.3 创建环境变量文件

**创建 `website/.env.local`** (本地开发):

```bash
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

**不要提交这个文件到 Git!** 确保 `website/.gitignore` 包含:
```
.env*.local
```

---

## 第四步: 更新 Scraper 代码

### 4.1 安装依赖

```bash
# 在项目根目录
npm install @libsql/client
```

### 4.2 创建 Turso 数据库工具

**创建 `src/turso-database.js`**:

```javascript
const { createClient } = require('@libsql/client');
require('dotenv').config();

class TursoDatabase {
  constructor() {
    this.client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  async saveEvent(event) {
    const sql = `
      INSERT INTO events (
        title, description, location, start_time, end_time,
        event_type, priority, source, image_url, event_url,
        week_identifier, price, scraped_at, english_title, english_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_url, start_time) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        location = excluded.location,
        end_time = excluded.end_time,
        event_type = excluded.event_type,
        priority = excluded.priority,
        image_url = excluded.image_url,
        price = excluded.price,
        scraped_at = excluded.scraped_at
    `;

    try {
      await this.client.execute({
        sql,
        args: [
          event.title,
          event.description,
          event.location,
          event.start_time,
          event.end_time,
          event.event_type,
          event.priority,
          event.source,
          event.image_url,
          event.event_url,
          event.week_identifier,
          event.price,
          new Date().toISOString(),
          event.english_title || null,
          event.english_description || null
        ]
      });
    } catch (error) {
      console.error('Error saving event:', error);
      throw error;
    }
  }

  async getEventsByWeek(weekIdentifier) {
    const result = await this.client.execute({
      sql: 'SELECT * FROM events WHERE week_identifier = ? ORDER BY priority DESC',
      args: [weekIdentifier]
    });
    return result.rows;
  }

  async close() {
    // Turso client 不需要显式关闭
  }
}

module.exports = TursoDatabase;
```

### 4.3 更新 .env

在根目录的 `.env` 文件中添加:

```bash
TURSO_DATABASE_URL=libsql://bay-area-events-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

---

## 第五步: 配置 Vercel

### 5.1 在 Vercel Dashboard 中设置环境变量

1. 进入你的项目设置
2. 导航到 **Settings** → **Environment Variables**
3. 添加以下变量:

| Name | Value | Environment |
|------|-------|-------------|
| `TURSO_DATABASE_URL` | libsql://bay-area-events-xxx.turso.io | Production, Preview, Development |
| `TURSO_AUTH_TOKEN` | eyJhbGciOi... | Production, Preview, Development |

### 5.2 设置部署配置

在 Vercel 项目设置中:

- **Root Directory**: `website`
- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (默认)
- **Output Directory**: `.next` (默认)
- **Install Command**: `npm install` (默认)

---

## 第六步: 测试部署

### 6.1 本地测试

```bash
cd website
npm install
npm run dev
```

访问 http://localhost:3000 确保一切正常。

### 6.2 部署到 Vercel

```bash
# 如果还没安装 Vercel CLI
npm i -g vercel

# 在 website 目录下部署
cd website
vercel

# 或者直接通过 Git push 触发自动部署
git push origin main
```

---

## 第七步: 设置 GitHub Actions 运行 Scraper

**创建 `.github/workflows/scraper.yml`**:

```yaml
name: Event Scraper

on:
  schedule:
    - cron: '0 0 * * 0'  # 每周日午夜 UTC 运行
  workflow_dispatch:  # 允许手动触发

jobs:
  scrape:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

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
          AI_PROVIDER: gemini
        run: npm run scrape
```

### 配置 GitHub Secrets

1. 进入 GitHub 仓库
2. **Settings** → **Secrets and variables** → **Actions**
3. 添加以下 secrets:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `GEMINI_API_KEY`

---

## 常见问题 (FAQ)

### Q: Turso 免费套餐够用吗?

A: 对于你的项目完全够用:
- 每周只爬一次数据 (~100-500 events)
- 网站访问量即使每月 10 万次,也远低于 10 亿行读取限制

### Q: 如何查看 Turso 数据库?

```bash
# 使用 CLI
turso db shell bay-area-events

# 在 shell 中执行 SQL
SELECT COUNT(*) FROM events;
.tables
.schema events
```

### Q: 如何备份 Turso 数据库?

```bash
# 导出为 SQL
turso db shell bay-area-events .dump > backup.sql

# 或者直接复制数据库
turso db replicate bay-area-events bay-area-events-backup
```

### Q: Turso 支持多少并发连接?

A: Turso 是 HTTP-based,没有传统的连接池限制。每个请求都是独立的 HTTP 调用。

### Q: 本地开发时可以用本地 SQLite 吗?

A: 可以!Turso 支持 embedded replicas:

```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'file:local.db',  // 本地 SQLite 文件
  syncUrl: process.env.TURSO_DATABASE_URL,  // 远程 Turso
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await client.sync();  // 同步远程数据到本地
```

---

## 下一步

迁移完成后,你可以:

1. 删除本地的 `data/events.db` 文件 (已备份到 Turso)
2. 更新 `.gitignore` 忽略 `data/*.db`
3. 监控 GitHub Actions 运行状态
4. 在 Vercel 上查看部署日志

需要帮助? 随时告诉我遇到的问题!
