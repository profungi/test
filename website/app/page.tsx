import { getEvents, getStats } from '@/lib/db';
import { EventFilters } from '@/lib/types';
import FilterBar from './components/FilterBar';
import EventCard from './components/EventCard';

// ISR 配置：1小时重新验证
export const revalidate = 3600;

// 生成页面元数据
export async function generateMetadata({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const week = (searchParams.week as string) || 'next';
  const weekText = week === 'current' ? '本周' : '下周';

  return {
    title: `湾区活动 - ${weekText}精彩活动推荐 | Bay Area Events`,
    description: `发现湾区最精彩的活动！市集、节日、美食、艺术活动一网打尽。涵盖旧金山、南湾、东湾等地区。`,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // 构建筛选器
  const filters: EventFilters = {
    week: (searchParams.week as string) || 'next',
    location: (searchParams.location as any) || 'all',
    type: (searchParams.type as any) || 'all',
    price: (searchParams.price as any) || 'all',
  };

  // 获取活动数据
  const events = getEvents(filters);
  const stats = getStats();

  // 周标题
  const weekTitle = filters.week === 'current' ? '本周活动' : '下周活动';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🎯 湾区活动 <span className="text-blue-600">Bay Area Events</span>
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            发现湾区最精彩的活动 · 每周更新
          </p>
        </div>
      </header>

      {/* 筛选栏 */}
      <FilterBar />

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 统计信息 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            {weekTitle}
            <span className="ml-3 text-lg font-normal text-gray-600">
              共 {events.length} 个活动
            </span>
          </h2>
        </div>

        {/* 活动列表 */}
        {events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">暂无活动</p>
            <p className="text-gray-400 text-sm mt-2">
              请尝试调整筛选条件或查看其他周的活动
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600">
            <p>
              数据来源: Eventbrite, SF Station, Funcheap
            </p>
            <p className="mt-2">
              每周三自动更新 · 最后更新时间: {new Date().toLocaleDateString('zh-CN')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
