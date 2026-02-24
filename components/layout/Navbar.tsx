'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/lib/auth'

const navLinks = [
  { href: '/posts', label: 'Articles' },
  { href: '/merch', label: 'Merch' },
  { href: '/about', label: 'About' },
]

export function Navbar() {
  const pathname = usePathname()
  const { user, role } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    window.location.href = '/'
  }

  return (
    <nav className="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="The UnOfficial"
                fill
                className="object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <span className="font-mono font-bold text-[#fbbf24] text-lg tracking-tight group-hover:text-[#f59e0b] transition-colors">
              The UnOfficial
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-sm font-mono tracking-wide rounded-md transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'text-[#fbbf24] bg-[#fbbf24]/10'
                    : 'text-[#8a8a94] hover:text-[#e8e6e3] hover:bg-[#1e1e2a]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth actions */}
          <div className="hidden md:flex items-center gap-3">
            {user && (role === 'writer' || role === 'admin') ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-mono text-[#8a8a94] hover:text-[#fbbf24] transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-mono text-[#5a5a64] hover:text-[#e8e6e3] transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm font-mono text-[#5a5a64] hover:text-[#8a8a94] transition-colors"
              >
                Writer Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-[#8a8a94] hover:text-[#e8e6e3] p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-[#1e1e2a] py-2">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-sm font-mono text-[#8a8a94] hover:text-[#fbbf24]"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {user && role ? (
              <>
                <Link
                  href="/dashboard"
                  className="block px-4 py-2 text-sm font-mono text-[#8a8a94] hover:text-[#fbbf24]"
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm font-mono text-[#5a5a64]"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="block px-4 py-2 text-sm font-mono text-[#5a5a64]"
                onClick={() => setMenuOpen(false)}
              >
                Writer Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
