'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/lib/auth'

const navItems = [
  { href: '/dashboard', label: 'Home' },
  { href: '/dashboard/articles', label: 'My Articles' },
  { href: '/dashboard/articles/new', label: '+ New Article' },
  { href: '/dashboard/brief', label: 'Morning Brief' },
  { href: '/dashboard/analytics', label: 'Analytics' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!loading && (!user || (role !== 'writer' && role !== 'admin' && role !== 'owner'))) {
      router.push('/login')
    }
  }, [user, role, loading, router])

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [drawerOpen])

  const closeDrawer = () => setDrawerOpen(false)

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="font-mono text-[#5a5a64] animate-pulse">Loading dashboard…</div>
      </div>
    )
  }

  if (!user || (role !== 'writer' && role !== 'admin' && role !== 'owner')) {
    return null
  }

  const navLinkClass = (href: string) =>
    `px-3 py-2 text-sm font-mono rounded-md transition-colors ${
      pathname === href
        ? 'bg-[#fbbf24]/10 text-[#fbbf24]'
        : 'text-[#8a8a94] hover:text-[#e8e6e3] hover:bg-[#1e1e2a]'
    }`

  return (
    <div className="min-h-screen bg-[#0a0a0f] md:flex">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-[#0a0a0f] border-b border-[#1e1e2a] flex items-center justify-between px-4 h-14">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="relative w-6 h-6">
            <Image src="/logo.png" alt="The UnOfficial" fill className="object-contain" />
          </div>
          <span className="font-mono font-bold text-[#fbbf24] text-sm">The UnOfficial</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="text-[#8a8a94] hover:text-[#e8e6e3] p-2 -mr-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile backdrop */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-50 md:z-auto
          w-64 md:w-60 h-screen flex-shrink-0
          border-r border-[#1e1e2a] bg-[#0a0a0f]
          flex flex-col overflow-y-auto
          transition-transform duration-200 ease-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Mobile close */}
        <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-[#1e1e2a]">
          <span className="font-mono text-xs tracking-widest uppercase text-[#5a5a64]">
            Menu
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="text-[#8a8a94] hover:text-[#e8e6e3] p-2 -mr-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Desktop logo */}
        <div className="hidden md:block p-5 border-b border-[#1e1e2a]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative w-7 h-7">
              <Image src="/logo.png" alt="The UnOfficial" fill className="object-contain" />
            </div>
            <span className="font-mono font-bold text-[#fbbf24] text-sm">The UnOfficial</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeDrawer}
              className={navLinkClass(item.href)}
            >
              {item.label}
            </Link>
          ))}
          {(role === 'admin' || role === 'owner') && (
            <>
              <Link
                href="/dashboard/admin"
                onClick={closeDrawer}
                className={navLinkClass('/dashboard/admin')}
              >
                Admin
              </Link>
              <Link
                href="/dashboard/admin/migrate"
                onClick={closeDrawer}
                className={navLinkClass('/dashboard/admin/migrate')}
              >
                Migrate V1
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[#1e1e2a]">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <div className="text-xs font-mono text-[#e8e6e3] truncate">
                {user.email}
              </div>
              <div className="text-xs font-mono text-[#5a5a64] uppercase tracking-widest">
                {role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-xs font-mono text-[#5a5a64] hover:text-[#e8e6e3] text-left transition-colors"
          >
            Logout →
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  )
}
