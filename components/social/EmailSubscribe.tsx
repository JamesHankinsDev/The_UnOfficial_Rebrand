'use client'

import React, { useState } from 'react'
import { addSubscriber } from '@/lib/firestore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface EmailSubscribeProps {
  source: string
}

export function EmailSubscribe({ source }: EmailSubscribeProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')
    try {
      await addSubscriber(email, source)
      setSuccess(true)
      setEmail('')
    } catch {
      setError('Something went sideways. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="font-mono font-bold text-[#fbbf24] mb-1">Locked in.</div>
        <p className="text-sm text-[#8a8a94]">The UnOfficial hits different in your inbox.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        error={error || undefined}
      />
      <Button type="submit" loading={loading} size="md" className="w-full">
        Subscribe
      </Button>
    </form>
  )
}
