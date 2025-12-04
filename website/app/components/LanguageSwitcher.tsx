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
    <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
      <button
        onClick={() => switchLanguage('en')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          locale === 'en'
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        {t('english')}
      </button>
      <button
        onClick={() => switchLanguage('zh')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          locale === 'zh'
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        {t('chinese')}
      </button>
    </div>
  );
}
