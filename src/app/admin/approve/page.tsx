import { createClient } from '@/lib/supabase/server';
import { approveContent, rejectContent, approveAllContent } from './actions';
import { Check, X, AlertCircle, Film } from 'lucide-react';
import SweetApprove from '@/components/Admin/SweetApprove';
import Image from 'next/image';
import { getTMDBImageUrl } from '@/lib/tmdb';

export default async function ApprovePage() {
  const supabase = await createClient();

  // Fetch pending content — select only needed columns
  const { data: pendingContent } = await supabase
    .from('contents')
    .select('id, title, tmdb_id, type, poster_path, status')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-black text-white tracking-tight">Persetujuan Konten</h2>
        <div className="flex gap-4 items-center">
          {pendingContent && pendingContent.length > 0 && (
            <SweetApprove approveAllAction={approveAllContent} />
          )}
          <span className="bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border border-yellow-500/20 shadow-lg shadow-yellow-500/5">
            {pendingContent?.length || 0} Menunggu Review
          </span>
        </div>
      </div>

      {!pendingContent || pendingContent.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center p-20 rounded-3xl text-center border border-white/5">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
            <Check size={40} className="text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-white mb-2">Semua Beres!</h3>
          <p className="text-zinc-500 font-medium">Tidak ada konten yang menunggu persetujuan saat ini.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {pendingContent.map((item: any) => (
            <div key={item.id} className="glass group p-6 rounded-3xl flex flex-col md:flex-row items-center gap-8 border border-white/5 hover:border-white/10 transition-all">
              {/* Poster */}
              <div className="relative w-24 h-36 bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-white/5 shadow-2xl group-hover:scale-[1.02] transition-transform duration-500">
                <Image 
                  src={getTMDBImageUrl(item.poster_path, 'w185')} 
                  alt={item.title} 
                  fill
                  className="object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left min-w-0">
                <div className="flex flex-col md:flex-row items-center gap-3 mb-3">
                  <h4 className="text-xl font-black text-white truncate max-w-md">{item.title}</h4>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                    item.type === 'movie' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-400/20'
                  }`}>
                    {item.type}
                  </span>
                </div>
                <div className="flex flex-wrap justify-center md:justify-start gap-6 text-xs font-bold text-zinc-500">
                  <span className="flex items-center gap-2"><Film size={14} className="text-zinc-600" /> ID: {item.tmdb_id}</span>
                  <span className="flex items-center gap-2"><AlertCircle size={14} className="text-zinc-600" /> Source: Scraper</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 w-full md:w-auto">
                <form action={rejectContent.bind(null, item.id, item.title)} className="flex-1 md:flex-none">
                  <button 
                    type="submit" 
                    className="w-full px-6 py-4 rounded-2xl bg-white/5 text-red-500 border border-white/5 font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3"
                  >
                    <X size={18} /> Reject
                  </button>
                </form>
                
                <form action={approveContent.bind(null, item.id, item.title)} className="flex-1 md:flex-none">
                  <button 
                    type="submit" 
                    className="w-full px-8 py-4 rounded-2xl bg-emerald-500 text-black font-black text-xs uppercase tracking-widest hover:scale-[1.05] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20"
                  >
                    <Check size={18} strokeWidth={3} /> Approve
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
