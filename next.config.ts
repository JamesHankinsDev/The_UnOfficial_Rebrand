import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Firebase Storage
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        // Shopify CDN
        protocol: 'https',
        hostname: '*.shopify.com',
        pathname: '/**',
      },
      {
        // Shopify CDN (CDN.shopify.com)
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
