import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let cachedDb: Firestore | null = null

function getAdminApp(): App {
  const existing = getApps()
  if (existing.length > 0) return existing[0]

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials missing. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.',
    )
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // Env-stored PEM keys use escaped newlines; unescape before handing to the SDK.
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  })
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb
  cachedDb = getFirestore(getAdminApp())
  return cachedDb
}
