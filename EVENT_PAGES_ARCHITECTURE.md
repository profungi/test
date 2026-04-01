# 活动详情页架构和实现方案
# Event Detail Pages Architecture & Implementation Plan

## 概述 Overview

为湾区大型活动网站创建专门的活动详情页，优化 SEO 和 AI 搜索可见性。
Create dedicated event detail pages for Bay Area events with optimized SEO and AI search visibility.

---

## 一、技术架构 Technical Architecture

### 1.1 页面路由 Page Routing

**动态路由 Dynamic Route:**
```
/code/website/app/[locale]/events/[eventId]/page.tsx
```

**URL 格式 URL Format:**
- 中文: `/zh/events/123`
- 英文: `/en/events/123`

**未来优化 Future Enhancement (URL Slugs):**
- `/zh/events/123-grape-festival-2026`
- `/en/events/123-grape-festival-2026`

### 1.2 数据获取 Data Fetching

**使用现有函数 Use Existing Function:**
```typescript
import { getEventById } from '@/lib/turso-db';

// In page.tsx
const event = await getEventById(eventId);
```

**渲染策略 Rendering Strategy:**
- **ISR (Incremental Static Regeneration)** - 推荐
  - `revalidate: 3600` (1小时) - 平衡新鲜度和性能
  - 或 `revalidate: 86400` (24小时) - 活动信息变化较少

### 1.3 国际化 Internationalization

**继承现有 next-intl 配置 Inherit Existing Setup:**
```typescript
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

const t = await getTranslations('eventDetail');
```

**翻译文件结构 Translation Structure:**
```json
// messages/en.json & messages/zh.json
{
  "eventDetail": {
    "backToHome": "Back to Events",
    "dateTime": "Date & Time",
    "location": "Location",
    "price": "Price",
    "category": "Category",
    "description": "Description",
    "tips": "Tips",
    "organizer": "Organizer",
    "website": "Official Website",
    "relatedEvents": "Related Events",
    "shareEvent": "Share This Event"
  }
}
```

---

## 二、SEO 优化策略 SEO Optimization

### 2.1 Meta 标签 Meta Tags

**动态生成 Dynamic Generation:**
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventById(params.eventId);
  const locale = params.locale;

  const title = locale === 'zh' ? event.title_zh : event.title;
  const description = locale === 'zh' ? event.summary_zh : event.summary_en;

  return {
    title: `${title} | Bay Area Events`,
    description: description,
    keywords: [
      locale === 'zh' ? '湾区活动' : 'Bay Area Events',
      event.event_type,
      event.location,
      // ... more keywords
    ],
    openGraph: {
      title: title,
      description: description,
      type: 'event',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      alternateLocale: locale === 'zh' ? 'en_US' : 'zh_CN',
      url: `https://bayarea.events/${locale}/events/${params.eventId}`,
      images: event.image_url ? [{ url: event.image_url }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
    },
    alternates: {
      canonical: `https://bayarea.events/${locale}/events/${params.eventId}`,
      languages: {
        'en': `/en/events/${params.eventId}`,
        'zh': `/zh/events/${params.eventId}`,
      },
    },
  };
}
```

### 2.2 结构化数据 Structured Data (JSON-LD)

**Event Schema:**
```typescript
const eventSchema = {
  "@context": "https://schema.org",
  "@type": "Event",
  "name": locale === 'zh' ? event.title_zh : event.title,
  "description": locale === 'zh' ? event.summary_zh : event.summary_en,
  "startDate": event.start_time,
  "endDate": event.end_time,
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": event.location,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": event.location,
      "addressRegion": "CA",
      "addressCountry": "US"
    }
  },
  "offers": event.price ? {
    "@type": "Offer",
    "price": event.price.match(/\$(\d+)/)?.[1] || "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "url": event.event_link
  } : undefined,
  "organizer": event.organizer ? {
    "@type": "Organization",
    "name": event.organizer,
    "url": event.event_link
  } : undefined,
  "image": event.image_url || undefined,
  "url": `https://bayarea.events/${locale}/events/${params.eventId}`,
  "inLanguage": locale === 'zh' ? 'zh-CN' : 'en-US'
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": locale === 'zh' ? "首页" : "Home",
      "item": `https://bayarea.events/${locale}`
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": locale === 'zh' ? event.title_zh : event.title,
      "item": `https://bayarea.events/${locale}/events/${params.eventId}`
    }
  ]
};
```

**在页面中插入 Insert in Page:**
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
/>
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
/>
```

### 2.3 Sitemap 更新 Sitemap Update

**修改 `/code/website/app/sitemap.ts`:**
```typescript
import { getEvents } from '@/lib/turso-db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://bayarea.events';

  // 获取所有活动 Get all events
  const events = await getEvents({
    week: '', // All weeks
    location: 'All',
    type: 'All',
    priceFilter: 'All',
    searchTerm: ''
  });

  const locales = ['en', 'zh'];

  // 静态页面 Static pages
  const staticPages = [
    { url: '/', priority: 1.0 },
    { url: '/privacy', priority: 0.5 },
    { url: '/terms', priority: 0.5 }
  ];

  const staticEntries = staticPages.flatMap(page =>
    locales.map(locale => ({
      url: `${baseUrl}/${locale}${page.url}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: page.priority,
      alternates: {
        languages: {
          en: `${baseUrl}/en${page.url}`,
          zh: `${baseUrl}/zh${page.url}`
        }
      }
    }))
  );

  // 活动页面 Event pages
  const eventEntries = events.flatMap(event =>
    locales.map(locale => ({
      url: `${baseUrl}/${locale}/events/${event.id}`,
      lastModified: new Date(event.updated_at || event.scraped_at),
      changeFrequency: 'weekly' as const,
      priority: event.priority === 'high' ? 0.9 : 0.7,
      alternates: {
        languages: {
          en: `${baseUrl}/en/events/${event.id}`,
          zh: `${baseUrl}/zh/events/${event.id}`
        }
      }
    }))
  );

  return [...staticEntries, ...eventEntries];
}
```

### 2.4 Robots.txt

**已经配置好 Already Configured ✅**
- 你的 `/code/website/app/robots.ts` 已经允许所有主要 AI 爬虫
- GPTBot, Claude-Web, PerplexityBot, Google-Extended 等

### 2.5 AI 搜索优化 AI Search Optimization

**更新 `/code/website/public/llms.txt`:**
```markdown
# Bay Area Events - AI Crawler Guide

## Event Detail Pages

Individual event pages are available at:
- English: https://bayarea.events/en/events/{eventId}
- Chinese: https://bayarea.events/zh/events/{eventId}

Each event page includes:
- Bilingual event title, description, and tips
- Date, time, location, price information
- Event category and organizer details
- Structured data (JSON-LD) for rich snippets
- Related events suggestions

## Available Weeks
{list of available weeks from database}

## Event Categories
Music, Arts, Food & Drink, Sports, Technology, Family, Cultural, Night Life, Other

## Locations
San Francisco, Oakland, San Jose, Peninsula, East Bay, North Bay
```

---

## 三、页面布局设计 Page Layout Design

### 3.1 组件结构 Component Structure

```
EventDetailPage
├── Breadcrumb Navigation (首页 > 活动详情)
├── Event Header
│   ├── Title (中英双语)
│   ├── Category Badge
│   └── Share Buttons
├── Event Hero Image (if available)
├── Event Info Grid
│   ├── Date & Time
│   ├── Location
│   ├── Price
│   └── Organizer
├── Event Description (富文本)
├── Tips Section (if available)
├── Action Buttons
│   ├── Visit Official Website
│   └── Add to Calendar
├── Related Events (同类型/同地点)
└── Feedback Widget (复用现有)
```

### 3.2 响应式设计 Responsive Design

**移动端 Mobile:**
- 单列布局
- 固定底部 CTA 按钮
- 折叠式长描述

**桌面端 Desktop:**
- 左侧 70% - 活动详情
- 右侧 30% - 侧边栏 (相关活动、地图)

---

## 四、性能优化 Performance Optimization

### 4.1 图片优化 Image Optimization

```tsx
import Image from 'next/image';

{event.image_url && (
  <Image
    src={event.image_url}
    alt={locale === 'zh' ? event.title_zh : event.title}
    width={1200}
    height={630}
    priority
    className="rounded-xl"
  />
)}
```

### 4.2 代码分割 Code Splitting

```tsx
// 懒加载相关活动组件 Lazy load related events
const RelatedEvents = dynamic(() => import('@/components/RelatedEvents'), {
  loading: () => <div>Loading...</div>
});
```

### 4.3 缓存策略 Caching Strategy

```tsx
export const revalidate = 3600; // 1小时 ISR

export async function generateStaticParams() {
  // 为高优先级活动预生成页面 Pre-generate high priority events
  const events = await getEvents({
    week: '',
    location: 'All',
    type: 'All',
    priceFilter: 'All',
    searchTerm: ''
  });

  const highPriorityEvents = events
    .filter(e => e.priority === 'high')
    .slice(0, 50); // 限制预生成数量

  return highPriorityEvents.map(event => ({
    eventId: event.id.toString()
  }));
}
```

---

## 五、内部链接优化 Internal Linking

### 5.1 面包屑导航 Breadcrumb Navigation

```tsx
<nav className="text-sm mb-4">
  <Link href={`/${locale}`}>
    {t('eventDetail.home')}
  </Link>
  {' > '}
  <span>{event.week_start_date}</span>
  {' > '}
  <span className="text-purple-400">
    {locale === 'zh' ? event.title_zh : event.title}
  </span>
</nav>
```

### 5.2 相关活动 Related Events

**查询策略:**
```typescript
// 在 turso-db.ts 添加新函数
export async function getRelatedEvents(
  eventId: number,
  eventType: string,
  location: string,
  limit: number = 3
): Promise<Event[]> {
  const events = await client.execute({
    sql: `
      SELECT * FROM events
      WHERE id != ?
      AND (event_type = ? OR location = ?)
      AND end_time > datetime('now', 'localtime')
      ORDER BY
        CASE WHEN event_type = ? AND location = ? THEN 0
             WHEN event_type = ? THEN 1
             WHEN location = ? THEN 2
             ELSE 3
        END,
        priority DESC,
        start_time ASC
      LIMIT ?
    `,
    args: [eventId, eventType, location, eventType, location, eventType, location, limit]
  });

  return events.rows as unknown as Event[];
}
```

---

## 六、用户体验增强 UX Enhancements

### 6.1 Add to Calendar 功能

```typescript
function generateICS(event: Event, locale: string) {
  const title = locale === 'zh' ? event.title_zh : event.title;
  const description = locale === 'zh' ? event.summary_zh : event.summary_en;

  return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${event.start_time.replace(/[-:]/g, '').replace(' ', 'T')}
DTEND:${event.end_time.replace(/[-:]/g, '').replace(' ', 'T')}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${event.location}
URL:${event.event_link}
END:VEVENT
END:VCALENDAR`;
}

// 在组件中
<button onClick={() => {
  const ics = generateICS(event, locale);
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.id}-event.ics`;
  a.click();
}}>
  {t('eventDetail.addToCalendar')}
</button>
```

### 6.2 社交分享 Social Sharing

```tsx
const shareUrl = `https://bayarea.events/${locale}/events/${event.id}`;
const shareTitle = locale === 'zh' ? event.title_zh : event.title;

// Web Share API
<button onClick={() => {
  if (navigator.share) {
    navigator.share({
      title: shareTitle,
      text: locale === 'zh' ? event.summary_zh : event.summary_en,
      url: shareUrl
    });
  }
}}>
  {t('eventDetail.share')}
</button>
```

---

## 七、实施步骤 Implementation Steps

### Phase 1: 核心页面 Core Page (1-2天)
1. ✅ 创建 `/app/[locale]/events/[eventId]/page.tsx`
2. ✅ 实现基础布局和样式
3. ✅ 添加动态 metadata
4. ✅ 集成翻译

### Phase 2: SEO 优化 SEO Optimization (1天)
5. ✅ 添加 JSON-LD 结构化数据
6. ✅ 更新 sitemap.ts
7. ✅ 更新 llms.txt
8. ✅ 测试 Open Graph 预览

### Phase 3: 增强功能 Enhanced Features (1-2天)
9. ✅ 实现相关活动功能
10. ✅ 添加 Add to Calendar
11. ✅ 添加社交分享
12. ✅ 优化移动端体验

### Phase 4: 性能和测试 Performance & Testing (1天)
13. ✅ 配置 ISR revalidation
14. ✅ 图片优化
15. ✅ 测试各语言版本
16. ✅ Lighthouse 性能测试

---

## 八、监控指标 Monitoring Metrics

### 8.1 SEO 指标
- Google Search Console 收录数量
- 活动页面平均排名
- CTR (点击率)

### 8.2 用户指标
- 页面浏览量 (via Umami)
- 跳出率
- 平均停留时间
- 社交分享次数

### 8.3 AI 搜索指标
- ChatGPT/Perplexity 提及次数
- AI 生成的推荐流量
- llms.txt 访问统计

---

## 九、未来优化 Future Optimizations

### 9.1 URL Slugs
- `/events/123-grape-festival-2026` (更友好的 URL)
- 需要添加 slug 生成和路由逻辑

### 9.2 评论系统
- 活动评论和评分
- 用户照片上传

### 9.3 地图集成
- Google Maps embed
- 显示活动位置

### 9.4 个性化推荐
- 基于用户浏览历史
- 基于地理位置

---

## 十、关键文件清单 Key Files

**需要创建 To Create:**
- `/code/website/app/[locale]/events/[eventId]/page.tsx` (新)
- `/code/website/components/RelatedEvents.tsx` (新)
- `/code/website/components/AddToCalendar.tsx` (新)

**需要修改 To Modify:**
- `/code/website/app/sitemap.ts` (添加活动页面)
- `/code/website/lib/turso-db.ts` (添加 getRelatedEvents 函数)
- `/code/website/messages/en.json` (添加 eventDetail 命名空间)
- `/code/website/messages/zh.json` (添加 eventDetail 命名空间)
- `/code/website/public/llms.txt` (添加活动页面说明)

**参考文件 Reference:**
- `/code/website/app/[locale]/page.tsx` (现有首页布局)
- `/code/website/components/EventCard.tsx` (现有活动卡片)
- `/code/website/app/layout.tsx` (现有 metadata 设置)

---

## 总结 Summary

这个架构方案充分利用了你现有的 Next.js 15 基础设施，包括：
- ✅ 双语支持 (next-intl)
- ✅ Turso 数据库查询
- ✅ AI 爬虫友好配置
- ✅ Vercel 部署优化

通过实施这个方案，你将获得：
1. **SEO 优化** - 结构化数据、动态 metadata、sitemap
2. **AI 可发现性** - llms.txt、robots.txt、清晰的内容结构
3. **用户体验** - 双语、响应式、快速加载
4. **可维护性** - 复用现有组件、类型安全

预计总开发时间：**3-5天**，可立即开始实施！
