// import { getEvents, getStats } from '@/lib/db'; //local
import { getEvents, getStats } from '@/lib/turso-db';  // 改这里！
import { EventFilters } from '@/lib/types';
import FilterBar from '../components/FilterBar';
import EventCard from '../components/EventCard';
import FeedbackSection from '../components/FeedbackSection';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

// ISR 配置：1小时重新验证
export const revalidate = 3600;

// 生成页面元数据
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const sp = await searchParams;
  const week = (sp.week as string) || 'next';

  const weekText = week === 'current' ? t('thisWeek') : t('nextWeek');

  return {
    title: `${t('title')} - ${weekText}`,
    description: t('description'),
  };
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'home' });

  // 构建筛选器
  const filters: EventFilters = {
    week: (sp.week as string) || 'next',
    location: (sp.location as any) || 'all',
    type: (sp.type as any) || 'all',
    price: (sp.price as any) || 'all',
  };

  // 获取活动数据
  const events = await getEvents(filters);
  const stats = await getStats();

  // 周标题
  const weekTitle = filters.week === 'current' ? t('thisWeekEvents') : t('nextWeekEvents');

  // 格式化当前日期（服务器端渲染）
  const currentDate = new Date().toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US');

  return (
    <div className="min-h-screen">
      {/* 顶部导航栏 */}
      <header className="bg-purple-950/40 backdrop-blur-md shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-white">
            🎯 {t('siteTitle')}
          </h1>
          <p className="mt-2 text-sm text-purple-200">
            {t('siteSubtitle')}
          </p>
        </div>
      </header>

      {/* 筛选栏 */}
      <FilterBar />

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 统计信息 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">
            {weekTitle}
            <span className="ml-3 text-lg font-normal text-purple-200">
              {t('eventsCount', { count: events.length })}
            </span>
          </h2>
        </div>

        {/* 活动列表 */}
        {events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-purple-200 text-lg">{t('noEvents')}</p>
            <p className="text-purple-300 text-sm mt-2">
              {t('noEventsHint')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>

            {/* 用户反馈组件 */}
            <Suspense fallback={<div className="mt-8 text-center text-purple-300">Loading...</div>}>
              <FeedbackSection eventsCount={events.length} />
            </Suspense>
          </>
        )}
      </main>

      {/* 页脚 */}
      <footer className="bg-purple-950/40 backdrop-blur-md border-t border-purple-500/30 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-purple-200">
            <p>
              {t('dataSource')}
            </p>
            <p className="mt-2">
              {t('updateInfo', {
                date: currentDate
              })}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
