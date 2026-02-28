import React from 'react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-[#1e1e2a] bg-[#0a0a0f] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="font-mono font-bold text-[#fbbf24] text-lg mb-2">The UnOfficial</div>
            <p className="text-sm text-[#5a5a64] leading-relaxed">
              Serious fans. UnSerious takes. NBA analytics without the spin.
            </p>
          </div>
          <div>
            <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase mb-3">
              Navigate
            </div>
            <div className="flex flex-col gap-2">
              {[
                ['/', 'Home'],
                ['/posts', 'Articles'],
                ['/merch', 'Merch'],
                ['/about', 'About'],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm text-[#8a8a94] hover:text-[#fbbf24] transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="font-mono text-xs tracking-widest text-[#5a5a64] uppercase mb-3">
              Series
            </div>
            <div className="flex flex-col gap-2">
              {[
                ['/posts?series=value-meal', 'Value Meal'],
                ['/posts?series=trajectory-twins', 'Trajectory Twins'],
                ['/posts?series=picks-pops-rolls', 'Picks Pops & Rolls'],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm text-[#8a8a94] hover:text-[#fbbf24] transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-[#1e1e2a] flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs font-mono text-[#5a5a64]">
            © {new Date().getFullYear()} The UnOfficial. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://buymeacoffee.com/theunofficialjb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-[#5a5a64] hover:text-[#fbbf24] transition-colors"
            >
              ☕ Tip the UnOfficial
            </a>
            <a
              href="https://twitter.com/TheUnOfficial"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-[#5a5a64] hover:text-[#fbbf24] transition-colors"
            >
              @TheUnOfficial
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
