import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from './firestore.js'
import { ingestRecentGames, syncGames } from './ingest.js'

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000 // 5 min
const INGEST_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 h
const SYNC_GAMES_INTERVAL_MS = 30 * 1000 // 30 s — drives live score updates
const HEARTBEAT_DOC = 'live/_heartbeat'

let heartbeatTimer: NodeJS.Timeout | null = null
let ingestTimer: NodeJS.Timeout | null = null
let syncGamesTimer: NodeJS.Timeout | null = null
let ingestInFlight = false
let syncGamesInFlight = false
let shuttingDown = false

async function heartbeat(): Promise<void> {
  const db = getAdminDb()
  const [collection, doc] = HEARTBEAT_DOC.split('/')
  await db.collection(collection).doc(doc).set(
    {
      ts: FieldValue.serverTimestamp(),
      pid: process.pid,
      node: process.version,
    },
    { merge: true },
  )
}

async function heartbeatTick(): Promise<void> {
  if (shuttingDown) return
  try {
    await heartbeat()
  } catch (err) {
    console.error('[poller] heartbeat failed:', err)
  }
}

async function ingestTick(): Promise<void> {
  if (shuttingDown || ingestInFlight) return
  ingestInFlight = true
  try {
    const summary = await ingestRecentGames()
    console.log('[ingest] complete:', JSON.stringify(summary))
  } catch (err) {
    console.error('[ingest] fatal:', err)
  } finally {
    ingestInFlight = false
  }
}

async function syncGamesTick(): Promise<void> {
  if (shuttingDown || syncGamesInFlight) return
  syncGamesInFlight = true
  try {
    const summary = await syncGames()
    // Quieter than ingest — this runs every 30s, don't flood logs unless
    // something changed or failed.
    if (summary.errors > 0 || summary.rateLimitHits > 0) {
      console.log('[sync-games]', JSON.stringify(summary))
    }
  } catch (err) {
    console.error('[sync-games] fatal:', err)
  } finally {
    syncGamesInFlight = false
  }
}

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[poller] ${signal} received, shutting down`)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (ingestTimer) clearInterval(ingestTimer)
  if (syncGamesTimer) clearInterval(syncGamesTimer)
  // Allow any in-flight Firestore write to settle before exit.
  setTimeout(() => process.exit(0), 1000).unref()
}

async function main(): Promise<void> {
  console.log(`[poller] starting (node ${process.version})`)
  // Fail fast if Firestore credentials are missing — better than a silent
  // loop of errors.
  await heartbeat()
  console.log('[poller] firestore connection verified')

  // INGEST_ONCE=1 runs a single ingest cycle and exits. Useful for local
  // verification and one-off backfills without leaving the process running.
  if (process.env.INGEST_ONCE === '1') {
    console.log('[poller] INGEST_ONCE=1, running single ingest and exiting')
    await ingestTick()
    process.exit(0)
  }

  heartbeatTimer = setInterval(heartbeatTick, HEARTBEAT_INTERVAL_MS)
  ingestTimer = setInterval(ingestTick, INGEST_INTERVAL_MS)
  syncGamesTimer = setInterval(syncGamesTick, SYNC_GAMES_INTERVAL_MS)
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // Run both immediately so a fresh deploy has week games and player
  // stats available without waiting for the first timer tick.
  void ingestTick()
  void syncGamesTick()
}

main().catch((err) => {
  console.error('[poller] fatal:', err)
  process.exit(1)
})
