/**
 * Feature gates controlled by environment variables.
 *
 * Set in .env.local (or per-environment in Vercel):
 *   NEXT_PUBLIC_ENABLE_TRADE_MACHINE=true
 *   NEXT_PUBLIC_ENABLE_CARDS=true
 *
 * Omitting or setting to any other value disables the feature.
 */
export const features = {
  tradeMachine: process.env.NEXT_PUBLIC_ENABLE_TRADE_MACHINE === 'true',
  cards: process.env.NEXT_PUBLIC_ENABLE_CARDS === 'true',
} as const

/** Routes that are gated behind feature flags. */
export const GATED_ROUTES: Record<string, keyof typeof features> = {
  '/trade-machine': 'tradeMachine',
  '/cards': 'cards',
}
