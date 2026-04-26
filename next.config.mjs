/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Google avatar URLs from OAuth
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com' },
    ],
  },
  // Avoid bundling Prisma's generated client. Renamed out of `experimental`
  // in Next 15; the old key logs a warning but still works.
  serverExternalPackages: ['@prisma/client', 'prisma'],

  // Security headers applied to every response.
  // - HSTS: tells browsers "use HTTPS for this host, never HTTP again, for
  //   the next 2 years; same for any subdomain we add later." Once a
  //   browser has seen this header from us, it refuses to make HTTP
  //   requests to us at all — fixes the "Not Secure" stickiness that
  //   appears after an early HTTP hit.
  // - X-Content-Type-Options nosniff: stops MIME-confusion attacks.
  // - Referrer-Policy: don't leak the user's exact path to outbound links.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
