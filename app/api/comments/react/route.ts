import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

const ALLOWED_EMOJIS = ['🔥', '💯', '🏀', '🧊', '💀', '👀']

export async function POST(req: NextRequest) {
  try {
    const { commentId, emoji, action } = await req.json()

    if (!commentId || typeof commentId !== 'string') {
      return NextResponse.json({ error: 'commentId required' }, { status: 400 })
    }
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
    }
    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json({ error: 'action must be "add" or "remove"' }, { status: 400 })
    }

    const db = getAdminDb()
    const ref = db.collection('comments').doc(commentId)
    await ref.update({
      [`reactions.${emoji}`]: FieldValue.increment(action === 'add' ? 1 : -1),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to record reaction' }, { status: 500 })
  }
}
