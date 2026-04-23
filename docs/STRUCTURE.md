# 🗺️ Panduan Struktur Proyek NETIX

Dokumen ini menjelaskan organisasi file dan fungsi setiap komponen dalam aplikasi streaming ini untuk memudahkan navigasi bagi pengembang.

---

## 📂 Struktur Direktori Utama

### 1. `src/app` (Next.js App Router)
Berisi semua halaman (pages) dan rute API aplikasi.
- **`/admin`**: Panel administrasi untuk manajemen konten, pengguna, dan monitoring scraper.
- **`/browse`**: Fitur eksplorasi konten berdasarkan genre dan pencarian.
- **`/watch/[id]`**: Halaman pemutar video utama (Core Player).
- **`/auth`**, `/login`, `/register`: Sistem autentikasi pengguna.
- **`/api`**: Endpoint serverless untuk fungsi backend internal (seperti validasi link).
- **`(legal)`**: Folder grup untuk dokumen kebijakan (Privacy, Terms).

### 2. `src/services` (Business Logic)
Otak otomatisasi aplikasi.
- **`ScraperService.ts`**: Menangani pencarian konten baru dari provider luar, sinkronisasi TMDB, dan validasi link.
- **`SubtitleService.ts`**: Menangani pencarian, pengunduhan, dan penyimpanan subtitle secara otomatis.

### 3. `src/components` (UI Components)
Komponen visual yang dapat digunakan kembali.
- **`VideoPlayer.tsx`**: Pemutar video kustom dengan dukungan multi-source dan subtitle.
- **`MovieCard.tsx`**: Komponen tampilan poster film di grid.
- **`HeroCarousel.tsx`**: Slider utama di halaman depan.
- **`Navbar.tsx`**: Navigasi utama aplikasi.

### 4. `src/lib` (Utilities & Config)
Konfigurasi pihak ketiga dan fungsi pembantu.
- **`supabase.ts`**: Inisialisasi client database Supabase.
- **`tmdb.ts`**: Utilitas untuk berinteraksi dengan TMDB API.
- **`swal.ts`**: Helper untuk notifikasi pop-up yang cantik.
- **`useWatchlist.ts`**: Custom hook untuk manajemen daftar tontonan pengguna.

### 5. `scripts/` (Maintenance)
Skrip yang dijalankan di luar lingkungan browser.
- **`worker.ts`**: Menjalankan tugas rutin (Daily Scrape, Metadata Sync, Health Check).

### 6. `supabase/` (Database Schema)
Definisi tabel database, kebijakan keamanan (RLS), dan migrasi data.

---

## 🛠️ Alur Kerja Penting

### A. Cara Kerja Penambahan Konten Otomatis
1. `worker.ts` dijalankan oleh sistem.
2. Memanggil `ScraperService.runDiscovery()`.
3. Scraper mencari film di TMDB -> Mengecek link streaming di provider luar.
4. Jika ditemukan, data disimpan ke tabel `contents` dan `embed_links` di Supabase.
5. `SubtitleService` secara otomatis mencari subtitle untuk konten tersebut.

### B. Cara Kerja Pemutar Video
1. User membuka `/watch/[id]`.
2. Halaman mengambil data link dari tabel `embed_links`.
3. `VideoPlayer` mencoba memutar link pertama. Jika gagal, otomatis beralih ke link cadangan.
4. File subtitle dimuat dari Supabase Storage.

---

## 📜 Daftar File Konfigurasi Utama
- `package.json`: Daftar library/dependencies (Next.js 16, Tailwind 4, Supabase).
- `.env.local`: **(PENTING)** Berisi API Key TMDB dan Supabase. Jangan pernah dibagikan.
- `netlify.toml` / `vercel.json`: Konfigurasi untuk hosting/deployment.
- `tailwind.config.ts`: Pengaturan desain dan tema aplikasi.

---

*Dibuat otomatis oleh Antigravity untuk membantu pengembangan.*
