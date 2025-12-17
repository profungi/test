'use client';

import { Event, EVENT_TYPE_EMOJIS, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/lib/types';
import { useLocale, useTranslations } from 'next-intl';
import EventDescriptionPopover from './EventDescriptionPopover';
import { useRef, useEffect } from 'react';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const locale = useLocale();
  const t = useTranslations('event');
  const cardRef = useRef<HTMLDivElement>(null);

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

  // 根据语言选择显示的摘要（优先使用 AI 摘要，fallback 到原始 description）
  const displaySummary = locale === 'zh'
    ? (event.summary_zh || event.description)
    : (event.summary_en || event.description);

  // Glow effect on mouse move
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    };

    card.addEventListener('mousemove', handleMouseMove);
    return () => card.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={cardRef}
      className="glow-card group relative bg-white rounded-2xl p-6 border-2 border-[#4A2C22]/10 transition-all duration-300"
      style={{ borderColor: '#F0D3B6' }}
    >
      {/* 顶部标签栏 */}
      <div className="flex items-center justify-between mb-3">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
          {emoji} {label}
        </span>
        {event.priority >= 9 && (
          <span className="text-[#F7D46A] text-sm font-bold bg-[#4A2C22]/10 px-2 py-1 rounded-full">
            ⭐ {event.priority}/10
          </span>
        )}
      </div>

      {/* 活动标题 */}
      <h3 className="text-lg font-bold text-[#4A2C22] mb-3 line-clamp-2 relative z-10">
        {displayTitle}
      </h3>

      {/* 活动详情 */}
      <div className="space-y-2 mb-4 relative z-10">
        {/* 时间 */}
        <div className="flex items-start text-sm text-[#4A2C22]/80">
          <span className="mr-2">📅</span>
          <span>{formatTime(event.start_time)}</span>
        </div>

        {/* 地点 */}
        <div className="flex items-start text-sm text-[#4A2C22]/80">
          <span className="mr-2">📍</span>
          <span className="line-clamp-1">{formatLocation(event.location)}</span>
        </div>

        {/* 价格 */}
        {event.price && (
          <div className="flex items-start text-sm text-[#4A2C22]/80">
            <span className="mr-2">💰</span>
            <span>{event.price}</span>
          </div>
        )}

        {/* 描述/摘要 */}
        {displaySummary && (
          <EventDescriptionPopover description={displaySummary}>
            <div className="flex items-start text-sm text-[#4A2C22]/70">
              <span className="mr-2">✨</span>
              <span className="line-clamp-2">{displaySummary}</span>
            </div>
          </EventDescriptionPopover>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 relative z-10">
        <a
          href={eventUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-[#B37DA2] hover:bg-[#8B557A] text-white text-center py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-[#B37DA2]/30"
        >
          {t('viewDetails')}
        </a>
      </div>

      {/* 来源标签 */}
      <div className="mt-3 text-xs text-[#4A2C22]/50 text-right relative z-10">
        {locale === 'zh' ? '来源' : 'Source'}: {event.source}
      </div>
    </div>
  );
}
