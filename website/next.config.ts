import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // 确保 Vercel 部署时包含父目录的数据库文件
  outputFileTracingIncludes: {
    '/': ['../data/events.db'],
  },
  // 禁用构建时的 ESLint 检查 (避免 Next.js 内部 ESLint 配置警告)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(nextConfig);
