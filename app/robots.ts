import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://the-un-official.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/login', '/join/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
