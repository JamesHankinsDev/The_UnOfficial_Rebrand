'use client'

import React, { useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '@/contexts/AuthContext'
import { login, loginWithGoogle, registerMember } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

interface AuthGateProps {
  children: React.ReactNode
  featureName: string
  icon?: string
  reason?: string
}

function friendlyAuthError(err: unknown, fallback: string): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password.'
      case 'auth/email-already-in-use':
        return 'An account with that email already exists. Try signing in.'
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.'
      case 'auth/invalid-email':
        return 'That email address looks invalid.'
      case 'auth/popup-closed-by-user':
        return 'Sign-in cancelled.'
    }
  }
  return err instanceof Error ? err.message : fallback
}

export function AuthGate({ children, featureName, icon = '🔒', reason }: AuthGateProps) {
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <span className="font-mono text-sm text-[#5a5a64] animate-pulse">Loading…</span>
      </div>
    )
  }

  if (user) return <>{children}</>

  const defaultReason =
    'A free account lets us save your work so you can pick up right where you left off.'

  const handleGoogle = async () => {
    setSubmitting(true)
    setError('')
    try {
      await loginWithGoogle()
      toast.success(`Welcome to ${featureName}.`)
    } catch (err) {
      setError(friendlyAuthError(err, 'Google sign-in failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'signup') {
        await registerMember(email, password, displayName)
        toast.success(`Welcome to ${featureName}.`)
      } else {
        await login(email, password)
        toast.success('Welcome back.')
      }
    } catch (err) {
      setError(
        friendlyAuthError(
          err,
          mode === 'signup' ? 'Could not create account.' : 'Could not sign in.'
        )
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#fbbf24]/10 flex items-center justify-center text-2xl">
            {icon}
          </div>
          <h2 className="font-mono font-bold text-xl text-[#e8e6e3] mb-2">
            {mode === 'signup' ? `Save your ${featureName}` : 'Welcome back'}
          </h2>
          <p className="text-sm text-[#8a8a94]">{reason ?? defaultReason}</p>
          <p className="text-xs text-[#5a5a64] mt-2 font-mono tracking-wide">
            FREE — NO SUBSCRIPTION REQUIRED
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <Input
              label="Name"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            error={error || undefined}
          />
          <Button type="submit" size="lg" loading={submitting} className="w-full mt-1">
            {mode === 'signup' ? 'Create Free Account' : 'Sign In'}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#1e1e2a]" />
          <span className="text-xs font-mono text-[#5a5a64]">or</span>
          <div className="flex-1 h-px bg-[#1e1e2a]" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-[#1e1e2a] bg-[#0a0a0f] text-[#8a8a94] text-sm font-mono hover:border-[#5a5a64] hover:text-[#e8e6e3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-xs font-mono text-[#5a5a64] mt-6">
          {mode === 'signup' ? 'Already have an account?' : 'No account yet?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup')
              setError('')
            }}
            className="text-[#fbbf24] hover:text-[#f59e0b]"
          >
            {mode === 'signup' ? 'Sign in' : 'Create one free'}
          </button>
        </p>
      </div>
    </div>
  )
}
