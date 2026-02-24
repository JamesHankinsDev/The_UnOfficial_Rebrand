import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

export async function uploadCoverImage(articleId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `articles/${articleId}/cover.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function uploadArticleImage(articleId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}.${ext}`
  const path = `articles/${articleId}/images/${filename}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function uploadAudio(articleId: string, blob: Blob): Promise<string> {
  const path = `articles/${articleId}/audio.webm`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob)
  return getDownloadURL(storageRef)
}

export async function uploadAudioFile(articleId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `articles/${articleId}/audio.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function deleteStorageFile(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch {
    // Ignore if file doesn't exist
  }
}
