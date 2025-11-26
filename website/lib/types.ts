/**
 * 活动数据类型（对应数据库 events 表）
 */
export interface Event {
  id: number;
  title: string;
  title_zh: string | null;
  normalized_title: string;
  start_time: string;
  end_time: string | null;
  location: string;
  price: string | null;
  description: string | null;
  description_detail: string | null;
  original_url: string;
  short_url: string | null;
  source: string;
  event_type: string | null;
  priority: number;
  scraped_at: string;
  week_identifier: string;
  is_processed: number;
}

/**
 * 筛选器类型
 */
export interface EventFilters {
  week?: 'current' | 'next' | string; // 本周、下周或自定义周标识符
  location?: 'all' | 'sanfrancisco' | 'southbay' | 'peninsula' | 'eastbay' | 'northbay';
  type?: 'all' | 'market' | 'festival' | 'fair' | 'free' | 'food' | 'art' | 'tech' | 'music' | 'other';
  price?: 'all' | 'free' | '0-20' | '20-50' | '50+';
  search?: string;
}

/**
 * 周标识符类型
 */
export interface WeekIdentifier {
  identifier: string;        // 如: "2025-11-17_to_2025-11-23"
  readable: string;          // 如: "11/17 - 11/23"
  event_count: number;
  is_current: boolean;
  is_next: boolean;
}

/**
 * 统计数据类型
 */
export interface Stats {
  total: number;
  by_type: {
    [key: string]: number;
  };
}

/**
 * 活动类型映射
 */
export const EVENT_TYPE_LABELS: { [key: string]: string } = {
  market: '市集',
  festival: '节日',
  fair: '博览会',
  free: '免费',
  food: '美食',
  art: '艺术',
  tech: '科技',
  music: '音乐',
  other: '其他',
};

/**
 * 活动类型图标
 */
export const EVENT_TYPE_EMOJIS: { [key: string]: string } = {
  market: '🛍️',
  festival: '🎉',
  fair: '🎪',
  free: '🆓',
  food: '🍴',
  art: '🎨',
  tech: '💻',
  music: '🎵',
  other: '📌',
};

/**
 * 活动类型颜色
 */
export const EVENT_TYPE_COLORS: { [key: string]: string } = {
  market: 'bg-orange-100 text-orange-800',
  festival: 'bg-pink-100 text-pink-800',
  fair: 'bg-purple-100 text-purple-800',
  free: 'bg-green-100 text-green-800',
  food: 'bg-red-100 text-red-800',
  art: 'bg-cyan-100 text-cyan-800',
  tech: 'bg-blue-100 text-blue-800',
  music: 'bg-violet-100 text-violet-800',
  other: 'bg-gray-100 text-gray-800',
};

/**
 * 地理位置标签
 */
export const LOCATION_LABELS: { [key: string]: string } = {
  all: '全部湾区',
  sanfrancisco: '旧金山',
  southbay: '南湾',
  peninsula: '半岛',
  eastbay: '东湾',
  northbay: '北湾',
};
