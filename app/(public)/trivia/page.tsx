import type { Metadata } from 'next'
import { TriviaHub } from '@/components/trivia/TriviaHub'

export const metadata: Metadata = {
  title: 'NBA Trivia — The UnOfficial',
  description: 'Test your NBA knowledge. Draft IQ, PRA IQ, and STOCKS IQ trivia games.',
}

export default function TriviaPage() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TriviaHub />
    </section>
  )
}
