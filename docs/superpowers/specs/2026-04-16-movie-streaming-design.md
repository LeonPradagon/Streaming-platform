# Design Spec: Film Streaming Platform (Idlix-Style)

## Project Overview
Sebuah platform streaming film gratis yang berfokus pada konten **Anime** dan **Drakor**. Website ini menggunakan sistem **semi-otomatis** di mana scraper mencari data film dan link embed secara otomatis, namun membutuhkan persetujuan (approval) dari admin melalui dashboard sebelum tampil ke publik.

## Core Goals
- **Free Tier Operations**: Menggunakan layanan gratis (Vercel, Supabase, GitHub Actions) untuk operasional tanpa biaya bulanan.
- **TMDB Integration**: Menggunakan TMDB API sebagai sumber metadata utama.
- **Embedded Player**: Menghindari biaya storage/bandwidth dengan menggunakan sistem embed dari link eksternal.
- **Admin Dashboard**: Panel kontrol untuk mengelola link, menyetujui konten baru, dan memantau status sistem.

---

## Technical Architecture

### 1. Frontend & Admin Dashboard (Next.js)
- **Framework**: Next.js 16.2.4 (App Router).
- **React**: React 19+ (compatible with Next.js 16.2.4).
- **Styling**: Vanilla CSS / CSS Modules dengan pendekatan **Cinematic Dark Mode**.
- **State Management**: React Server Components & Server Actions.
- **Auth**: Supabase Auth (untuk membatasi akses ke dashboard admin).

### 2. Database & Backend (Supabase)
- **Database**: PostgreSQL (Supabase Free Tier).
- **Storage**: (Optional) Supabase Storage jika ingin menyimpan logo/aset kecil.
- **Functions**: API endpoints otomatis yang disediakan oleh Supabase.

### 3. Automation & Scraping (GitHub Actions)
- **Runner**: GitHub Actions (Cron Jobs).
- **Language**: Node.js script.
- **Logic**:
    1. Mengambil daftar film/drama populer terbaru dari TMDB.
    2. Mencari link embed dari aggregator (Vidsrc, Consumet, dll).
    3. Menyimpan data ke Supabase dengan status `pending`.

---

## Data Schema (Proposed)

### Table: `contents`
| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| tmdb_id | Integer | ID dari TMDB (Unique) |
| type | Enum | 'anime' or 'drakor' |
| status | Enum | 'pending' or 'approved' |
| created_at | Timestamp | Waktu ditambahkan |

### Table: `embed_links`
| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Primary Key |
| content_id | FK | Relasi ke `contents.id` |
| provider | String | Nama provider (e.g., 'Vidsrc') |
| url | String | URL link embed |
| quality | String | (Optional) 720p, 1080p, etc |

---

## UI/UX Design (Cinematic Dark Mode)
- **Background**: `#0F172A` (Slate-900) atau `#020617` (Slate-950).
- **Primary Accent**: Electric Purple atau Cyan untuk tombol hover.
- **Typography**: `Inter` (Sans-serif) untuk tampilan modern dan bersih.
- **Components**:
    - **Hero Section**: Menampilkan film unggulan dengan backdrop besar.
    - **Poster Grid**: Kartu film dengan hover effect glow.
    - **Custom Player**: Wrapper untuk iframe embed agar terlihat konsisten dengan tema.

---

## User Review Required
> [!IMPORTANT]
> - **TMDB API Key**: Anda perlu mendaftar di [TMDB](https://www.themoviedb.org/documentation/api) untuk mendapatkan API Key gratis.
> - **Provider Embed**: Beberapa link embed mungkin mengandung iklan bawaan dari provider asalnya; kita akan meminimalisirnya dengan sandbox iframe, namun tidak bisa hilang 100%.

## Verification Plan
1. **Scraping Test**: Menjalankan script scraper secara manual untuk memastikan data masuk ke Supabase.
2. **Dashboard Review**: Mencoba fitur 'Approve' dan memastikan film muncul di Landing Page.
3. **Player Test**: Memastikan iframe embed berjalan lancar di desktop dan mobile.
