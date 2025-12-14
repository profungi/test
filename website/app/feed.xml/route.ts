import { getEvents } from '@/lib/turso-db';

const BASE_URL = process.env.SITE_URL || 'https://bayareaselected.com';

export async function GET() {
  const events = await getEvents({ week: 'next', location: 'all', type: 'all', price: 'all' });

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Bay Area Selected Events</title>
    <link>${BASE_URL}</link>
    <description>Weekly curated event listings for the San Francisco Bay Area. Discover markets, festivals, food, art, music, and more.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE_URL}/grape-mascot.png</url>
      <title>Bay Area Selected Events</title>
      <link>${BASE_URL}</link>
    </image>
    ${events.slice(0, 20).map(event => `
    <item>
      <title><![CDATA[${event.name_en || event.name}]]></title>
      <link>${event.url || BASE_URL}</link>
      <description><![CDATA[${event.description_en || event.description || event.name_en || event.name} - ${event.location || 'Bay Area'} - ${event.price || 'Check event details'}]]></description>
      <pubDate>${new Date(event.date || Date.now()).toUTCString()}</pubDate>
      <guid isPermaLink="false">${event.id || event.url || `${BASE_URL}#${event.name}`}</guid>
      <category>${event.type || 'event'}</category>
    </item>`).join('')}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
