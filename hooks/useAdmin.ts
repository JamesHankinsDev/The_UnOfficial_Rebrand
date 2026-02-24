'use client'

import { useAuth } from '@/hooks/useAuth'

export function useAdmin() {
  const { user, role, loading } = useAuth()
  return {
    user,
    isAdmin: role === 'admin' || role === 'owner',
    isWriter: role === 'writer' || role === 'admin' || role === 'owner',
    loading,
  }
}
