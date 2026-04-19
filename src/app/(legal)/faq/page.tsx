export const metadata = { title: 'FAQ' };

export default function FAQPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20 animate-fade-in text-gray-300">
      <h1 className="text-4xl font-black text-white mb-8 border-b border-white/10 pb-4">Frequently Asked Questions</h1>
      
      <div className="space-y-6">
        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            Bagaimana mengubah kualitas resolusi stream?
          </h3>
          <p className="text-gray-400">Tergantung server yang Anda pilih, Anda mungkin menemukan tombol gir ⚙️ kualitas di pojok pemutar video. Beberapa server hanya mendukung "Auto" dan bergantung pada kestabilan internet.</p>
        </div>

        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            Kenapa video lambat atau diblokir provider?
          </h3>
          <p className="text-gray-400">Server stream merupakan pihak eksternal, beberapa penyedia ISP acap kali melakukan blok DNS. Solusi termudah adalah dengan mengganti DNS perangkat Anda ke 1.1.1.1 (Cloudflare) atau menggunakan layanan sambungan Pribadi / VPN.</p>
        </div>

        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            Mengapa ada subtitle bahasa aneh yang tiba-tiba tayang?
          </h3>
          <p className="text-gray-400">Tekan tombol CC pada video player, lalu Anda bisa memilih bahasa Indonesia yang kami ambil langsung dan kami sinkronisasikan dari jaringan penerjemah OpenSubtitles.</p>
        </div>
      </div>
    </div>
  );
}
