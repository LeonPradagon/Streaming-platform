import Link from 'next/link';
import { Home, Search, Ghost } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8 bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl relative overflow-hidden group">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[80px] group-hover:bg-primary/30 transition-all duration-700" />
        
        <div className="flex justify-center relative">
          <div className="p-5 bg-white/5 rounded-3xl border border-white/10 animate-bounce">
            <Ghost size={64} className="text-gray-400" />
          </div>
        </div>
        
        <div className="space-y-3 relative">
          <h1 className="text-6xl font-black text-white tracking-tighter">404</h1>
          <h2 className="text-2xl font-bold text-gray-200">Halaman Tidak Ditemukan</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Sepertinya film yang Anda cari sudah dihapus atau link-nya salah. Jangan khawatir, masih banyak tontonan seru lainnya!
          </p>
        </div>

        <div className="flex flex-col space-y-3 pt-6 relative">
          <Link
            href="/"
            className="flex items-center justify-center space-x-2 bg-primary hover:bg-primary/90 text-white font-bold py-4 px-6 rounded-2xl transition-all active:scale-95 shadow-lg shadow-primary/20"
          >
            <Home className="w-5 h-5" />
            <span>Kembali ke Beranda</span>
          </Link>
          
          <Link
            href="/browse"
            className="flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-white font-semibold py-4 px-6 rounded-2xl transition-all border border-white/5"
          >
            <Search className="w-5 h-5" />
            <span>Cari Film Lainnya</span>
          </Link>
        </div>

        <div className="pt-8 opacity-20 group-hover:opacity-40 transition-opacity">
          <p className="text-[10px] text-white font-mono uppercase tracking-[0.3em]">
            Lost in Space?
          </p>
        </div>
      </div>
    </div>
  );
}
