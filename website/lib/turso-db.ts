import { createClient, Client } from '@libsql/client';
import { Event, EventFilters, WeekIdentifier } from './types';

// Turso 数据库连接（延迟初始化）
let turso: Client | null = null;

function getTursoClient(): Client {
  if (!turso) {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      throw new Error('Missing Turso environment variables: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
    }

    turso = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return turso;
}

/**
 * 获取太平洋时区的当前日期
 * 解决服务器使用 UTC 时区导致周计算错误的问题
 */
function getPacificDate(): Date {
  const now = new Date();
  // 获取太平洋时区的日期字符串
  const pacificDateStr = now.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // 解析为 Date 对象 (格式: MM/DD/YYYY)
  const [month, day, year] = pacificDateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 获取太平洋时区的星期几 (0=周日, 1=周一, ...)
 */
function getPacificDayOfWeek(): number {
  const now = new Date();
  const pacificWeekday = now.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
  });
  const weekdayMap: { [key: string]: number } = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  return weekdayMap[pacificWeekday] ?? 0;
}

/**
 * 获取下周的周标识符
 */
export function getNextWeekIdentifier(): string {
  const now = getPacificDate();
  const day = getPacificDayOfWeek();
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
  const now = getPacificDate();
  const day = getPacificDayOfWeek();
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
    const client = getTursoClient();
    const result = await client.execute({ sql, args: params });
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
    const client = getTursoClient();
    const result = await client.execute({
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
    const client = getTursoClient();

    // 总数
    const totalResult = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM events WHERE week_identifier = ?',
      args: [week]
    });

    // 按类型统计
    const typeResult = await client.execute({
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
    const client = getTursoClient();
    const result = await client.execute({
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
