import { NextResponse } from 'next/server'
import { getApiKey, CURRENT_SEASON } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

const BASE_URL = 'https://api.balldontlie.io/nba/v1'

export interface ContractYear {
  season: number
  salary: number | null
  incentives: number | null
  is_two_way: boolean
  qualifying_offer: boolean
  player_option: boolean
  team_option: boolean
}

export interface PlayerContract {
  id: number
  team: { id: number; abbreviation: string; full_name: string } | null
  years: ContractYear[]
}

export interface ContractAggregate {
  total_value: number | null
  years_remaining: number | null
  avg_annual_value: number | null
}

export interface ContractsResponse {
  current: PlayerContract | null
  aggregate: ContractAggregate | null
}

async function fetchContracts(
  playerId: number,
  apiKey: string,
): Promise<PlayerContract | null> {
  const res = await fetch(
    `${BASE_URL}/contracts/players?player_id=${playerId}&per_page=100`,
    { headers: { Authorization: apiKey } },
  )
  if (!res.ok) return null
  const json = await res.json()
  // Each record is one season entry: { season, base_salary, cap_hit, team, ... }
  const records: Record<string, unknown>[] = json.data ?? []
  if (!records.length) return null

  const years: ContractYear[] = records
    .map((r) => ({
      season: r.season as number,
      salary: (r.base_salary ?? r.cap_hit ?? null) as number | null,
      incentives: (r.incentives ?? null) as number | null,
      is_two_way: Boolean(r.is_two_way),
      qualifying_offer: Boolean(r.qualifying_offer),
      player_option: Boolean(r.player_option),
      team_option: Boolean(r.team_option),
    }))
    .sort((a, b) => a.season - b.season)

  const teamRecord = records.find((r) => r.team) ?? records[0]
  const team = teamRecord?.team as PlayerContract['team'] ?? null

  return { id: playerId, team, years }
}

async function fetchAggregate(
  playerId: number,
  apiKey: string,
): Promise<ContractAggregate | null> {
  const res = await fetch(
    `${BASE_URL}/contracts/players/aggregate?player_id=${playerId}`,
    { headers: { Authorization: apiKey } },
  )
  if (!res.ok) return null
  const json = await res.json()
  const record = json.data ?? json
  if (!record || typeof record !== 'object') return null

  return {
    total_value: record.total_value ?? null,
    years_remaining: record.years_remaining ?? null,
    avg_annual_value: record.avg_annual_value ?? record.average_annual_value ?? null,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const playerId = parseInt(id, 10)
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 })
    }

    const apiKey = getApiKey()

    const [current, aggregate] = await Promise.all([
      cached(`contracts-${playerId}`, TTL.DAY, () =>
        fetchContracts(playerId, apiKey),
      ),
      cached(`contracts-agg-${playerId}`, TTL.DAY, () =>
        fetchAggregate(playerId, apiKey),
      ),
    ])

    return NextResponse.json({ current, aggregate } satisfies ContractsResponse)
  } catch (error) {
    console.error('Contracts error:', error)
    return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 })
  }
}
