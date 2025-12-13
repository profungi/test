interface WebsiteJsonLdProps {
  locale: string;
}

export function WebsiteJsonLd({ locale }: WebsiteJsonLdProps) {
  const BASE_URL = process.env.SITE_URL || 'https://bayareaselected.com';

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": locale === 'zh' ? "湾区精选活动" : "Bay Area Selected Events",
    "alternateName": locale === 'zh' ? "Bay Area Selected Events" : "湾区精选活动",
    "url": `${BASE_URL}/${locale}`,
    "description": locale === 'zh'
      ? "发现湾区最精彩的活动！市集、节日、美食、艺术活动一网打尽。"
      : "Discover the best events in the Bay Area! Markets, festivals, food, and art activities.",
    "inLanguage": locale === 'zh' ? "zh-CN" : "en-US",
    "publisher": {
      "@type": "Organization",
      "name": "Champagne Grape",
      "url": BASE_URL,
      "logo": {
        "@type": "ImageObject",
        "url": `${BASE_URL}/grape-mascot.png`
      }
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${BASE_URL}/${locale}?type={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface OrganizationJsonLdProps {
  locale: string;
}

export function OrganizationJsonLd({ locale }: OrganizationJsonLdProps) {
  const BASE_URL = process.env.SITE_URL || 'https://bayareaselected.com';

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Champagne Grape",
    "url": BASE_URL,
    "logo": `${BASE_URL}/grape-mascot.png`,
    "description": locale === 'zh'
      ? "湾区活动信息聚合平台"
      : "Bay Area event aggregation platform",
    "areaServed": {
      "@type": "Place",
      "name": "San Francisco Bay Area"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "email": "bayareaselected@gmail.com",
      "contactType": "customer service"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface BreadcrumbJsonLdProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface EventJsonLdProps {
  event: {
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    location: string;
    url?: string;
    price?: string;
    image?: string;
  };
}

export function EventJsonLd({ event }: EventJsonLdProps) {
  const BASE_URL = process.env.SITE_URL || 'https://bayareaselected.com';

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.name,
    "description": event.description || event.name,
    "startDate": event.startDate,
    "endDate": event.endDate || event.startDate,
    "location": {
      "@type": "Place",
      "name": event.location,
      "address": {
        "@type": "PostalAddress",
        "addressRegion": "California",
        "addressCountry": "US"
      }
    },
    "image": event.image || `${BASE_URL}/grape-mascot.png`,
    "url": event.url,
    "offers": event.price ? {
      "@type": "Offer",
      "price": event.price === "Free" || event.price === "免费" ? "0" : event.price,
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    } : undefined,
    "organizer": {
      "@type": "Organization",
      "name": "Champagne Grape",
      "url": BASE_URL
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface ItemListJsonLdProps {
  items: Array<{
    name: string;
    url: string;
    position: number;
  }>;
  locale: string;
}

export function ItemListJsonLd({ items, locale }: ItemListJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": locale === 'zh' ? "湾区活动列表" : "Bay Area Events List",
    "itemListElement": items.map((item) => ({
      "@type": "ListItem",
      "position": item.position,
      "name": item.name,
      "url": item.url
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
