import { supabase } from "@/lib/supabase";
import { NETWORK_CONFIGS, PLATFORM_LABELS } from "@/lib/tmdb";
import Link from "next/link";
import { Tv, ChevronRight, Radio, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Network — Streaming Platforms",
  description: "Jelajahi konten dari berbagai platform streaming premium seperti Netflix, Disney+, HBO, Amazon Prime Video, Apple TV+ dan Paramount+.",
};

export default async function NetworkIndexPage() {
  // Fetch count for each platform
  const platformCounts: Record<string, number> = {};

  const results = await Promise.all(
    NETWORK_CONFIGS.map(async (net) => {
      const { count } = await supabase
        .from("contents")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .eq("platform", net.slug);
      return { slug: net.slug, count: count || 0 };
    })
  );

  results.forEach((r) => {
    platformCounts[r.slug] = r.count;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-32 px-4 md:px-12 lg:px-20 pb-24 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-red-600/5 blur-[150px] -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/5 blur-[150px] -z-10" />

      <div className="max-w-[1700px] mx-auto">
        {/* Header */}
        <header className="mb-16 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <Radio size={24} className="text-red-500" />
            </div>
            <div>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none">
                Network
              </h1>
              <p className="text-gray-500 font-bold tracking-[0.2em] text-[10px] uppercase mt-1">
                Streaming Platform Premium
              </p>
            </div>
          </div>
          <p className="text-gray-400 max-w-2xl font-medium leading-relaxed">
            Jelajahi koleksi konten dari platform streaming terkemuka di dunia. 
            Setiap network memiliki konten original dan eksklusif dengan kualitas terbaik.
          </p>
        </header>

        {/* Network Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {NETWORK_CONFIGS.map((net, idx) => (
            <Link
              key={net.slug}
              href={`/network/${net.slug}`}
              className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98]"
            >
              {/* Background Gradient */}
              <div 
                className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-700"
                style={{ 
                  background: `linear-gradient(135deg, ${net.color}40, transparent 60%)` 
                }}
              />

              {/* Content */}
              <div className="relative p-8 md:p-10 space-y-6">
                {/* Brand Initial */}
                <div className="flex items-start justify-between">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg group-hover:scale-110 transition-transform duration-500"
                    style={{ 
                      backgroundColor: net.color,
                      boxShadow: `0 0 40px ${net.color}30`
                    }}
                  >
                    {net.name.charAt(0)}
                  </div>
                  <ChevronRight 
                    size={20} 
                    className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all mt-2" 
                  />
                </div>

                {/* Info */}
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                    {net.name}
                  </h2>
                  <p className="text-gray-500 text-sm font-medium leading-relaxed line-clamp-2">
                    {net.description}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Tv size={14} className="text-gray-500" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                      <span style={{ color: net.color }} className="text-base font-black">
                        {platformCounts[net.slug] || 0}
                      </span>{" "}
                      Judul
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom glow line */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(90deg, transparent, ${net.color}, transparent)` }}
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
