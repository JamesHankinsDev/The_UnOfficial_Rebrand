import type { Metadata } from 'next'
import { TradeMachine } from '@/components/trade-machine/TradeMachine'
import { AuthGate } from '@/components/auth/AuthGate'

export const metadata: Metadata = {
  title: 'NBA Trade Machine — The UnOfficial',
  description:
    'Build NBA trades with real salary data, CBA compliance checks, and projected win impact.',
}

export default function TradeMachinePage() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AuthGate
        featureName="trades"
        icon="🔁"
        reason="The Trade Machine saves your proposed trades to your account so you can revisit and refine them anytime."
      >
        <TradeMachine />
      </AuthGate>
    </section>
  )
}
