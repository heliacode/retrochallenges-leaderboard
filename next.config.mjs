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
};

export default nextConfig;
