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
  increment,
  runTransaction,
  writeBatch,
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

// --- Briefs ---

export type BriefDay = "monday" | "wednesday" | "friday";
export type BriefArticleType =
  | "value_meal"
  | "mix_tape"
  | "residue"
  | "picks_pops_rolls";
export type BriefStatus = "pending" | "ready" | "used";

export interface ValuePlay {
  playerId: number;
  playerName: string;
  team: string;
  pra: number;
  capPct: number | null;
  salary: number | null;
  contextNote: string;
}

export interface BriefContent {
  topValuePlays: ValuePlay[];
  narrativeHook: string;
  dataAnomalies: string[];
  injuryContext: string;
  tweetableBlurbs: string[];
}

export interface BriefDoc {
  id: string;
  day: BriefDay;
  articleType: BriefArticleType;
  content: BriefContent;
  status: BriefStatus;
  createdAt: Timestamp;
  generatedAt: Timestamp;
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

// --- Briefs ---

export async function getLatestBriefForType(
  articleType: BriefArticleType,
): Promise<BriefDoc | null> {
  const q = query(
    collection(db, "briefs"),
    where("articleType", "==", articleType),
    orderBy("generatedAt", "desc"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as BriefDoc;
}

export async function getLatestBrief(): Promise<BriefDoc | null> {
  const q = query(
    collection(db, "briefs"),
    orderBy("generatedAt", "desc"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as BriefDoc;
}

// --- TCG: Wallets ---

export type CardRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface WalletDoc {
  bucks: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: Timestamp;
}

export interface CardDoc {
  id: string;
  ownerId: string;
  playerId: number;
  nbaId?: number;
  playerName: string;
  teamAbbreviation: string;
  position: string;
  season: number;
  rarity: CardRarity;
  stats: {
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    pra: number;
    stocks: number;
  };
  acquiredAt: Timestamp;
  packId: string;
}

export interface PackDoc {
  id: string;
  userId: string;
  cardIds: string[];
  cost: number;
  openedAt: Timestamp;
}

export async function getWallet(uid: string): Promise<WalletDoc> {
  const snap = await getDoc(doc(db, "wallets", uid));
  if (!snap.exists()) {
    return { bucks: 0, totalEarned: 0, totalSpent: 0, updatedAt: Timestamp.now() };
  }
  return snap.data() as WalletDoc;
}

export async function creditBucks(uid: string, amount: number): Promise<void> {
  const ref = doc(db, "wallets", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      bucks: amount,
      totalEarned: amount,
      totalSpent: 0,
      updatedAt: Timestamp.now(),
    });
  } else {
    await updateDoc(ref, {
      bucks: increment(amount),
      totalEarned: increment(amount),
      updatedAt: Timestamp.now(),
    });
  }
}

export const PACK_COST = 15;
export const CARDS_PER_PACK = 7;

/**
 * Atomically deducts bucks and writes cards + pack record.
 * Returns the created cards on success, or throws if insufficient balance.
 */
export async function openPack(
  uid: string,
  cards: Omit<CardDoc, "id" | "acquiredAt" | "packId">[],
): Promise<{ packId: string; cards: CardDoc[] }> {
  const packId = uuidv4();
  const now = Timestamp.now();

  await runTransaction(db, async (tx) => {
    const walletRef = doc(db, "wallets", uid);
    const walletSnap = await tx.get(walletRef);

    const currentBucks = walletSnap.exists() ? (walletSnap.data().bucks as number) : 0;
    if (currentBucks < PACK_COST) {
      throw new Error("Insufficient UnOfficial Bucks");
    }

    // Deduct bucks
    if (walletSnap.exists()) {
      tx.update(walletRef, {
        bucks: increment(-PACK_COST),
        totalSpent: increment(PACK_COST),
        updatedAt: now,
      });
    } else {
      tx.set(walletRef, {
        bucks: -PACK_COST,
        totalEarned: 0,
        totalSpent: PACK_COST,
        updatedAt: now,
      });
    }

    // Write cards
    const cardIds: string[] = [];
    for (const card of cards) {
      const cardRef = doc(collection(db, "cards"));
      cardIds.push(cardRef.id);
      const cardData: Record<string, unknown> = {
        ...card,
        ownerId: uid,
        acquiredAt: now,
        packId,
      };
      if (cardData.nbaId === undefined) delete cardData.nbaId;
      tx.set(cardRef, cardData);
    }

    // Write pack record
    tx.set(doc(db, "packs", packId), {
      userId: uid,
      cardIds,
      cost: PACK_COST,
      openedAt: now,
    });
  });

  // Return the created cards for the reveal UI
  const createdCards: CardDoc[] = cards.map((c, i) => ({
    ...c,
    id: `pending-${i}`, // IDs are server-generated; re-fetch if needed
    ownerId: uid,
    acquiredAt: now,
    packId,
  }));

  return { packId, cards: createdCards };
}

export async function getUserCards(
  uid: string,
  opts?: { rarity?: CardRarity; lim?: number },
): Promise<CardDoc[]> {
  const constraints: Parameters<typeof query>[1][] = [
    where("ownerId", "==", uid),
    orderBy("acquiredAt", "desc"),
  ];
  if (opts?.rarity) constraints.push(where("rarity", "==", opts.rarity));
  if (opts?.lim) constraints.push(limit(opts.lim));
  const q = query(collection(db, "cards"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CardDoc);
}

export async function getUserCardCount(uid: string): Promise<number> {
  const q = query(collection(db, "cards"), where("ownerId", "==", uid));
  const snap = await getDocs(q);
  return snap.size;
}

/** Sells a single card: deletes it and credits bucks to the owner's wallet. */
export async function sellCard(
  cardId: string,
  uid: string,
  bucks: number,
): Promise<void> {
  const cardRef = doc(db, "cards", cardId);
  const walletRef = doc(db, "wallets", uid);

  await runTransaction(db, async (tx) => {
    const cardSnap = await tx.get(cardRef);
    if (!cardSnap.exists() || cardSnap.data().ownerId !== uid) {
      throw new Error("Card not found");
    }
    tx.delete(cardRef);
    const walletSnap = await tx.get(walletRef);
    if (walletSnap.exists()) {
      tx.update(walletRef, {
        bucks: increment(bucks),
        totalEarned: increment(bucks),
        updatedAt: Timestamp.now(),
      });
    } else {
      tx.set(walletRef, {
        bucks,
        totalEarned: bucks,
        totalSpent: 0,
        updatedAt: Timestamp.now(),
      });
    }
  });
}

/** Deletes all cards owned by the user. Firestore batches max 500 ops. */
export async function clearUserCards(uid: string): Promise<void> {
  const q = query(collection(db, "cards"), where("ownerId", "==", uid));
  const snap = await getDocs(q);
  const docs = snap.docs;
  // Process in chunks of 500 (Firestore batch limit)
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
