import { NextResponse } from 'next/server'
import { getApiKey } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

const BASE_URL = 'https://api.balldontlie.io/nba/v1'

interface ContractResult {
  player_id: number
  salary: number | null
}

async function fetchPlayerContract(id: string, apiKey: string): Promise<ContractResult> {
  try {
    const res = await fetch(`${BASE_URL}/contracts/players?player_id=${id}&per_page=100`, {
      headers: { Authorization: apiKey },
    })
    if (!res.ok) return { player_id: parseInt(id), salary: null }
    const data = await res.json()
    const records: Record<string, number>[] = data.data ?? []
    if (!records.length) return { player_id: parseInt(id), salary: null }
    const CURRENT = 2025
    const current = records.find(r => r.season === CURRENT) ?? records[records.length - 1]
    const salary = current.base_salary ?? current.cap_hit ?? null
    return { player_id: parseInt(id), salary }
  } catch {
    return { player_id: parseInt(id), salary: null }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const playerIds = searchParams.get('player_ids')

    if (!playerIds) {
      return NextResponse.json({ error: 'player_ids required' }, { status: 400 })
    }

    const apiKey = getApiKey()
    const ids = playerIds.split(',').map(id => id.trim()).filter(Boolean)

    const results = await Promise.all(
      ids.map((id) =>
        cached(`contract-${id}`, TTL.DAY, () =>
          fetchPlayerContract(id, apiKey)
        )
      )
    )

    return NextResponse.json(results)
  } catch (error) {
    console.error('Contracts error:', error)
    return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 })
  }
}
