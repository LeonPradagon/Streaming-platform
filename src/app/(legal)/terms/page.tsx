export const metadata = { title: 'Terms of Use' };

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20 animate-fade-in text-gray-300">
      <h1 className="text-4xl font-black text-white mb-8 border-b border-white/10 pb-4">Terms of Use</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-primary mb-4">1. Pendahuluan</h2>
          <p className="leading-relaxed">Selamat datang di NETIX. Dengan mengakses situs ini, Anda menyetujui persyaratan penggunaan yang telah kami buat untuk melindungi hak dan kenyamanan bersama. Jika Anda tidak setuju, mohon untuk tidak menggunakan layanan ini.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-primary mb-4">2. Layanan Disediakan "Seadanya"</h2>
          <p className="leading-relaxed">Platform kami hanya berupa web indexer. Seluruh video dan tayangan yang tersedia dihasilkan dari mesin peramban eksternal (Pihak Ketiga) yang sepenuhnya berada di luar Server NETIX.</p>
        </section>
        
        <section>
          <h2 className="text-2xl font-bold text-primary mb-4">3. Penghapusan Konten</h2>
          <p className="leading-relaxed">Kami mematuhi hukum hak cipta (DMCA). Jika Anda merupakan perwakilan sah dari perusahaan pemegang hak cipta dan menemukan konten yang melanggar, Anda bebas menghubungi kami melalui panel laporan untuk segera kami hapus referensi linknya dari sistem kami.</p>
        </section>
      </div>
    </div>
  );
}
