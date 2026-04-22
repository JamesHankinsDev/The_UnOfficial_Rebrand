import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from './firestore.js'

const HEARTBEAT_INTERVAL_MS = 10_000
const HEARTBEAT_DOC = 'live/_heartbeat'

let timer: NodeJS.Timeout | null = null
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

async function tick(): Promise<void> {
  if (shuttingDown) return
  try {
    await heartbeat()
    console.log(`[poller] alive @ ${new Date().toISOString()}`)
  } catch (err) {
    console.error('[poller] heartbeat failed:', err)
  }
}

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[poller] ${signal} received, shutting down`)
  if (timer) clearInterval(timer)
  // Let any in-flight Firestore write settle before the process exits.
  setTimeout(() => process.exit(0), 500).unref()
}

async function main(): Promise<void> {
  console.log(`[poller] starting (node ${process.version})`)
  // Fail fast if credentials are missing — better than a silent loop of errors.
  await heartbeat()
  console.log('[poller] firestore connection verified')

  timer = setInterval(tick, HEARTBEAT_INTERVAL_MS)
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('[poller] fatal:', err)
  process.exit(1)
})
