export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20 animate-fade-in text-gray-300">
      <h1 className="text-4xl font-black text-white mb-8 border-b border-white/10 pb-4">Privacy Policy</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-primary mb-4">1. Data Apa Saja yang Kami Simpan?</h2>
          <p className="leading-relaxed">Kami hanya menyimpan pengaturan profil, riwayat durasi (Continue Watching), dan daftar simpanan (Watchlist) agar Anda tidak kehilangan jejak penjelajahan. Akses login disediakan aman sepenuhnya oleh Supabase Auth tanpa campur tangan dari developer secara langsung.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-primary mb-4">2. Cookies dan Pelacakan Lanjut</h2>
          <p className="leading-relaxed">Kami menggunakan session cookie fungsional demi mencegah log-in ulang setiap masuk web. Kami juga menggunakan analitik bawaan Vercel yang sama sekali tidak melacak keunikan spesifik identitas di luar browser.</p>
        </section>
      </div>
    </div>
  );
}
