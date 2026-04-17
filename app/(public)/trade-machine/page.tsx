import type { Metadata } from 'next'
import { TradeMachine } from '@/components/trade-machine/TradeMachine'

export const metadata: Metadata = {
  title: 'NBA Trade Machine — The UnOfficial',
  description:
    'Build NBA trades with real salary data, CBA compliance checks, and projected win impact.',
}

export default function TradeMachinePage() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TradeMachine />
    </section>
  )
}
