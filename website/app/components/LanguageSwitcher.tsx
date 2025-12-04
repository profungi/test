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
    <div className="flex items-center gap-2 bg-purple-900/50 rounded-lg shadow-sm border border-purple-400/30 p-1">
      <button
        onClick={() => switchLanguage('en')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          locale === 'en'
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
            : 'text-purple-200 hover:text-white hover:bg-purple-800/50'
        }`}
      >
        {t('english')}
      </button>
      <button
        onClick={() => switchLanguage('zh')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          locale === 'zh'
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
            : 'text-purple-200 hover:text-white hover:bg-purple-800/50'
        }`}
      >
        {t('chinese')}
      </button>
    </div>
  );
}
