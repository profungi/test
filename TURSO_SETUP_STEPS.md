# Turso 数据库安装和配置步骤

## 第一部分: 安装 Turso CLI 和创建数据库

### 1. 安装 Turso CLI

**macOS / Linux:**
```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm get.tur.so/install.ps1 | iex
```

**验证安装:**
```bash
turso --version
```

### 2. 登录 Turso

```bash
turso auth login
```

这会打开浏览器，使用 GitHub 账号登录（完全免费）。

### 3. 创建数据库

```bash
# 创建数据库（选择离你最近的数据中心）
turso db create bay-area-events --location sjc

# 查看数据库信息
turso db show bay-area-events
```

### 4. 获取连接凭证

```bash
# 获取数据库 URL
turso db show bay-area-events --url

# 创建认证 Token
turso db tokens create bay-area-events
```

**保存这两个值！** 你会需要它们：
- `TURSO_DATABASE_URL`: 类似 `libsql://bay-area-events-xxx.turso.io`
- `TURSO_AUTH_TOKEN`: 类似 `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...`

### 5. 迁移现有数据

```bash
# 导出本地 SQLite 数据
sqlite3 data/events.db .dump > events-dump.sql

# 导入到 Turso
turso db shell bay-area-events < events-dump.sql

# 验证数据
turso db shell bay-area-events "SELECT COUNT(*) FROM events;"
```

---

## 第二部分: 更新代码

### 1. 安装 Turso 客户端库

```bash
cd website
npm install @libsql/client
```

### 2. 创建 Turso 数据库适配器

我已经为你准备好了代码，创建文件 `website/lib/turso-db.ts`：

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
    return [];
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
      total: Number((totalResult.rows[0] as any).count) || 0,
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
      event_count: Number(row.event_count),
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

### 3. 更新页面使用 Turso

编辑 `website/app/[locale]/page.tsx`，将第 1 行改为：

```typescript
import { getEvents, getStats } from '@/lib/turso-db';  // 改这里
```

### 4. 设置本地环境变量

创建 `website/.env.local`：

```bash
TURSO_DATABASE_URL=libsql://your-database-url.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here
```

**重要**: 确保 `website/.gitignore` 包含：
```
.env*.local
```

---

## 第三部分: 配置 Vercel

### 1. 在 Vercel Dashboard 添加环境变量

1. 进入你的 Vercel 项目
2. **Settings** → **Environment Variables**
3. 添加以下变量（用于 Production, Preview, Development）：

| Variable Name | Value |
|--------------|-------|
| `TURSO_DATABASE_URL` | libsql://bay-area-events-xxx.turso.io |
| `TURSO_AUTH_TOKEN` | eyJhbGciOi... |

### 2. 重新部署

保存环境变量后，触发重新部署：
- **Deployments** → 最新部署 → "..." → **Redeploy**

---

## 第四部分: 测试

### 1. 本地测试

```bash
cd website
npm run dev
```

访问 http://localhost:3000，应该能看到活动数据。

### 2. Vercel 测试

部署完成后，访问你的 Vercel URL，应该能看到真实的活动数据！

---

## 故障排除

### 问题 1: "Unable to connect to database"

**检查:**
```bash
# 测试数据库连接
turso db shell bay-area-events "SELECT 1;"
```

如果失败，重新创建 token:
```bash
turso db tokens create bay-area-events
```

### 问题 2: 环境变量未生效

**验证:**
1. 在 Vercel 中检查环境变量是否正确保存
2. 确保选择了 "Production, Preview, Development" 所有环境
3. 重新部署（不是 Redeploy，而是推送新的 commit）

### 问题 3: 数据为空

**检查数据是否导入成功:**
```bash
turso db shell bay-area-events "SELECT COUNT(*) FROM events;"
```

如果返回 0，重新导入：
```bash
sqlite3 data/events.db .dump > events-dump.sql
turso db shell bay-area-events < events-dump.sql
```

---

## 完成检查清单

- [ ] ✅ 安装 Turso CLI
- [ ] ✅ 登录 Turso
- [ ] ✅ 创建数据库
- [ ] ✅ 获取 URL 和 Token
- [ ] ✅ 导入现有数据
- [ ] ✅ 安装 `@libsql/client`
- [ ] ✅ 创建 `website/lib/turso-db.ts`
- [ ] ✅ 更新 `page.tsx` 的 import
- [ ] ✅ 创建 `website/.env.local`
- [ ] ✅ 在 Vercel 添加环境变量
- [ ] ✅ 本地测试成功
- [ ] ✅ Vercel 部署成功

---

## 下一步

完成后，你的网站将：
- ✅ 在 Vercel 上正常运行
- ✅ 显示真实的活动数据
- ✅ 全球低延迟访问（Turso 边缘网络）
- ✅ 完全免费（Turso 免费套餐）

有任何问题随时告诉我！
