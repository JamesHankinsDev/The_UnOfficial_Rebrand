# The UnOfficial — NBA Analytics Blog Platform

Serious Fans, UnSerious Takes.

Full-stack blog platform built with Next.js 14 App Router, Firebase, and Tailwind CSS.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS v4 + Space Mono / DM Sans |
| Database | Firebase Firestore |
| Auth | Firebase Auth (email/password) |
| Storage | Firebase Storage |
| Editor | Tiptap (rich text) |
| Commerce | Shopify Storefront API |
| Toasts | react-hot-toast |

---

## Setup

### 1. Clone & Install

```bash
npm install
```

### 2. Environment Variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Fill in the values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=          # Firebase Console → Project Settings → Your Apps
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=      # e.g. the-unofficial-758da.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=       # the-unofficial-758da
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=   # e.g. the-unofficial-758da.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
SHOPIFY_STOREFRONT_ACCESS_TOKEN=       # Shopify Admin → Apps → Storefront API
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=      # e.g. your-store.myshopify.com
NEXT_PUBLIC_SITE_URL=                  # e.g. https://the-un-official.com
```

### 3. Firebase Setup

#### Create Firestore Indexes

The following composite indexes are required (Firestore will prompt you with links on first query failure):

- `articles`: `(status ASC, publishedAt DESC)`
- `articles`: `(status ASC, featured ASC, publishedAt DESC)`
- `articles`: `(status ASC, series ASC, publishedAt DESC)`
- `articles`: `(status ASC, scheduledAt ASC)`
- `articles`: `(authorId ASC, createdAt DESC)`

#### Deploy Security Rules

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools
firebase login
firebase use the-unofficial-758da

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage
```

#### Create Your First Admin User

1. Register via `/join/{inviteId}` — or create directly in Firebase Auth console
2. In Firestore Console, create a document in `/users/{uid}`:

```json
{
  "email": "you@example.com",
  "displayName": "Your Name",
  "role": "admin",
  "createdAt": <Timestamp>
}
```

### 4. Fix Route Conflict (Required)

**Delete `app/page.tsx`** — the scaffolded Next.js default page conflicts with `app/(public)/page.tsx`. The homepage is served by the route group.

```bash
rm app/page.tsx
```

### 5. Run Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

```
app/
  layout.tsx                    Root layout (AuthProvider, Toaster)
  (public)/
    layout.tsx                  Public layout (Navbar + Footer)
    page.tsx                    Homepage (/)
    posts/page.tsx              All articles (/posts)
    posts/[slug]/page.tsx       Article page (/posts/[slug])
    about/page.tsx              About (/about)
    merch/page.tsx              Shopify merch (/merch)
    join/[inviteId]/page.tsx    Writer registration (/join/[id])
  (auth)/
    login/page.tsx              Login (/login)
  (dashboard)/
    layout.tsx                  Dashboard layout (sidebar + auth guard)
    dashboard/page.tsx          Redirects to /dashboard/articles
    dashboard/articles/         My articles list
    dashboard/articles/new/     New article editor
    dashboard/articles/[id]/edit/ Edit article
    dashboard/admin/            Admin panel

components/
  ui/           Button, Input, Textarea, Badge, Modal, Select, Toggle
  layout/       Navbar, Footer
  articles/     ArticleCard, FeaturedBanner, SeriesBadge
  social/       ShareButton, TweetButton, TweetPreview, AudioPlayer,
                EmailSubscribe, ShareBar, ReadTimeDisplay
  editor/       RichTextEditor (Tiptap), AudioRecorder, ImageUploader,
                ArticleEditor (full editor page component)
  dashboard/    (admin components in admin page)

lib/
  firebase.ts   Firebase init (auth, db, storage)
  firestore.ts  All Firestore CRUD helpers + data types
  storage.ts    Firebase Storage upload helpers
  auth.ts       Auth helpers (login, logout, registerWithInvite)
  shopify.ts    Shopify Storefront API client
  utils.ts      slugify, calcReadTime, generateExcerpt, formatDate, tweetUrl
```

---

## Features

### Public Site
- **Homepage** — Hero, featured articles (3-up grid), upcoming scheduled teasers, recent articles, email subscribe, merch strip
- **Articles list** — Filter by series tabs, scheduled article previews with COMING badge
- **Article page** — Cover image, audio player (if present), full content, share/tweet buttons, related articles, subscribe CTA
- **SEO** — Full `generateMetadata` with OpenGraph + Twitter cards on article pages
- **About page** — Brand info and series descriptions
- **Merch page** — Shopify Storefront API integration, product grid, direct checkout links

### Authentication
- Email/password login
- Invite-only writer registration (`/join/[inviteId]`)
- Role-based access (`writer`, `admin`, `revoked`)
- Auth context via `AuthProvider` / `useAuth` hook

### Writer Dashboard
- Articles list with status, featured toggle, edit/delete actions
- Rich text editor (Tiptap): bold, italic, headings, lists, blockquote, code, links, inline images
- Cover image upload (drag & drop or click)
- Audio recording (MediaRecorder API) or file upload
- Metadata sidebar: tags, series, status, scheduled date, featured toggle, tweet preview
- Auto-save every 60 seconds when editing

### Admin Panel
- Generate invite links (48hr expiry, copy-to-clipboard)
- Writers management (view, revoke access)
- All articles across writers (feature/unfeature, delete)
- Subscribers list with CSV export

---

## Series Color System

| Series | Slug | Color |
|---|---|---|
| Value Meal | `value-meal` | Gold `#fbbf24` |
| Trajectory Twins | `trajectory-twins` | Green `#10b981` |
| Picks Pops & Rolls | `picks-pops-rolls` | Orange `#f97316` |

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.local.example`
4. Deploy

Set `NEXT_PUBLIC_SITE_URL` to your production domain for correct share/tweet links.

---

## Brand Voice Quick Reference

| Context | Copy |
|---|---|
| Empty articles | "Nothing published yet. Don't sleep on the content calendar." |
| Dashboard welcome | "What are we cooking today?" |
| Subscribe success | "Locked in. The UnOfficial hits different in your inbox." |
| Invite success | "You're in. Don't make us regret it." |
