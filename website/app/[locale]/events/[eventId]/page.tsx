import { getEventById } from '@/lib/turso-db';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next';
import Header from '@/app/components/Header';
import Link from 'next/link';

// ISR 配置：1小时重新验证
export const revalidate = 3600;

interface Props {
  params: Promise<{
    locale: string;
    eventId: string;
  }>;
}

// 生成页面元数据
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, eventId } = await params;
  const event = await getEventById(parseInt(eventId));

  if (!event) {
    return {
      title: 'Event Not Found',
      description: 'The requested event could not be found.',
    };
  }

  const title = (locale === 'zh' ? event.title_zh : event.title) || 'Event';
  const description = (locale === 'zh' ? event.summary_zh : event.summary_en) || event.description?.substring(0, 160) || '';
  const url = `https://ymjr.de/${locale}/events/${eventId}`;

  return {
    title: `${title} | Bay Area Events`,
    description: description || event.description?.substring(0, 160),
    keywords: [
      locale === 'zh' ? '湾区活动' : 'Bay Area Events',
      event.event_type || '',
      event.location || '',
      locale === 'zh' ? '旧金山' : 'San Francisco',
      locale === 'zh' ? '湾区' : 'Bay Area',
    ].filter(Boolean),
    openGraph: {
      title: title,
      description: description || event.description?.substring(0, 160),
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      url: url,
      siteName: 'Bay Area Events',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description || event.description?.substring(0, 160),
    },
    alternates: {
      canonical: url,
      languages: {
        en: `/en/events/${eventId}`,
        zh: `/zh/events/${eventId}`,
      },
    },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { locale, eventId } = await params;
  const event = await getEventById(parseInt(eventId));
  const t = await getTranslations({ locale, namespace: 'eventDetail' });

  if (!event) {
    notFound();
  }

  const title = locale === 'zh' ? event.title_zh : event.title;
  const description = locale === 'zh' ? event.description : event.description;
  const summary = locale === 'zh' ? event.summary_zh : event.summary_en;

  // 生成 JSON-LD 结构化数据
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    description: summary || description?.substring(0, 200),
    startDate: event.start_time,
    endDate: event.end_time,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.location,
      address: {
        '@type': 'PostalAddress',
        addressLocality: event.location,
        addressRegion: 'CA',
        addressCountry: 'US',
      },
    },
    offers: event.price
      ? {
          '@type': 'Offer',
          price: event.price.match(/\$(\d+)/)?.[1] || '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: event.original_url,
        }
      : undefined,
    url: `https://ymjr.de/${locale}/events/${eventId}`,
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
        name: title,
        item: `https://ymjr.de/${locale}/events/${eventId}`,
      },
    ],
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <li className="text-[#4A2C22] font-medium">{title}</li>
            </ol>
          </nav>

          {/* 活动详情卡片 */}
          <article className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border-2 border-[#B37DA2]/30 overflow-hidden">
            {/* 活动内容 */}
            <div className="p-6 sm:p-8">
              {/* 活动标题 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-block px-3 py-1 bg-[#B37DA2] text-white text-xs font-semibold rounded-full">
                    {event.event_type}
                  </span>
                  {event.priority > 0 && (
                    <span className="inline-block px-3 py-1 bg-[#4A2C22] text-white text-xs font-semibold rounded-full">
                      ⭐ {locale === 'zh' ? '推荐' : 'Featured'}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#4A2C22] mb-2">
                  {title}
                </h1>
              </div>

              {/* 活动信息网格 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 pb-8 border-b-2 border-[#F0D3B6]">
                {/* 日期时间 */}
                <div className="flex items-start gap-3">
                  <div className="text-2xl">📅</div>
                  <div>
                    <h3 className="font-semibold text-[#4A2C22] mb-1">
                      {t('dateTime')}
                    </h3>
                    <p className="text-sm text-[#4A2C22]/70">
                      {formatDate(event.start_time)}
                    </p>
                    {event.end_time && event.end_time !== event.start_time && (
                      <p className="text-sm text-[#4A2C22]/70 mt-1">
                        {locale === 'zh' ? '至' : 'to'}{' '}
                        {formatDate(event.end_time)}
                      </p>
                    )}
                  </div>
                </div>

                {/* 地点 */}
                <div className="flex items-start gap-3">
                  <div className="text-2xl">📍</div>
                  <div>
                    <h3 className="font-semibold text-[#4A2C22] mb-1">
                      {t('location')}
                    </h3>
                    <p className="text-sm text-[#4A2C22]/70">{event.location}</p>
                  </div>
                </div>

                {/* 价格 */}
                {event.price && (
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💰</div>
                    <div>
                      <h3 className="font-semibold text-[#4A2C22] mb-1">
                        {t('price')}
                      </h3>
                      <p className="text-sm text-[#4A2C22]/70">{event.price}</p>
                    </div>
                  </div>
                )}

              </div>

              {/* 活动摘要 */}
              {summary && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-[#4A2C22] mb-3">
                    {locale === 'zh' ? '活动简介' : 'Summary'}
                  </h2>
                  <p className="text-[#4A2C22]/80 leading-relaxed">{summary}</p>
                </div>
              )}

              {/* 活动描述 */}
              {description && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-[#4A2C22] mb-3">
                    {t('description')}
                  </h2>
                  <div className="prose prose-sm max-w-none text-[#4A2C22]/80">
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={event.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-[#B37DA2] hover:bg-[#4A2C22] text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  {t('visitWebsite')}
                </a>
                <Link
                  href={`/${locale}`}
                  className="flex-1 text-center bg-white hover:bg-[#F0D3B6] text-[#4A2C22] font-semibold py-3 px-6 rounded-xl border-2 border-[#B37DA2] transition-all duration-300"
                >
                  {t('backToEvents')}
                </Link>
              </div>
            </div>
          </article>

          {/* 页脚信息 */}
          <div className="mt-8 text-center text-sm text-[#4A2C22]/60">
            <p>
              {locale === 'zh'
                ? '活动信息来源于官方网站，请以官方信息为准'
                : 'Event information is sourced from official websites. Please verify with official sources.'}
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
