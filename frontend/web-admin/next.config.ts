import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'localstack' },
    ],
  },
  async rewrites() {
    return [
      // Proxy streaming service calls — VideoPlayer fetches /api/stream/:videoId/manifest
      {
        source: '/api/stream/:path*',
        destination: 'http://localhost:8100/api/v1/stream/:path*',
      },
    ];
  },
};

export default nextConfig;
