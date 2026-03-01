import type { MetadataRoute } from 'next'
import { getPublishedArticles } from '@/lib/firestore'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://the-un-official.com'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/posts`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/merch`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/trivia`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]

  // Dynamic article pages
  let articlePages: MetadataRoute.Sitemap = []
  try {
    const articles = await getPublishedArticles()
    articlePages = articles.map((article) => ({
      url: `${baseUrl}/posts/${article.slug}`,
      lastModified: article.updatedAt?.toDate() || article.publishedAt?.toDate() || new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch {
    // Sitemap still works with static pages if Firestore fails
  }

  return [...staticPages, ...articlePages]
}
