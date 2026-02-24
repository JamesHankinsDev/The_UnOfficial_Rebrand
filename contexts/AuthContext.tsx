'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from 'firebase/auth'
import { onAuthChange } from '@/lib/auth'
import { getUser, UserDoc, UserRole } from '@/lib/firestore'

interface AuthContextValue {
  user: User | null
  userDoc: UserDoc | null
  role: UserRole | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userDoc: null,
  role: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const doc = await getUser(firebaseUser.uid)
        setUserDoc(doc)
      } else {
        setUserDoc(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{ user, userDoc, role: userDoc?.role ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
