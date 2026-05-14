import { createClient } from '@/lib/supabase/server';
import { NETWORK_CONFIGS } from '@/lib/tmdb';
import { 
  Tv, 
  Activity, 
  ArrowRight, 
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

export default async function AdminNetworks() {
  const supabase = await createClient();

  // Parallel counts for all networks
  const counts = await Promise.all([
    ...NETWORK_CONFIGS.map(net => 
      supabase.from('contents').select('*', { count: 'exact', head: true }).eq('platform', net.slug)
    ),
    supabase.from('contents').select('*', { count: 'exact', head: true }).eq('platform', 'other'),
    supabase.from('contents').select('*', { count: 'exact', head: true }).is('platform', null),
  ]);

  const totalContents = await supabase.from('contents').select('*', { count: 'exact', head: true });
  const totalCount = totalContents.count || 0;
  const otherCount = (counts[NETWORK_CONFIGS.length]?.count || 0) + (counts[NETWORK_CONFIGS.length + 1]?.count || 0);

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-[#eab308]/10 rounded-xl">
              <Tv className="text-[#eab308]" size={28} />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">Network <span className="text-[#eab308]">Control</span></h2>
          </div>
          <p className="text-zinc-500 font-medium tracking-wide">Analisis dan manajemen konten berdasarkan platform streaming.</p>
        </div>
        
        <div className="flex gap-4">
          <Link 
            href="/admin/scraper"
            className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Activity size={16} /> Buka Scraper
          </Link>
          <ReclassifyButton />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-8 rounded-[2.5rem] border border-white/5">
          <div className="flex justify-between items-start mb-6">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Total Database</span>
            <Film className="text-zinc-700" size={20} />
          </div>
          <div className="text-5xl font-black text-white tracking-tighter mb-2">{totalCount}</div>
          <div className="text-xs font-bold text-zinc-500">Seluruh item di katalog</div>
        </div>

        <div className="glass p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
            <CheckCircle2 size={120} />
          </div>
          <div className="flex justify-between items-start mb-6">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Terklasifikasi</span>
            <CheckCircle2 className="text-emerald-500" size={20} />
          </div>
          <div className="text-5xl font-black text-emerald-500 tracking-tighter mb-2">{totalCount - otherCount}</div>
          <div className="text-xs font-bold text-zinc-500">Berhasil dipetakan ke network</div>
        </div>

        <div className="glass p-8 rounded-[2.5rem] border border-red-500/10 bg-red-500/[0.02] group">
          <div className="flex justify-between items-start mb-6">
            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Belum Terklasifikasi</span>
            <AlertTriangle className="text-red-500" size={20} />
          </div>
          <div className="text-5xl font-black text-red-500 tracking-tighter mb-2">{otherCount}</div>
          <div className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
             Gunakan re-classify untuk memetakan ulang
          </div>
        </div>
      </div>

      {/* Networks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {NETWORK_CONFIGS.map((net, idx) => (
          <div key={net.slug} className="glass group p-8 rounded-[2.5rem] border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row items-center gap-8">
            <div 
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-white font-black text-4xl shadow-2xl transition-transform group-hover:scale-105 shrink-0"
              style={{ backgroundColor: net.color, boxShadow: `0 20px 40px ${net.color}20` }}
            >
              {net.name.charAt(0)}
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{net.name}</h3>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">{net.description}</p>
              <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                 <div className="flex flex-col">
                    <span className="text-sm font-black text-white">{counts[idx]?.count || 0}</span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Judul</span>
                 </div>
                 <div className="w-px h-8 bg-white/5" />
                 <div className="flex flex-col">
                    <span className="text-sm font-black text-emerald-500">Live</span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Status</span>
                 </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col gap-2 w-full md:w-auto">
              <Link 
                href={`/admin/catalog?platform=${net.slug}`}
                className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                Catalog <ArrowRight size={14} />
              </Link>
              <Link 
                href={`/network/${net.slug}`}
                target="_blank"
                className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                Public <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Client component for the Re-classify button
 */
function ReclassifyButton() {
  return (
    <form action={async () => {
       'use server';
       // We'll use the API route via server action or just direct redirect
       // For now, simpler: redirect to scraper page with task in query or something
       // But let's actually implement a basic client component for this to show progress
    }}>
      <Link
        href="/admin/scraper?task=reclassify"
        className="px-8 py-3 bg-[#eab308] text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.05] active:scale-[0.98] transition-all flex items-center gap-2 shadow-xl shadow-[#eab308]/20"
      >
        <RefreshCw size={16} /> Re-classify Content
      </Link>
    </form>
  );
}

function Film(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M17 3v18" />
      <path d="M3 7h4" />
      <path d="M3 12h18" />
      <path d="M3 17h4" />
      <path d="M17 17h4" />
      <path d="M17 7h4" />
    </svg>
  )
}
