'use client'

import { useState, useEffect } from 'react'

export interface NBATeamOption {
  id: number
  abbreviation: string
  full_name: string
}

/** Module-level cache so all components share the same data + fetch. */
let _cache: NBATeamOption[] | null = null
let _promise: Promise<NBATeamOption[]> | null = null

function fetchTeams(): Promise<NBATeamOption[]> {
  if (_cache) return Promise.resolve(_cache)
  if (_promise) return _promise

  _promise = fetch('/api/nba/teams')
    .then(r => r.ok ? r.json() : { teams: [] })
    .then(data => {
      const teams = (data.teams ?? data ?? []) as NBATeamOption[]
      const sorted = teams
        .filter(t => t.id >= 1 && t.id <= 30)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
      _cache = sorted
      return sorted
    })
    .catch(() => {
      _cache = []
      return []
    })
    .finally(() => { _promise = null })

  return _promise
}

/**
 * Shared hook for NBA team dropdown data.
 * Uses module-level cache — all components that call this share a single fetch.
 */
export function useNBATeams() {
  const [teams, setTeams] = useState<NBATeamOption[]>(_cache ?? [])
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) {
      setTeams(_cache)
      setLoading(false)
      return
    }
    fetchTeams().then(t => {
      setTeams(t)
      setLoading(false)
    })
  }, [])

  return { teams, loading }
}
