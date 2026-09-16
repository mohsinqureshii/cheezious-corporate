/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // Media is served by the API (local disk in development, S3-compatible in
    // deployment). Remote patterns are derived from the configured URLs.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 828, 1080, 1280, 1600, 1920, 2560],
  },

  experimental: {
    optimizePackageImports: ['@cheezious/page-builder'],
  },

  // Linting runs as its own CI step (`pnpm lint`) across the whole workspace, so
  // the build is not also a linter. A style warning should not be able to fail a
  // deployment of correct code.
  eslint: { ignoreDuringBuilds: true },

  async headers() {
    // Security headers for an HTML-serving app. The API sets its own, stricter set.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },

  async redirects() {
    // The corporate experience lives under a locale prefix; bare paths are
    // resolved by middleware, which can honour an Accept-Language preference.
    return [];
  },
};

export default nextConfig;
