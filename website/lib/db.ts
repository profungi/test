import Database from 'better-sqlite3';
import path from 'path';
import { Event, EventFilters, WeekIdentifier } from './types';

// 数据库路径：指向父目录的 data/events.db（唯一数据源）
const DB_PATH = path.join(process.cwd(), '..', 'data', 'events.db');

// 初始化数据库连接（只读模式 + WAL 模式）
let db: Database.Database | null = null;

function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH, {
      readonly: true,      // 只读模式，确保不会修改数据
      fileMustExist: true  // 数据库必须存在
    });

    // 注意：只读模式下不能设置 pragma，WAL 模式由 scraper 在写入时设置

    console.log('✅ Connected to database:', DB_PATH);
  }
  return db;
}

/**
 * 获取下周的周标识符
 */
export function getNextWeekIdentifier(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + 7; // 下周一
  const monday = new Date(now.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return `${formatDate(monday)}_to_${formatDate(sunday)}`;
}

/**
 * 获取本周的周标识符
 */
export function getCurrentWeekIdentifier(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 本周一
  const monday = new Date(now.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return `${formatDate(monday)}_to_${formatDate(sunday)}`;
}

/**
 * 获取活动列表（支持多种筛选）
 */
export function getEvents(filters: EventFilters = {}): Event[] {
  const database = getDatabase();

  const {
    week = 'next',
    location = 'all',
    type = 'all',
    price = 'all',
    search = '',
  } = filters;

  // 构建 WHERE 子句
  const conditions: string[] = [];
  const params: any = {};

  // 1. 周筛选
  let weekIdentifier: string;
  if (week === 'current') {
    weekIdentifier = getCurrentWeekIdentifier();
  } else if (week === 'next') {
    weekIdentifier = getNextWeekIdentifier();
  } else {
    weekIdentifier = week; // 自定义周标识符
  }

  conditions.push('week_identifier = @weekIdentifier');
  params.weekIdentifier = weekIdentifier;

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
      const locationConditions = locations.map((_, index) => {
        const key = `loc${index}`;
        params[key] = `%${locations[index]}%`;
        return `location LIKE @${key}`;
      });
      conditions.push(`(${locationConditions.join(' OR ')})`);
    }
  }

  // 3. 活动类型筛选
  if (type !== 'all') {
    conditions.push('event_type = @type');
    params.type = type;
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
    conditions.push('(title LIKE @search OR description LIKE @search)');
    params.search = `%${search}%`;
  }

  // 构建完整 SQL
  const sql = `
    SELECT * FROM events
    WHERE ${conditions.join(' AND ')}
    ORDER BY priority DESC, start_time ASC
  `;

  try {
    const stmt = database.prepare(sql);
    const events = stmt.all(params) as Event[];
    return events;
  } catch (error) {
    console.error('Database query error:', error);
    // 如果是 SQLITE_BUSY 错误，重试一次
    if ((error as any).code === 'SQLITE_BUSY') {
      console.log('Database busy, retrying...');
      const stmt = database.prepare(sql);
      return stmt.all(params) as Event[];
    }
    throw error;
  }
}

/**
 * 获取单个活动详情
 */
export function getEventById(id: number): Event | null {
  const database = getDatabase();

  try {
    const stmt = database.prepare('SELECT * FROM events WHERE id = ?');
    const event = stmt.get(id) as Event | undefined;
    return event || null;
  } catch (error) {
    console.error('Database query error:', error);
    return null;
  }
}

/**
 * 获取统计数据
 */
export function getStats(weekIdentifier?: string) {
  const database = getDatabase();

  const week = weekIdentifier || getNextWeekIdentifier();

  try {
    // 总数
    const totalStmt = database.prepare('SELECT COUNT(*) as count FROM events WHERE week_identifier = ?');
    const totalResult = totalStmt.get(week) as { count: number };

    // 按类型统计
    const typeStmt = database.prepare(`
      SELECT event_type, COUNT(*) as count
      FROM events
      WHERE week_identifier = ?
      GROUP BY event_type
    `);
    const typeResults = typeStmt.all(week) as { event_type: string; count: number }[];

    const byType: { [key: string]: number } = {};
    typeResults.forEach((row) => {
      byType[row.event_type] = row.count;
    });

    return {
      total: totalResult.count,
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
export function getAvailableWeeks(): WeekIdentifier[] {
  const database = getDatabase();

  try {
    const stmt = database.prepare(`
      SELECT DISTINCT week_identifier, COUNT(*) as event_count
      FROM events
      GROUP BY week_identifier
      ORDER BY week_identifier DESC
      LIMIT 10
    `);

    const results = stmt.all() as { week_identifier: string; event_count: number }[];

    const currentWeek = getCurrentWeekIdentifier();
    const nextWeek = getNextWeekIdentifier();

    return results.map((row) => ({
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
