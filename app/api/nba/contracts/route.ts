import { NextResponse } from 'next/server'
import { getApiKey } from '@/lib/balldontlie'
import { cached, TTL } from '@/lib/api-cache'

const BASE_URL = 'https://api.balldontlie.io/nba/v1'

interface ContractResult {
  player_id: number
  salary: number | null
  contract?: unknown
}

async function fetchPlayerContract(id: string, apiKey: string): Promise<ContractResult> {
  try {
    const res = await fetch(`${BASE_URL}/player_contracts?player_id=${id}`, {
      headers: { Authorization: apiKey },
    })
    if (!res.ok) return { player_id: parseInt(id), salary: null }
    const data = await res.json()
    const contracts = data.data || data
    if (Array.isArray(contracts) && contracts.length > 0) {
      const contract = contracts[0]
      const salary = contract.player_option_amount
        || contract.salary
        || contract.amount
        || contract.value
      return { player_id: parseInt(id), salary: salary ?? null, contract }
    }
    return { player_id: parseInt(id), salary: null }
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
