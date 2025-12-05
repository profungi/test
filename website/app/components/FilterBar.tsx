'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { LOCATION_LABELS, EVENT_TYPE_LABELS } from '@/lib/types';
import LanguageSwitcher from './LanguageSwitcher';

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('filter');
  const locale = useLocale();

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
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-white/80 backdrop-blur-md shadow-md border-b-2 border-[#F0D3B6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* 周切换按钮和语言切换器 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => updateFilter('week', 'current')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                currentWeek === 'current'
                  ? 'bg-[#B37DA2] text-white shadow-md shadow-[#B37DA2]/30'
                  : 'bg-[#FFF4E6] text-[#4A2C22] hover:bg-[#F9B879]/30 border border-[#F0D3B6]'
              }`}
            >
              {t('thisWeek')}
            </button>
            <button
              onClick={() => updateFilter('week', 'next')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                currentWeek === 'next'
                  ? 'bg-[#B37DA2] text-white shadow-md shadow-[#B37DA2]/30'
                  : 'bg-[#FFF4E6] text-[#4A2C22] hover:bg-[#F9B879]/30 border border-[#F0D3B6]'
              }`}
            >
              {t('nextWeek')}
            </button>
          </div>
          <LanguageSwitcher />
        </div>

        {/* 筛选器 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 地区筛选 */}
          <div>
            <label className="block text-sm font-bold text-[#4A2C22] mb-2">
              📍 {t('filterByLocation')}
            </label>
            <select
              value={currentLocation}
              onChange={(e) => updateFilter('location', e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-[#F0D3B6] rounded-xl focus:ring-2 focus:ring-[#B37DA2] focus:border-[#B37DA2] bg-white text-[#4A2C22] font-medium shadow-sm hover:border-[#B37DA2]/50 transition-all cursor-pointer"
            >
              <option value="all">{t('allLocations')}</option>
              <option value="sf">{t('sanFrancisco')}</option>
              <option value="southbay">{t('southBay')}</option>
              <option value="eastbay">{t('eastBay')}</option>
              <option value="northbay">{t('northBay')}</option>
              <option value="peninsula">{t('peninsula')}</option>
            </select>
          </div>

          {/* 类型筛选 */}
          <div>
            <label className="block text-sm font-bold text-[#4A2C22] mb-2">
              🎭 {t('filterByType')}
            </label>
            <select
              value={currentType}
              onChange={(e) => updateFilter('type', e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-[#F0D3B6] rounded-xl focus:ring-2 focus:ring-[#B37DA2] focus:border-[#B37DA2] bg-white text-[#4A2C22] font-medium shadow-sm hover:border-[#B37DA2]/50 transition-all cursor-pointer"
            >
              <option value="all">{t('allTypes')}</option>
              <option value="market">{t('market')}</option>
              <option value="festival">{t('festival')}</option>
              <option value="food">{t('food')}</option>
              <option value="art">{t('art')}</option>
              <option value="music">{t('music')}</option>
              <option value="sports">{t('sports')}</option>
              <option value="outdoor">{t('outdoor')}</option>
              <option value="family">{t('family')}</option>
              <option value="tech">{t('tech')}</option>
              <option value="other">{t('other')}</option>
            </select>
          </div>

          {/* 价格筛选 */}
          <div>
            <label className="block text-sm font-bold text-[#4A2C22] mb-2">
              💰 {t('filterByPrice')}
            </label>
            <select
              value={currentPrice}
              onChange={(e) => updateFilter('price', e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-[#F0D3B6] rounded-xl focus:ring-2 focus:ring-[#B37DA2] focus:border-[#B37DA2] bg-white text-[#4A2C22] font-medium shadow-sm hover:border-[#B37DA2]/50 transition-all cursor-pointer"
            >
              <option value="all">{t('allPrices')}</option>
              <option value="free">{t('free')}</option>
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
