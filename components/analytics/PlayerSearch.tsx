'use client'

import React, { useState, useRef, useCallback } from 'react'

interface Player {
  id: number
  first_name: string
  last_name: string
  position: string
  team: {
    full_name: string
    abbreviation: string
  }
}

interface PlayerSearchProps {
  onSelect: (player: Player) => void
  placeholder?: string
}

export function PlayerSearch({ onSelect, placeholder = 'Search players...' }: PlayerSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    setLoading(true)
    fetch(`/api/nba/players?search=${encodeURIComponent(q)}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setResults(data)
          setShowDropdown(true)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 350)
  }

  const handleSelect = (player: Player) => {
    setQuery(`${player.first_name} ${player.last_name}`)
    setShowDropdown(false)
    onSelect(player)
  }

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a64]"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder={placeholder}
          className="w-full bg-[#111118] border border-[#1e1e2a] text-[#e8e6e3] text-sm font-mono rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#fbbf24] transition-colors placeholder:text-[#5a5a64]"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[#fbbf24]/30 border-t-[#fbbf24] rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-[#111118] border border-[#1e1e2a] rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {results.map(player => (
            <button
              key={player.id}
              onMouseDown={() => handleSelect(player)}
              className="w-full text-left px-4 py-2.5 hover:bg-[#1e1e2a] transition-colors flex items-center justify-between"
            >
              <div>
                <span className="font-mono text-sm font-bold text-[#e8e6e3]">
                  {player.first_name} {player.last_name}
                </span>
                <span className="font-mono text-xs text-[#5a5a64] ml-2">
                  {player.position || '—'}
                </span>
              </div>
              <span className="font-mono text-xs text-[#8a8a94]">
                {player.team?.abbreviation ?? '—'}
              </span>
            </button>
          ))}
        </div>
      )}

      {showDropdown && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-20 mt-1 w-full bg-[#111118] border border-[#1e1e2a] rounded-lg shadow-xl px-4 py-3">
          <span className="font-mono text-sm text-[#5a5a64]">No players found</span>
        </div>
      )}
    </div>
  )
}
