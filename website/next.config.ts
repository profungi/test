import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // 确保 Vercel 部署时包含父目录的数据库文件
  outputFileTracingIncludes: {
    '/': ['../data/events.db'],
  },
};

export default withNextIntl(nextConfig);
