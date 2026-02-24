import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { slugify, calcReadTime, generateExcerpt } from "./utils";
import { v4 as uuidv4 } from "uuid";

export type UserRole = "writer" | "admin" | "owner" | "revoked";

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
  avatarUrl?: string;
}

export interface ArticleDoc {
  id: string;
  title: string;
  slug: string;
  authorId: string;
  authorName: string;
  content: string;
  excerpt: string;
  coverImageUrl?: string;
  audioUrl?: string;
  tags: string[];
  series?: "value-meal" | "trajectory-twins" | "picks-pops-rolls" | null;
  status: "draft" | "scheduled" | "published";
  featured: boolean;
  scheduledAt?: Timestamp | null;
  publishedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  readTimeMinutes: number;
  tweetPreview?: string;
}

export interface InviteDoc {
  id: string;
  createdBy: string;
  createdAt: Timestamp;
  usedAt?: Timestamp;
  usedBy?: string;
  expiresAt: Timestamp;
  used: boolean;
}

export interface SubscriberDoc {
  id: string;
  email: string;
  subscribedAt: Timestamp;
  source: string;
}

// --- Users ---

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserDoc;
}

export async function createUser(
  uid: string,
  data: Omit<UserDoc, "uid">,
): Promise<void> {
  await setDoc(doc(db, "users", uid), data);
}

export async function getAllUsers(): Promise<UserDoc[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserDoc);
}

export async function updateUserRole(
  uid: string,
  role: UserRole,
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role });
}

// --- Articles ---

async function generateUniqueSlug(
  title: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let counter = 2;
  while (true) {
    const q = query(collection(db, "articles"), where("slug", "==", slug));
    const snap = await getDocs(q);
    const conflict = snap.docs.find((d) => d.id !== excludeId);
    if (!conflict) break;
    slug = `${base}-${counter++}`;
  }
  return slug;
}

export async function createArticle(
  authorId: string,
  authorName: string,
  data: Partial<Omit<ArticleDoc, "id">>,
): Promise<string> {
  const slug = await generateUniqueSlug(data.title || "untitled");
  const now = Timestamp.now();
  const content = data.content || "";
  const articleData = {
    title: data.title || "Untitled",
    slug,
    authorId,
    authorName,
    content,
    excerpt: data.excerpt || generateExcerpt(content),
    coverImageUrl: data.coverImageUrl || null,
    audioUrl: data.audioUrl || null,
    tags: data.tags || [],
    series: data.series || null,
    status: data.status || "draft",
    featured: data.featured || false,
    scheduledAt: data.scheduledAt || null,
    publishedAt: data.status === "published" ? now : null,
    createdAt: now,
    updatedAt: now,
    readTimeMinutes: calcReadTime(content),
    tweetPreview: data.tweetPreview || null,
  };
  const ref = await addDoc(collection(db, "articles"), articleData);
  return ref.id;
}

export async function updateArticle(
  id: string,
  data: Partial<ArticleDoc>,
): Promise<void> {
  const updates: Record<string, unknown> = {
    ...data,
    updatedAt: Timestamp.now(),
  };
  if (data.content) {
    updates.excerpt = data.excerpt || generateExcerpt(data.content);
    updates.readTimeMinutes = calcReadTime(data.content);
  }
  if (data.title) {
    updates.slug = await generateUniqueSlug(data.title, id);
  }
  if (data.status === "published" && !data.publishedAt) {
    updates.publishedAt = Timestamp.now();
  }
  await updateDoc(doc(db, "articles", id), updates);
}

export async function deleteArticle(id: string): Promise<void> {
  await deleteDoc(doc(db, "articles", id));
}

export async function getArticleById(id: string): Promise<ArticleDoc | null> {
  const snap = await getDoc(doc(db, "articles", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ArticleDoc;
}

export async function getArticleBySlug(
  slug: string,
): Promise<ArticleDoc | null> {
  try {
    // Include status == 'published' so Firestore's rules engine can verify
    // unauthenticated reads are allowed. Two equality filters need no composite index.
    const q = query(
      collection(db, "articles"),
      where("slug", "==", slug),
      where("status", "==", "published"),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as ArticleDoc;
  } catch (err) {
    console.error("[getArticleBySlug] error:", err);
    return null;
  }
}

export async function getPublishedArticles(opts?: {
  series?: string;
  lim?: number;
}): Promise<ArticleDoc[]> {
  const constraints: Parameters<typeof query>[1][] = [
    where("status", "==", "published"),
    orderBy("publishedAt", "desc"),
  ];
  if (opts?.series) constraints.push(where("series", "==", opts.series));
  if (opts?.lim) constraints.push(limit(opts.lim));
  const q = query(collection(db, "articles"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ArticleDoc);
}

export async function getFeaturedArticles(): Promise<ArticleDoc[]> {
  const q = query(
    collection(db, "articles"),
    where("status", "==", "published"),
    where("featured", "==", true),
    orderBy("publishedAt", "desc"),
    limit(3),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ArticleDoc);
}

export async function getArticlesByAuthor(
  authorId: string,
): Promise<ArticleDoc[]> {
  const q = query(
    collection(db, "articles"),
    where("authorId", "==", authorId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ArticleDoc);
}

export async function getAllArticlesAdmin(): Promise<ArticleDoc[]> {
  const q = query(collection(db, "articles"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ArticleDoc);
}

export async function toggleFeatured(
  id: string,
  featured: boolean,
): Promise<void> {
  await updateDoc(doc(db, "articles", id), {
    featured,
    updatedAt: Timestamp.now(),
  });
}

export async function getUpcomingScheduled(): Promise<ArticleDoc[]> {
  const now = Timestamp.now();
  const cutoff = Timestamp.fromMillis(
    now.toMillis() + 14 * 24 * 60 * 60 * 1000,
  );
  const q = query(
    collection(db, "articles"),
    where("status", "==", "scheduled"),
    where("scheduledAt", ">", now),
    where("scheduledAt", "<=", cutoff),
    orderBy("scheduledAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ArticleDoc);
}

// --- Invites ---

export async function createInvite(createdBy: string): Promise<InviteDoc> {
  const id = uuidv4();
  const now = Timestamp.now();
  const data: Omit<InviteDoc, "id"> = {
    createdBy,
    createdAt: now,
    expiresAt: Timestamp.fromMillis(now.toMillis() + 48 * 60 * 60 * 1000),
    used: false,
  };
  await setDoc(doc(db, "invites", id), data);
  return { id, ...data };
}

export async function getInvite(id: string): Promise<InviteDoc | null> {
  const snap = await getDoc(doc(db, "invites", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as InviteDoc;
}

export async function markInviteUsed(id: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "invites", id), {
    used: true,
    usedAt: Timestamp.now(),
    usedBy: uid,
  });
}

export async function getAllInvites(): Promise<InviteDoc[]> {
  const q = query(collection(db, "invites"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InviteDoc);
}

// --- Subscribers ---

export async function addSubscriber(
  email: string,
  source: string,
): Promise<void> {
  // Use email as a stable document ID — no read needed (avoids permission-denied
  // for unauthenticated users) and duplicate subscribes are idempotent.
  const id = encodeURIComponent(email.toLowerCase());
  await setDoc(doc(db, "subscribers", id), {
    email,
    subscribedAt: Timestamp.now(),
    source,
  });
}

export async function getAllSubscribers(): Promise<SubscriberDoc[]> {
  const q = query(
    collection(db, "subscribers"),
    orderBy("subscribedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SubscriberDoc);
}
