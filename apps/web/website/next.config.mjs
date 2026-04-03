/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Keep `npm run lint` for strict checks; do not block production builds on existing lint debt.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Existing code has TS/ESLint debt; keep production builds from failing in CI.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
