'use client';

import { Event, EVENT_TYPE_EMOJIS, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/lib/types';
import { useLocale, useTranslations } from 'next-intl';
import EventDescriptionPopover from './EventDescriptionPopover';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const locale = useLocale();
  const t = useTranslations('event');

  // 格式化时间
  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const days = locale === 'zh'
      ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[date.getDay()];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const time = `${hours}:${minutes.toString().padStart(2, '0')}`;

    return `${dayName} ${month}/${day} ${time}`;
  };

  // 格式化地点（截取前50个字符）
  const formatLocation = (location: string) => {
    if (location.length > 50) {
      return location.substring(0, 50) + '...';
    }
    return location;
  };

  // 获取活动类型样式
  const eventType = event.event_type || 'other';
  const emoji = EVENT_TYPE_EMOJIS[eventType] || '📌';
  const label = t(eventType as any);
  const colorClass = EVENT_TYPE_COLORS[eventType] || EVENT_TYPE_COLORS.other;

  // 获取活动链接
  const eventUrl = event.short_url || event.original_url;

  // 根据语言选择显示的标题
  const displayTitle = locale === 'zh' && event.title_zh ? event.title_zh : event.title;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200">
      {/* 顶部标签栏 */}
      <div className="flex items-center justify-between mb-3">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
          {emoji} {label}
        </span>
        {event.priority >= 9 && (
          <span className="text-yellow-500 text-sm">
            ⭐ {event.priority}/10
          </span>
        )}
      </div>

      {/* 活动标题 */}
      <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">
        {displayTitle}
      </h3>

      {/* 活动详情 */}
      <div className="space-y-2 mb-4">
        {/* 时间 */}
        <div className="flex items-start text-sm text-gray-700">
          <span className="mr-2">📅</span>
          <span>{formatTime(event.start_time)}</span>
        </div>

        {/* 地点 */}
        <div className="flex items-start text-sm text-gray-700">
          <span className="mr-2">📍</span>
          <span className="line-clamp-1">{formatLocation(event.location)}</span>
        </div>

        {/* 价格 */}
        {event.price && (
          <div className="flex items-start text-sm text-gray-700">
            <span className="mr-2">💰</span>
            <span>{event.price}</span>
          </div>
        )}

        {/* 描述 */}
        {event.description && (
          <EventDescriptionPopover description={event.description}>
            <div className="flex items-start text-sm text-gray-600">
              <span className="mr-2">✨</span>
              <span className="line-clamp-2">{event.description}</span>
            </div>
          </EventDescriptionPopover>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <a
          href={eventUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-md text-sm font-medium transition-colors"
        >
          {t('viewDetails')}
        </a>
      </div>

      {/* 来源标签 */}
      <div className="mt-3 text-xs text-gray-400 text-right">
        {locale === 'zh' ? '来源' : 'Source'}: {event.source}
      </div>
    </div>
  );
}
