import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ReportsAdminPage() {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*, contents(title, tmdb_id, type)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass rounded-3xl border border-red-500/20">
        <AlertTriangle className="text-red-500 mb-4" size={48} />
        <div className="text-red-500 font-black text-xl">Gagal memuat aduan laporan</div>
        <p className="text-zinc-500 mt-2">Terjadi kesalahan pada server saat mengambil data laporan.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <AlertTriangle className="text-yellow-500" size={32} />
          Laporan Konten
        </h1>
        <p className="text-zinc-500 font-medium mt-1">Pusat aduan pengunjung mengenai link video rusak, subtitel hilang, atau salah film.</p>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">Judul Film</th>
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">Jenis Kendala</th>
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">Detail Laporan</th>
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">Tanggal</th>
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reports && reports.length > 0 ? (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-white-[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <Link 
                          href={`/watch/${report.content_id}`} 
                          target="_blank" 
                          className="font-bold text-white hover:text-yellow-500 transition-colors truncate max-w-[200px] block underline decoration-white/10 hover:decoration-yellow-500/50"
                          title={report.contents?.title}
                        >
                          {report.contents?.title || 'Film Dihapus'}
                        </Link>
                        <div className="text-[10px] font-mono text-zinc-600 mt-1 uppercase tracking-tighter">TMDB: {report.contents?.tmdb_id || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                        {report.issue_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-zinc-400 max-w-[250px] truncate italic" title={report.details}>
                        "{report.details}"
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-zinc-600">
                      {new Date(report.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      {report.status === 'pending' ? (
                        <div className="flex items-center gap-1.5 text-yellow-500 text-[10px] font-black uppercase tracking-widest bg-yellow-500/5 px-2.5 py-1.5 rounded-lg border border-yellow-500/10 shadow-sm">
                          <Clock size={14} strokeWidth={3} /> Pending
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 px-2.5 py-1.5 rounded-lg border border-emerald-500/10 shadow-sm">
                          <CheckCircle size={14} strokeWidth={3} /> Resolved
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <CheckCircle size={48} className="text-emerald-500/20" />
                      <div className="text-zinc-600 font-bold italic">Hore! Tidak ada laporan link rusak saat ini.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
