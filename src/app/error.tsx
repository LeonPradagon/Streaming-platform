"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8 bg-zinc-900/50 p-10 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div className="flex justify-center">
          <div className="p-4 bg-red-500/10 rounded-full">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">Oops! Terjadi Kesalahan</h1>
          <p className="text-gray-400">
            Sesuatu tidak berjalan semestinya. Jangan khawatir, ini bukan salah Anda.
          </p>
        </div>

        <div className="flex flex-col space-y-3 pt-4">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center space-x-2 bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-xl transition-all active:scale-95"
          >
            <RefreshCcw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
          
          <Link
            href="/"
            className="flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-xl transition-all border border-white/5"
          >
            <Home className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        <div className="pt-6">
          <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
            Error Digest: {error.digest || "Internal Server Error"}
          </p>
        </div>
      </div>
    </div>
  );
}
