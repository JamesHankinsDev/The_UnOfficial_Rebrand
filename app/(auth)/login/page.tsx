'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { login, loginWithGoogle } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const { user, role, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user && (role === 'writer' || role === 'admin' || role === 'owner')) {
      router.push('/dashboard')
    }
  }, [user, role, loading, router])

  const handleGoogleSignIn = async () => {
    setSubmitting(true)
    setError('')
    try {
      await loginWithGoogle()
      toast.success('Welcome back.')
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(email, password)
      toast.success('Welcome back.')
      router.push('/dashboard')
    } catch {
      setError('Invalid email or password. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-mono text-[#5a5a64] animate-pulse">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0a0a0f]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <Image src="/logo.png" alt="The UnOfficial" fill className="object-contain" />
          </div>
          <h1 className="font-mono font-bold text-2xl text-[#e8e6e3] mb-1">Writer Login</h1>
          <p className="text-sm text-[#5a5a64]">Dashboard access only.</p>
        </div>

        <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              error={error || undefined}
            />
            <Button type="submit" size="lg" loading={submitting} className="w-full mt-1">
              Sign In
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="text-xs font-mono text-brand-dim">or</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-brand-border bg-brand-black text-brand-gray text-sm font-mono hover:border-brand-dim hover:text-brand-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="text-center text-xs font-mono text-[#5a5a64] mt-6">
          No account?{' '}
          <a
            href="https://twitter.com/TheUnOfficial"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#fbbf24] hover:text-[#f59e0b]"
          >
            Request an invite
          </a>
        </p>
      </div>
    </div>
  )
}
