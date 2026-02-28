import { BalldontlieAPI } from '@balldontlie/sdk'

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
