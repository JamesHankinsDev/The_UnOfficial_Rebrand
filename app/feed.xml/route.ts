import { getPublishedArticles } from '@/lib/firestore'
import { generateExcerpt } from '@/lib/utils'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://the-un-official.com'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const articles = await getPublishedArticles({ lim: 50 })

  const items = articles.map((article) => {
    const pubDate = article.publishedAt
      ? new Date(article.publishedAt.toDate()).toUTCString()
      : new Date().toUTCString()
    const description = escapeXml(article.excerpt || generateExcerpt(article.content))
    const categories = [
      ...(article.series ? [article.series] : []),
      ...article.tags,
    ]

    return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${baseUrl}/posts/${article.slug}</link>
      <guid isPermaLink="true">${baseUrl}/posts/${article.slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <dc:creator>${escapeXml(article.authorName)}</dc:creator>
${categories.map((c) => `      <category>${escapeXml(c)}</category>`).join('\n')}
    </item>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The UnOfficial — NBA Analytics &amp; Takes</title>
    <link>${baseUrl}</link>
    <description>Serious Fans, UnSerious Takes. NBA analytics without the spin.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${baseUrl}/icon.png</url>
      <title>The UnOfficial</title>
      <link>${baseUrl}</link>
    </image>
${items.join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
