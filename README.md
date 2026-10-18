# 🎬 NETIX - Modern Streaming Platform

A high-performance movie and TV show streaming platform built with Next.js 16, Supabase, and automated scraping services.

## 🚀 Fitur Utama
- **Otomatisasi Konten**: Scraper otomatis untuk film trending dan metadata TMDB.
- **Sistem Subtitle**: Pencarian dan sinkronisasi subtitle otomatis.
- **Admin Dashboard**: Panel kontrol lengkap untuk manajemen konten dan monitoring scraper.
- **Premium UI**: Desain responsif dan mewah menggunakan Tailwind CSS 4 dan Framer Motion.
- **Health Check**: Validasi link otomatis untuk memastikan link streaming selalu aktif.

## 📖 Panduan Struktur Proyek
Untuk memahami cara kerja setiap folder dan file dalam proyek ini, silakan baca panduan lengkapnya di sini:
👉 **[STRUCTURE.md](docs/STRUCTURE.md)**

## 🛠️ Cara Menjalankan Secara Lokal
1. Pastikan Anda memiliki Node.js terinstal.
2. Clone repository ini.
3. Instal dependencies: `npm install`.
4. Salin `.env.example` ke `.env.local` dan isi API Key Anda.
5. Jalankan server pengembangan: `npm run dev`.

### CinePro Core (opsional)
NETIX dapat memakai sumber video dari instance CinePro Core milik Anda. Jalankan Core secara terpisah (misalnya pada port `3100` agar tidak bentrok dengan NETIX di `3000`), lalu atur `CINEPRO_CORE_URL=http://localhost:3100` di `.env.local` NETIX. Core memerlukan `TMDB_API_KEY` milik Anda. Jika Core tidak tersedia atau tidak menemukan sumber, server NETIX yang sudah ada tetap digunakan.

---
*Dikembangkan oleh [Jhansen Wilson].*
