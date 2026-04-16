import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    const { articleId } = await req.json()
    if (!articleId || typeof articleId !== 'string') {
      return NextResponse.json({ error: 'articleId required' }, { status: 400 })
    }

    const db = getAdminDb()
    const ref = db.collection('articles').doc(articleId)
    await ref.update({ viewCount: FieldValue.increment(1) })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 })
  }
}
