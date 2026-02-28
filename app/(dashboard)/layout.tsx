'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/lib/auth'
import { useEffect } from 'react'

const navItems = [
  { href: '/dashboard/articles', label: 'My Articles' },
  { href: '/dashboard/articles/new', label: '+ New Article' },
  { href: '/dashboard/analytics', label: 'Analytics' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && (!user || (role !== 'writer' && role !== 'admin' && role !== 'owner'))) {
      router.push('/login')
    }
  }, [user, role, loading, router])

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

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-[#1e1e2a] flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="p-5 border-b border-[#1e1e2a]">
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
              className={`px-3 py-2 text-sm font-mono rounded-md transition-colors ${
                pathname === item.href
                  ? 'bg-[#fbbf24]/10 text-[#fbbf24]'
                  : 'text-[#8a8a94] hover:text-[#e8e6e3] hover:bg-[#1e1e2a]'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {(role === 'admin' || role === 'owner') && (
            <>
              <Link
                href="/dashboard/admin"
                className={`px-3 py-2 text-sm font-mono rounded-md transition-colors ${
                  pathname === '/dashboard/admin'
                    ? 'bg-[#fbbf24]/10 text-[#fbbf24]'
                    : 'text-[#8a8a94] hover:text-[#e8e6e3] hover:bg-[#1e1e2a]'
                }`}
              >
                Admin
              </Link>
              <Link
                href="/dashboard/admin/migrate"
                className={`px-3 py-2 text-sm font-mono rounded-md transition-colors ${
                  pathname === '/dashboard/admin/migrate'
                    ? 'bg-[#fbbf24]/10 text-[#fbbf24]'
                    : 'text-[#8a8a94] hover:text-[#e8e6e3] hover:bg-[#1e1e2a]'
                }`}
              >
                Migrate V1
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[#1e1e2a]">
          <div className="flex items-center justify-between mb-3">
            <div>
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
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
