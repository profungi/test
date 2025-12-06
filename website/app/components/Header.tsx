'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const t = useTranslations('home');

  return (
    <header className="bg-white/90 backdrop-blur-md shadow-md border-b-2 border-[#F0D3B6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 大屏幕：标题和语言切换在一行 */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/grape-mascot.png"
              alt="Grape Mascot"
              width={80}
              height={80}
              className="object-contain"
            />
            <div>
              <h1 className="text-3xl font-bold text-[#4A2C22]">
                {t('siteTitle')}
              </h1>
              <p className="mt-1 text-sm text-[#4A2C22]/70 font-medium">
                {t('siteSubtitle')}
              </p>
            </div>
          </div>
          <LanguageSwitcher compact />
        </div>

        {/* 小屏幕：语言切换在副标题下方居中 */}
        <div className="sm:hidden">
          <div className="flex items-center gap-4">
            <Image
              src="/grape-mascot.png"
              alt="Grape Mascot"
              width={80}
              height={80}
              className="object-contain"
            />
            <div>
              <h1 className="text-3xl font-bold text-[#4A2C22]">
                {t('siteTitle')}
              </h1>
              <p className="mt-1 text-sm text-[#4A2C22]/70 font-medium">
                {t('siteSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex justify-center mt-4">
            <LanguageSwitcher compact />
          </div>
        </div>
      </div>
    </header>
  );
}
