import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'
import { containsProfanity } from '@/lib/content-filter'

const MAX_NAME_LENGTH = 50
const MAX_CONTENT_LENGTH = 2000

export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get('articleId')
  if (!articleId) {
    return NextResponse.json({ error: 'articleId required' }, { status: 400 })
  }

  try {
    const db = getAdminDb()
    const snap = await db
      .collection('comments')
      .where('articleId', '==', articleId)
      .orderBy('createdAt', 'asc')
      .get()

    const comments = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        articleId: data.articleId,
        displayName: data.displayName,
        content: data.content,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        reactions: (data.reactions as Record<string, number>) || {},
      }
    })

    return NextResponse.json({ comments })
  } catch {
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { articleId, displayName, content } = await req.json()

    // Validate required fields
    if (!articleId || typeof articleId !== 'string') {
      return NextResponse.json({ error: 'articleId is required.' }, { status: 400 })
    }
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json({ error: 'Display name is required.' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 })
    }

    const trimmedName = displayName.trim()
    const trimmedContent = content.trim()

    // Length limits
    if (trimmedName.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: `Name must be ${MAX_NAME_LENGTH} characters or less.` }, { status: 400 })
    }
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: `Comment must be ${MAX_CONTENT_LENGTH} characters or less.` }, { status: 400 })
    }

    // Profanity / hate speech filter
    if (containsProfanity(trimmedName) || containsProfanity(trimmedContent)) {
      return NextResponse.json(
        { error: 'Your comment was flagged for inappropriate language. Please revise and try again.' },
        { status: 422 },
      )
    }

    const db = getAdminDb()
    const now = Timestamp.now()
    const ref = await db.collection('comments').add({
      articleId,
      displayName: trimmedName,
      content: trimmedContent,
      createdAt: now,
    })

    return NextResponse.json({
      comment: {
        id: ref.id,
        articleId,
        displayName: trimmedName,
        content: trimmedContent,
        createdAt: now.toMillis(),
        reactions: {},
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to post comment.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const commentId = req.nextUrl.searchParams.get('id')
  if (!commentId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  // Verify admin via Firebase ID token
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { getAuth } = await import('firebase-admin/auth')
    const token = authHeader.split('Bearer ')[1]
    const decoded = await getAuth().verifyIdToken(token)
    const db = getAdminDb()
    const userSnap = await db.collection('users').doc(decoded.uid).get()
    const role = userSnap.data()?.role
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.collection('comments').doc(commentId).delete()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete comment.' }, { status: 500 })
  }
}
