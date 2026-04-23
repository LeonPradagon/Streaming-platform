import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove X-Powered-By header to hide tech stack
  poweredByHeader: false,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'oqpubtvugpevpgflrjwv.supabase.co',
        port: '',
        pathname: '/**',
      }
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking — deny embedding in iframes from other sites
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Enable DNS prefetch for performance
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Enforce HTTPS (31536000 seconds = 1 year)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Disable unnecessary browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
