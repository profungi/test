import type { Metadata } from "next";

const BASE_URL = process.env.SITE_URL || 'https://bayareaselected.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Bay Area Selected Events | 湾区精选活动",
    template: "%s | Bay Area Selected Events",
  },
  description: "Discover the best events in the Bay Area! Markets, festivals, food, and art activities. Covering San Francisco, South Bay, East Bay, and more. 发现湾区最精彩的活动！",
  keywords: [
    "Bay Area events",
    "San Francisco events",
    "SF events",
    "Silicon Valley events",
    "Bay Area activities",
    "things to do Bay Area",
    "weekend events SF",
    "free events Bay Area",
    "markets Bay Area",
    "festivals Bay Area",
    "food events Bay Area",
    "art events Bay Area",
    "life in Bay Area",
    "湾区活动",
    "旧金山活动",
    "湾区周末",
    "免费活动",
    "湾区生活",
    "湾区艺术",
    "湾区美食",
    "湾区市集",
    "湾区节日",
  ],
  authors: [{ name: "Champagne Grape" }],
  creator: "Champagne Grape",
  publisher: "Champagne Grape",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "zh_CN",
    url: BASE_URL,
    siteName: "Bay Area Selected Events",
    title: "Bay Area Selected Events | 湾区精选活动",
    description: "Discover the best events in the Bay Area! Markets, festivals, food, and art activities. Weekly curated event listings.",
    images: [
      {
        url: "/grape-mascot.png",
        width: 512,
        height: 512,
        alt: "Bay Area Selected Events",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Bay Area Selected Events | 湾区精选活动",
    description: "Discover the best events in the Bay Area! Markets, festivals, food, and art activities.",
    images: ["/grape-mascot.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
    languages: {
      "en": `${BASE_URL}/en`,
      "zh": `${BASE_URL}/zh`,
    },
  },
  verification: {
    // 可以在这里添加 Google Search Console 验证码
    // google: 'your-google-verification-code',
  },
  category: "events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
