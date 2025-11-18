'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LOCATION_LABELS, EVENT_TYPE_LABELS } from '@/lib/types';

export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 当前筛选值
  const currentWeek = searchParams.get('week') || 'next';
  const currentLocation = searchParams.get('location') || 'all';
  const currentType = searchParams.get('type') || 'all';
  const currentPrice = searchParams.get('price') || 'all';

  // 更新筛选器
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || value === 'next') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* 周切换按钮 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => updateFilter('week', 'current')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentWeek === 'current'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            本周活动
          </button>
          <button
            onClick={() => updateFilter('week', 'next')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentWeek === 'next'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            下周活动
          </button>
        </div>

        {/* 筛选器 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 地区筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📍 地区
            </label>
            <select
              value={currentLocation}
              onChange={(e) => updateFilter('location', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(LOCATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 类型筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🎭 类型
            </label>
            <select
              value={currentType}
              onChange={(e) => updateFilter('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部类型</option>
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 价格筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              💰 价格
            </label>
            <select
              value={currentPrice}
              onChange={(e) => updateFilter('price', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部价格</option>
              <option value="free">免费</option>
              <option value="0-20">$0-20</option>
              <option value="20-50">$20-50</option>
              <option value="50+">$50+</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
