'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('languageSwitcher');

  const switchLanguage = (newLocale: string) => {
    // Preserve search params when switching language
    const params = new URLSearchParams(searchParams.toString());
    const search = params.toString();

    router.replace(
      // @ts-ignore
      { pathname, search: search ? `?${search}` : '' },
      { locale: newLocale }
    );
  };

  return (
    <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border-2 border-[#F0D3B6] p-1">
      <button
        onClick={() => switchLanguage('en')}
        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
          locale === 'en'
            ? 'bg-[#B37DA2] text-white shadow-md shadow-[#B37DA2]/30'
            : 'text-[#4A2C22] hover:bg-[#FFF4E6]'
        }`}
      >
        {t('english')}
      </button>
      <button
        onClick={() => switchLanguage('zh')}
        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
          locale === 'zh'
            ? 'bg-[#B37DA2] text-white shadow-md shadow-[#B37DA2]/30'
            : 'text-[#4A2C22] hover:bg-[#FFF4E6]'
        }`}
      >
        {t('chinese')}
      </button>
    </div>
  );
}
