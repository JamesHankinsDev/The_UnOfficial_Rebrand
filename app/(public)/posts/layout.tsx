import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Articles',
  description: 'All NBA analytics articles from The UnOfficial. Contract breakdowns, player comparisons, draft analysis, and more.',
  openGraph: {
    title: 'Articles | The UnOfficial',
    description: 'All NBA analytics articles from The UnOfficial.',
    type: 'website',
  },
}

export default function PostsLayout({ children }: { children: React.ReactNode }) {
  return children
}
