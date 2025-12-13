import { MetadataRoute } from 'next';

const BASE_URL = process.env.SITE_URL || 'https://bayareaselected.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ['en', 'zh'];
  const currentDate = new Date().toISOString();

  // 静态页面
  const staticPages = ['', '/privacy', '/terms'];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  // 为每个语言版本生成页面条目
  for (const locale of locales) {
    for (const page of staticPages) {
      sitemapEntries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: currentDate,
        changeFrequency: page === '' ? 'daily' : 'monthly',
        priority: page === '' ? 1.0 : 0.5,
        alternates: {
          languages: {
            'en': `${BASE_URL}/en${page}`,
            'zh': `${BASE_URL}/zh${page}`,
          },
        },
      });
    }
  }

  return sitemapEntries;
}
