import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from './firestore.js'
import { ingestRecentGames } from './ingest.js'

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000 // 5 min
const INGEST_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 h
const HEARTBEAT_DOC = 'live/_heartbeat'

let heartbeatTimer: NodeJS.Timeout | null = null
let ingestTimer: NodeJS.Timeout | null = null
let ingestInFlight = false
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

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[poller] ${signal} received, shutting down`)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (ingestTimer) clearInterval(ingestTimer)
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
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // Run an ingest immediately so a fresh deploy doesn't have to wait 6h
  // for its first data pull.
  void ingestTick()
}

main().catch((err) => {
  console.error('[poller] fatal:', err)
  process.exit(1)
})
