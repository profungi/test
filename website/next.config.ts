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
  // 排除 better-sqlite3 以避免 Vercel 构建错误
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 在服务器端忽略 better-sqlite3（Vercel 不支持 native modules）
      config.externals = config.externals || [];
      config.externals.push('better-sqlite3');
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
