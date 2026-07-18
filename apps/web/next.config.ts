import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: '11mb' } },
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@petcare/config', '@petcare/ui'],
};

export default nextConfig;
