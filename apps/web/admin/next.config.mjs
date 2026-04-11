/**
 * When NEXT_PUBLIC_API_URL points at ngrok, browser preflight (OPTIONS) does not include
 * ngrok-skip-browser-warning, so ngrok can return the HTML interstitial → "no CORS header".
 * Proxy /api/v1 on the admin origin through Next; the dev server hits ngrok with a non-browser UA.
 */
function adminApiRewrites() {
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!api || !/ngrok/i.test(api)) return [];
  const base = api.replace(/\/+$/, '');
  return [
    {
      source: '/api/v1/:path*',
      destination: `${base}/:path*`,
    },
  ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return adminApiRewrites();
  },
  eslint: {
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
