import type { Metadata } from 'next'
import { SeriesDetail } from '@/components/playoffs/SeriesDetail'

export const metadata: Metadata = {
  title: 'Playoff Series — The UnOfficial',
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ seriesId: string }>
}) {
  const { seriesId } = await params
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SeriesDetail seriesId={seriesId} />
    </section>
  )
}
