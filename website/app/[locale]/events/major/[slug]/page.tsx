import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Header from '@/app/components/Header';
import Link from 'next/link';

// ISR 配置：1小时重新验证
export const revalidate = 3600;

interface Props {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

// 读取并解析 Markdown 文件
async function getMajorEventContent(slug: string, locale: string) {
  try {
    const filePath = path.join(
      process.cwd(),
      'content/major-events',
      locale,
      `${slug}.md`
    );

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(fileContent);

    const processedContent = await remark().use(html).process(content);

    return {
      meta: data,
      htmlContent: processedContent.toString(),
    };
  } catch (error) {
    console.error('Error reading major event content:', error);
    return null;
  }
}

// 生成页面元数据
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const eventData = await getMajorEventContent(slug, locale);

  if (!eventData) {
    return {
      title: 'Event Not Found',
      description: 'The requested event could not be found.',
    };
  }

  const { meta } = eventData;
  const title = locale === 'zh' ? meta.eventNameZh : meta.eventNameEn;
  const description =
    locale === 'zh'
      ? `${meta.eventNameZh} ${meta.year} 完整指南 - 日期、交通、门票、实用建议`
      : `${meta.eventNameEn} ${meta.year} Complete Guide - Dates, Transportation, Tickets, Tips`;

  const url = `https://ymjr.de/${locale}/events/major/${slug}`;

  return {
    title: `${title} ${meta.year} | Bay Area Events`,
    description: description,
    keywords: meta.keywords || [],
    openGraph: {
      title: `${title} ${meta.year}`,
      description: description,
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      url: url,
      siteName: 'Bay Area Events',
      images: meta.heroImage
        ? [
            {
              url: meta.heroImage,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} ${meta.year}`,
      description: description,
      images: meta.heroImage ? [meta.heroImage] : [],
    },
    alternates: {
      canonical: url,
      languages: {
        en: `/en/events/major/${slug}`,
        zh: `/zh/events/major/${slug}`,
      },
    },
  };
}

export default async function MajorEventPage({ params }: Props) {
  const { locale, slug } = await params;
  const eventData = await getMajorEventContent(slug, locale);

  if (!eventData) {
    notFound();
  }

  const { meta, htmlContent } = eventData;
  const title = locale === 'zh' ? meta.eventNameZh : meta.eventNameEn;

  // 生成 JSON-LD 结构化数据
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${title} ${meta.year}`,
    description:
      locale === 'zh'
        ? `${meta.eventNameZh} ${meta.year} 完整指南`
        : `${meta.eventNameEn} ${meta.year} Complete Guide`,
    startDate: meta.dateStart,
    endDate: meta.dateEnd,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: meta.location,
      address: {
        '@type': 'PostalAddress',
        addressLocality: meta.location,
        addressRegion: 'CA',
        addressCountry: 'US',
      },
    },
    offers: meta.price
      ? {
          '@type': 'Offer',
          price: meta.price.match(/\$(\d+)/)?.[1] || '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: meta.officialWebsite,
        }
      : undefined,
    image: meta.heroImage || undefined,
    url: `https://ymjr.de/${locale}/events/major/${slug}`,
    inLanguage: locale === 'zh' ? 'zh-CN' : 'en-US',
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: locale === 'zh' ? '首页' : 'Home',
        item: `https://ymjr.de/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: locale === 'zh' ? '大型活动' : 'Major Events',
        item: `https://ymjr.de/${locale}/events/major`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${title} ${meta.year}`,
        item: `https://ymjr.de/${locale}/events/major/${slug}`,
      },
    ],
  };

  return (
    <>
      {/* JSON-LD 结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-[#FFF4E6] via-[#F0D3B6] to-[#E8C7A6]">
        {/* 顶部导航栏 */}
        <Header />

        {/* 主内容区 */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 面包屑导航 */}
          <nav className="text-sm mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-[#4A2C22]/60">
              <li>
                <Link
                  href={`/${locale}`}
                  className="hover:text-[#B37DA2] transition-colors"
                >
                  {locale === 'zh' ? '首页' : 'Home'}
                </Link>
              </li>
              <li>&gt;</li>
              <li className="text-[#4A2C22] font-medium">
                {title} {meta.year}
              </li>
            </ol>
          </nav>

          {/* 活动详情卡片 */}
          <article className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-[#B37DA2]/30 overflow-hidden">
            {/* 活动主图 */}
            {meta.heroImage && (
              <div className="relative w-full h-80 sm:h-96 bg-gradient-to-br from-[#B37DA2] to-[#4A2C22]">
                <img
                  src={meta.heroImage}
                  alt={`${title} ${meta.year}`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Markdown 内容 */}
            <div className="p-6 sm:p-10">
              {/* 文章内容 - 应用样式 */}
              <div
                className="prose prose-lg max-w-none
                  prose-headings:text-[#4A2C22]
                  prose-h1:text-4xl prose-h1:font-bold prose-h1:mb-6 prose-h1:mt-0
                  prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b-2 prose-h2:border-[#F0D3B6] prose-h2:pb-2
                  prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
                  prose-p:text-[#4A2C22]/80 prose-p:leading-relaxed prose-p:mb-4
                  prose-a:text-[#B37DA2] prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-[#4A2C22] prose-strong:font-semibold
                  prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
                  prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
                  prose-li:text-[#4A2C22]/80 prose-li:mb-2
                  prose-blockquote:border-l-4 prose-blockquote:border-[#B37DA2] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-[#4A2C22]/70
                  prose-code:text-[#B37DA2] prose-code:bg-[#FFF4E6] prose-code:px-1 prose-code:rounded
                  prose-table:border-collapse prose-table:w-full prose-table:my-6
                  prose-th:bg-[#B37DA2] prose-th:text-white prose-th:font-semibold prose-th:p-3 prose-th:text-left
                  prose-td:border prose-td:border-[#F0D3B6] prose-td:p-3 prose-td:text-[#4A2C22]/80
                  prose-hr:border-[#F0D3B6] prose-hr:my-8"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />

              {/* 底部操作按钮 */}
              <div className="mt-12 pt-8 border-t-2 border-[#F0D3B6] flex flex-col sm:flex-row gap-4">
                {meta.officialWebsite && (
                  <a
                    href={meta.officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center bg-[#B37DA2] hover:bg-[#4A2C22] text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    {locale === 'zh' ? '访问官方网站' : 'Visit Official Website'}
                  </a>
                )}
                <Link
                  href={`/${locale}`}
                  className="flex-1 text-center bg-white hover:bg-[#F0D3B6] text-[#4A2C22] font-semibold py-4 px-6 rounded-xl border-2 border-[#B37DA2] transition-all duration-300"
                >
                  {locale === 'zh' ? '← 返回所有活动' : '← Back to All Events'}
                </Link>
              </div>
            </div>
          </article>

          {/* 页脚提示 */}
          <div className="mt-8 text-center text-sm text-[#4A2C22]/60">
            <p>
              {locale === 'zh'
                ? `最后更新: ${new Date(meta.lastUpdated || meta.year).toLocaleDateString('zh-CN')}`
                : `Last updated: ${new Date(meta.lastUpdated || meta.year).toLocaleDateString('en-US')}`}
            </p>
            <p className="mt-2">
              {locale === 'zh'
                ? '活动信息来源于官方网站，请以官方最新信息为准'
                : 'Event information is sourced from official websites. Please verify with official sources for the latest updates.'}
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
