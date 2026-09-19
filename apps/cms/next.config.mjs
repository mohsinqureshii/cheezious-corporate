/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Served under `/admin` when the platform runs as one service, so that the
   * CMS and the public site can share a domain. Empty when the CMS has a
   * domain of its own, which is the better arrangement at scale.
   */
  basePath: process.env.CMS_BASE_PATH || undefined,

  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },

  async headers() {
    // The CMS handles personal data and privileged actions, so it is locked
    // down harder than the public site: never framed, never indexed, and no
    // referrer leakage to external tools.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
