import type { Metadata } from 'next'
import { PlayoffsHub } from '@/components/playoffs/PlayoffsHub'

export const metadata: Metadata = {
  title: '2026 NBA Playoffs — The UnOfficial',
  description:
    'Live 2026 NBA playoff bracket, series scores, and The UnOfficial\u2019s playoff coverage.',
}

export default function PlayoffsPage() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <PlayoffsHub />
    </section>
  )
}
