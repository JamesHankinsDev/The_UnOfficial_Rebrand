import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About | The UnOfficial',
  description: 'Serious fans. UnSerious takes. Learn about The UnOfficial NBA analytics blog.',
}

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-center gap-4 mb-8">
        <div className="relative w-16 h-16">
          <Image src="/logo.png" alt="The UnOfficial" fill className="object-contain" />
        </div>
        <div>
          <h1 className="font-mono font-bold text-4xl text-[#e8e6e3]">The UnOfficial</h1>
          <p className="text-[#8a8a94] font-mono">Serious Fans, UnSerious Takes.</p>
        </div>
      </div>

      <div className="prose prose-invert max-w-none">
        <p>
          The UnOfficial is a boutique NBA analytics publication for people who watched the tape,
          ran the numbers, and still can&apos;t believe what the front office did.
        </p>
        <p>
          We cover player valuation, contract analysis, draft evaluation, and the general chaos
          of running an NBA franchise — without the press access agenda and with all the
          spreadsheet energy.
        </p>
        <h2>What We Run</h2>
        <ul>
          <li>
            <strong>Value Meal</strong> — Contract value analysis. Who&apos;s getting paid right,
            who&apos;s getting robbed, and who signed a deal that should be a crime.
          </li>
          <li>
            <strong>Trajectory Twins</strong> — Comparing player development arcs. Who does this
            rookie remind you of? (Usually someone weird.)
          </li>
          <li>
            <strong>Picks Pops & Rolls</strong> — Draft takes, pick valuations, and the
            never-ending second-round debate.
          </li>
        </ul>
        <h2>The Voice</h2>
        <p>
          Sharp. Data-first. Occasionally unhinged. We don&apos;t chase narratives —
          we chase the numbers, then write about what we find in plain English.
        </p>
        <h2>Write For Us</h2>
        <p>
          Writers join by invite only. If you think you have the takes and the receipts to back
          them up, reach out on{' '}
          <a
            href="https://twitter.com/TheUnOfficial"
            target="_blank"
            rel="noopener noreferrer"
          >
            Twitter/X
          </a>
          .
        </p>
      </div>

      <div className="mt-12 flex gap-4">
        <Link
          href="/posts"
          className="px-5 py-2.5 bg-[#fbbf24] text-[#0a0a0f] font-mono font-bold rounded-lg hover:bg-[#f59e0b] transition-colors text-sm"
        >
          Read the Articles
        </Link>
        <Link
          href="/merch"
          className="px-5 py-2.5 border border-[#1e1e2a] text-[#8a8a94] font-mono rounded-lg hover:border-[#3a3a44] hover:text-[#e8e6e3] transition-colors text-sm"
        >
          Get the Merch
        </Link>
      </div>
    </div>
  )
}
