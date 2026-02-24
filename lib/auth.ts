import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { Timestamp } from 'firebase/firestore'
import { auth } from './firebase'
import { createUser, getUser, markInviteUsed, getInvite, UserDoc } from './firestore'

const googleProvider = new GoogleAuthProvider()

export async function login(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function loginWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider)
  const userDoc = await getUser(cred.user.uid)
  if (!userDoc || (userDoc.role !== 'writer' && userDoc.role !== 'admin' && userDoc.role !== 'owner')) {
    await signOut(auth)
    throw new Error('No writer account found for this Google account. Request an invite.')
  }
  return cred.user
}

export async function logout(): Promise<void> {
  await signOut(auth)
}

export async function registerWithInvite(
  inviteId: string,
  email: string,
  password: string,
  displayName: string
): Promise<UserDoc> {
  const invite = await getInvite(inviteId)
  if (!invite) throw new Error('Invite not found.')
  if (invite.used) throw new Error('This invite has already been used.')
  if (invite.expiresAt.toMillis() < Date.now()) throw new Error('This invite has expired.')

  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const uid = cred.user.uid

  const userDocData: Omit<UserDoc, 'uid'> = {
    email,
    displayName,
    role: 'writer',
    createdAt: Timestamp.now(),
  }

  await createUser(uid, userDocData)
  await markInviteUsed(inviteId, uid)

  return { uid, ...userDocData }
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}
