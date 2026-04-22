import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { verifyCallerUid } from '@/lib/api-auth'
import {
  applyCap,
  currentEarnWindowStart,
  nextEarnWindowStart,
  DAILY_EARN_CAP,
} from '@/lib/earn-cap'

const ALLOWED_SOURCES = new Set([
  'trivia.draft-order',
  'trivia.stat-ranking',
])
const MAX_AMOUNT_PER_CALL = 50 // single-call guard — no legit earn source awards more than this

export interface EarnResponse {
  credited: number
  wasOverCap: boolean
  willCapAfter: boolean
  earnedInWindow: number
  cap: number
  resetsInMs: number
  newBalance: number
}

export async function POST(request: NextRequest) {
  let uid: string
  try {
    uid = await verifyCallerUid(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { source?: unknown; amount?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const source = typeof body.source === 'string' ? body.source : ''
  const amount = typeof body.amount === 'number' ? body.amount : NaN

  if (!ALLOWED_SOURCES.has(source)) {
    return NextResponse.json({ error: 'invalid_source' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT_PER_CALL) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })
  }
  const requested = Math.floor(amount)

  try {
    const db = getAdminDb()
    const walletRef = db.collection('wallets').doc(uid)
    const now = new Date()
    const windowStartNow = currentEarnWindowStart(now)

    const result = await db.runTransaction<EarnResponse>(async (tx) => {
      const snap = await tx.get(walletRef)
      const data = snap.exists ? snap.data() ?? {} : {}

      const storedWindowStart = data.windowStart as Timestamp | undefined
      const storedEarnedInWindow = (data.earnedInWindow as number) ?? 0

      // Roll the window if the stored anchor is stale (user's first earn
      // of a new day) or if the wallet pre-dates the earn-cap schema.
      const inSameWindow =
        storedWindowStart != null &&
        storedWindowStart.toMillis() === windowStartNow.getTime()
      const earnedInWindow = inSameWindow ? storedEarnedInWindow : 0

      const app = applyCap({ earnedInWindow, windowStart: windowStartNow }, requested, now)

      const currentBucks = (data.bucks as number) ?? 0
      const currentTotalEarned = (data.totalEarned as number) ?? 0
      const currentTotalSpent = (data.totalSpent as number) ?? 0
      const nowTs = Timestamp.fromDate(now)
      const windowTs = Timestamp.fromDate(windowStartNow)

      if (snap.exists) {
        tx.update(walletRef, {
          bucks: FieldValue.increment(app.credited),
          totalEarned: FieldValue.increment(app.credited),
          earnedInWindow: app.newEarnedInWindow,
          windowStart: windowTs,
          updatedAt: nowTs,
        })
      } else {
        tx.set(walletRef, {
          bucks: currentBucks + app.credited,
          totalEarned: currentTotalEarned + app.credited,
          totalSpent: currentTotalSpent,
          earnedInWindow: app.newEarnedInWindow,
          windowStart: windowTs,
          updatedAt: nowTs,
        })
      }

      return {
        credited: app.credited,
        wasOverCap: app.wasOverCap,
        willCapAfter: app.willCapAfter,
        earnedInWindow: app.newEarnedInWindow,
        cap: DAILY_EARN_CAP,
        resetsInMs: app.resetsInMs,
        newBalance: currentBucks + app.credited,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[earn] fatal:', err)
    return NextResponse.json({ error: 'earn_failed' }, { status: 500 })
  }
}

/**
 * GET returns the caller's current cap state without crediting anything.
 * Used by the UI to show "X/100 earned today · resets in Yh" badge.
 */
export async function GET(request: NextRequest) {
  let uid: string
  try {
    uid = await verifyCallerUid(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const db = getAdminDb()
    const snap = await db.collection('wallets').doc(uid).get()
    const data = snap.exists ? snap.data() ?? {} : {}
    const now = new Date()
    const windowStartNow = currentEarnWindowStart(now)
    const storedWindowStart = data.windowStart as Timestamp | undefined
    const inSameWindow =
      storedWindowStart != null &&
      storedWindowStart.toMillis() === windowStartNow.getTime()
    const earnedInWindow = inSameWindow ? (data.earnedInWindow as number) ?? 0 : 0
    const resetsInMs = Math.max(
      0,
      nextEarnWindowStart(now).getTime() - now.getTime(),
    )
    return NextResponse.json({
      earnedInWindow,
      cap: DAILY_EARN_CAP,
      resetsInMs,
    })
  } catch (err) {
    console.error('[earn] state fetch failed:', err)
    return NextResponse.json({ error: 'state_failed' }, { status: 500 })
  }
}
