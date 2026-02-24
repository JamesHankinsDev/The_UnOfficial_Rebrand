'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { getInvite } from '@/lib/firestore'
import { registerWithInvite } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function JoinPage() {
  const { inviteId } = useParams<{ inviteId: string }>()
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [inviteValid, setInviteValid] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!inviteId) return
    getInvite(inviteId).then(invite => {
      if (!invite) {
        setInviteError('This invite link is invalid or does not exist.')
      } else if (invite.used) {
        setInviteError('This invite has already been used.')
      } else if (invite.expiresAt.toMillis() < Date.now()) {
        setInviteError('This invite has expired. Links are only valid for 48 hours.')
      } else {
        setInviteValid(true)
      }
      setChecking(false)
    })
  }, [inviteId])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!displayName.trim()) e.displayName = 'Name is required.'
    if (!email.trim()) e.email = 'Email is required.'
    if (password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await registerWithInvite(inviteId, email, password, displayName)
      toast.success("You're in. Don't make us regret it.")
      router.push('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-mono text-[#5a5a64] animate-pulse">Verifying invite…</div>
      </div>
    )
  }

  if (!inviteValid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="font-mono text-2xl text-[#e8e6e3] mb-3">Not so fast.</div>
          <p className="text-[#8a8a94] mb-6">{inviteError}</p>
          <a
            href="https://twitter.com/TheUnOfficial"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-[#fbbf24] hover:text-[#f59e0b]"
          >
            Request a new invite →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <Image src="/logo.png" alt="The UnOfficial" fill className="object-contain" />
          </div>
          <h1 className="font-mono font-bold text-3xl text-[#e8e6e3] mb-2">
            You&apos;ve been invited.
          </h1>
          <p className="text-[#8a8a94]">Create your writer account to get started.</p>
        </div>

        <div className="bg-[#111118] border border-[#1e1e2a] rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Display Name"
              type="text"
              placeholder="How readers will see you"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              error={errors.displayName}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={errors.email}
            />
            <Input
              label="Password"
              type="password"
              placeholder="8+ characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={errors.password}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Same thing again"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
            />
            <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
              Create Account
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
