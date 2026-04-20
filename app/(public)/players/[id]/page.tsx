import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getApi } from '@/lib/balldontlie'
import { PublicPlayerProfileShell } from '@/components/analytics/PublicPlayerProfileShell'

export const revalidate = 300

interface Props {
  params: Promise<{ id: string }>
}

async function loadPlayer(id: string) {
  const playerId = parseInt(id, 10)
  if (!Number.isFinite(playerId)) return null
  try {
    const api = getApi()
    const res = await api.nba.getPlayer(playerId)
    const player = res?.data ?? res
    if (!player || (typeof player === 'object' && 'error' in player)) return null
    return player as {
      id: number
      first_name: string
      last_name: string
      position: string
      team?: { full_name: string; abbreviation: string } | null
    }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const player = await loadPlayer(id)
  if (!player) return { title: 'Player Not Found — The UnOfficial' }
  const name = `${player.first_name} ${player.last_name}`
  const teamBit = player.team?.full_name ? `, ${player.team.full_name}` : ''
  const positionBit = player.position ? ` (${player.position})` : ''
  return {
    title: `${name}${positionBit} — The UnOfficial`,
    description: `Stats, game log, and contract for ${name}${teamBit}.`,
  }
}

export default async function PublicPlayerPage({ params }: Props) {
  const { id } = await params
  const playerId = parseInt(id, 10)
  if (!Number.isFinite(playerId)) notFound()

  const player = await loadPlayer(id)
  if (!player) notFound()

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PublicPlayerProfileShell playerId={playerId} />
    </section>
  )
}
