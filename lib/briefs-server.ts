import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from './firebase-admin'
import type {
  BriefArticleType,
  BriefContent,
  BriefDay,
  BriefStatus,
} from './firestore'

interface SaveBriefInput {
  day: BriefDay
  articleType: BriefArticleType
  content: BriefContent
  status?: BriefStatus
}

export async function saveBrief(input: SaveBriefInput): Promise<string> {
  const db = getAdminDb()
  const now = Timestamp.now()
  const ref = await db.collection('briefs').add({
    day: input.day,
    articleType: input.articleType,
    content: input.content,
    status: input.status ?? 'ready',
    createdAt: now,
    generatedAt: now,
  })
  return ref.id
}
