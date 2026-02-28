import { BalldontlieAPI } from '@balldontlie/sdk'

/** NBA season year (2025 = the 2025-26 season) */
export const CURRENT_SEASON = 2025

let api: BalldontlieAPI | null = null

export function getApi(): BalldontlieAPI {
  if (api) return api

  const key = process.env.BALLDONTLIE_API_KEY
  if (!key) {
    throw new Error('BALLDONTLIE_API_KEY is not configured')
  }

  api = new BalldontlieAPI({ apiKey: key })
  return api
}

export function getApiKey(): string {
  const key = process.env.BALLDONTLIE_API_KEY
  if (!key) {
    throw new Error('BALLDONTLIE_API_KEY is not configured')
  }
  return key
}
