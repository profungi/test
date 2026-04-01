import { MetadataRoute } from 'next';
import { getEvents } from '@/lib/turso-db';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BASE_URL = process.env.SITE_URL || 'https://bayareaselected.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  // 获取所有活动并添加到 sitemap
  try {
    const events = await getEvents({
      week: '', // 获取所有周的活动
      location: 'all',
      type: 'all',
      price: 'all',
      search: '',
    });

    // 为每个活动的每个语言版本创建条目
    for (const event of events) {
      for (const locale of locales) {
        sitemapEntries.push({
          url: `${BASE_URL}/${locale}/events/${event.id}`,
          lastModified: event.scraped_at || currentDate,
          changeFrequency: 'weekly',
          priority: event.priority > 0 ? 0.9 : 0.7,
          alternates: {
            languages: {
              'en': `${BASE_URL}/en/events/${event.id}`,
              'zh': `${BASE_URL}/zh/events/${event.id}`,
            },
          },
        });
      }
    }
  } catch (error) {
    console.error('Error fetching events for sitemap:', error);
    // 即使获取活动失败，仍返回静态页面的 sitemap
  }

  // 获取所有大型活动并添加到 sitemap
  try {
    const majorEventsDir = path.join(process.cwd(), 'content/major-events/en');

    if (fs.existsSync(majorEventsDir)) {
      const files = fs.readdirSync(majorEventsDir);

      for (const file of files) {
        if (file.endsWith('.md')) {
          const slug = file.replace('.md', '');
          const filePath = path.join(majorEventsDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const { data } = matter(fileContent);

          for (const locale of locales) {
            sitemapEntries.push({
              url: `${BASE_URL}/${locale}/events/major/${slug}`,
              lastModified: data.lastUpdated || currentDate,
              changeFrequency: 'monthly',
              priority: 0.95, // 大型活动优先级最高
              alternates: {
                languages: {
                  'en': `${BASE_URL}/en/events/major/${slug}`,
                  'zh': `${BASE_URL}/zh/events/major/${slug}`,
                },
              },
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching major events for sitemap:', error);
  }

  return sitemapEntries;
}
