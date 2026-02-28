import type { Metadata } from 'next'
import { DraftOrderGame } from '@/components/trivia/DraftOrderGame'

export const metadata: Metadata = {
  title: 'Draft IQ — The UnOfficial',
  description: 'Test your NBA draft knowledge. Rank 5 players by their draft position.',
}

export default function TriviaPage() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DraftOrderGame />
    </section>
  )
}
