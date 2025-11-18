import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // 确保 Vercel 部署时包含父目录的数据库文件
  outputFileTracingIncludes: {
    '/': ['../data/events.db'],
  },

  // 禁用 Turbopack（使用 Webpack 更稳定）
  // Turbopack 在访问父目录时可能有权限问题
};

export default nextConfig;
