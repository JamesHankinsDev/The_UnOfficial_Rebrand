import React from 'react'

interface OrganizationJsonLdProps {
  baseUrl: string
}

export function OrganizationJsonLd({ baseUrl }: OrganizationJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'The UnOfficial',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'Serious Fans, UnSerious Takes. NBA analytics without the spin.',
    sameAs: [
      'https://twitter.com/TheUnOfficial',
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

interface WebSiteJsonLdProps {
  baseUrl: string
}

export function WebSiteJsonLd({ baseUrl }: WebSiteJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'The UnOfficial',
    url: baseUrl,
    description: 'Serious Fans, UnSerious Takes. NBA analytics without the spin.',
    publisher: {
      '@type': 'Organization',
      name: 'The UnOfficial',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
      },
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

interface ArticleJsonLdProps {
  title: string
  description: string
  url: string
  imageUrl?: string
  authorName: string
  publishedAt?: string
  modifiedAt?: string
  baseUrl: string
}

export function ArticleJsonLd({
  title,
  description,
  url,
  imageUrl,
  authorName,
  publishedAt,
  modifiedAt,
  baseUrl,
}: ArticleJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    image: imageUrl || `${baseUrl}/default-og.png`,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'The UnOfficial',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
      },
    },
    datePublished: publishedAt,
    dateModified: modifiedAt || publishedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
