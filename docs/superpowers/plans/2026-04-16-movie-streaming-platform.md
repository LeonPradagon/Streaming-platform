# Movie Streaming Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun platform streaming film (Anime & Drakor) berbasis Next.js 16.2.4 dan Supabase dengan sistem scraping otomatis menggunakan TMDB.

**Architecture:** Frontend Next.js 16.2.4 (App Router) dengan Supabase sebagai BaaS (Database + Auth). Logika scraping dijalankan via script Node.js (untuk nantinya diletakkan di GitHub Actions).

**Tech Stack:** Next.js 16.2.4, React 19+, Supabase, TMDB API, CSS Modules (Vanilla), Lucide Icons.

---

### Task 1: Project Scaffolding
**Files:**
- Create: `package.json`, `next.config.js`, `tsconfig.json`
- Create: `lib/supabase.ts`
- Create: `.env.local`

- [ ] **Step 1: Initialize Next.js project**
    Run: `npx -y create-next-app@16.2.4 ./ --typescript --tailwind false --eslint --app --src-dir false --import-alias "@/*"`
- [ ] **Step 2: Install dependencies**
    Run: `npm install @supabase/supabase-js lucide-react`
- [ ] **Step 3: Setup Supabase Client**
    ```typescript
    // lib/supabase.ts
    import { createClient } from '@supabase/supabase-js';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    export const supabase = createClient(supabaseUrl, supabaseAnonKey);
    ```
- [ ] **Step 4: Commit**
    `git add . && git commit -m "chore: initial project scaffolding with supabase"`

---

### Task 2: Database Schema & Auth
**Files:**
- Create: `supabase/migrations/20260416_initial_schema.sql`

- [ ] **Step 1: Define Table Schema**
    Buat tabel `contents` (tmdb_id, type, status) dan `embed_links` (content_id, url) di Supabase.
- [ ] **Step 2: Setup RLS (Row Level Security)**
    Pastikan `contents` hanya bisa diinsert oleh admin (authenticated) dan bisa dibaca publik jika `status = 'approved'`.
- [ ] **Step 3: Commit**
    `git add supabase/ && git commit -m "feat: initial database schema and RLS"`

---

### Task 3: TMDB Metadata Service
**Files:**
- Create: `lib/tmdb.ts`

- [ ] **Step 1: Implement TMDB Fetcher**
    ```typescript
    // lib/tmdb.ts
    export const fetchTMDBMetadata = async (id: number, type: 'movie' | 'tv') => {
      const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${process.env.TMDB_API_KEY}`);
      return res.json();
    };
    ```
- [ ] **Step 2: Commit**
    `git add lib/tmdb.ts && git commit -m "feat: add tmdb metadata service"`

---

### Task 4: Scraper Logic (Core)
**Files:**
- Create: `scripts/scraper.js`

- [ ] **Step 1: Implement basic scraper template**
    Script untuk mengambil trending Anime/Drakor dari TMDB dan mencari link embed dummy.
- [ ] **Step 2: Run test integration**
    Run: `node scripts/scraper.js` (Verify data masuk ke Supabase dengan status 'pending')
- [ ] **Step 3: Commit**
    `git add scripts/ && git commit -m "feat: add initial scraper logic"`

---

### Task 5: Admin Dashboard UI
**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/layout.tsx`

- [ ] **Step 1: Build Login page for Admin**
- [ ] **Step 2: Build Content Approval List**
    Tampilkan daftar film dengan status 'pending'. Berikan tombol 'Approve' dan 'Delete'.
- [ ] **Step 3: Commit**
    `git commit -m "feat: add admin dashboard for content approval"`

---

### Task 6: Main UI - Cinematic Dark Mode
**Files:**
- Modify: `app/globals.css`
- Create: `app/page.tsx`
- Create: `components/MovieCard.tsx`
- Create: `app/watch/[id]/page.tsx`

- [ ] **Step 1: Apply Global Dark Theme (Slate-950)**
- [ ] **Step 2: Build Homepage Grid**
- [ ] **Step 3: Build Watch Page with Iframe Embed**
- [ ] **Step 4: Commit**
    `git commit -m "feat: implement main cinematic UI and watch page"`
