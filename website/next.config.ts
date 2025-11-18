import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // 确保 Vercel 部署时包含父目录的数据库文件
  outputFileTracingIncludes: {
    '/': ['../data/events.db'],
  },
};

export default nextConfig;
