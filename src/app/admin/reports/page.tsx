import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, CheckCircle, Clock, Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReportsAdminPage() {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*, contents(title, tmdb_id, type)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return <div className="text-red-500 font-bold p-8">Gagal memuat aduan laporan.</div>;
  }

  // A generic Server Action for UI purposes, though in production we should extract server actions to separate file
  // Here we just display them, interactions should be handled properly later.
  return (
    <div className="p-8">
      <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
        <AlertTriangle className="text-yellow-500" />
        Laporan Konten
      </h1>
      <p className="text-gray-400 font-semibold mb-8">Pusat aduan pengunjung mengenai link video rusak, subtitel hilang, atau salah film.</p>

      <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-black/50 border-b border-white/5 text-gray-400 text-sm uppercase tracking-wider">
            <tr>
              <th className="p-4 font-bold">Judul Film</th>
              <th className="p-4 font-bold">Jenis Kendala</th>
              <th className="p-4 font-bold">Detail Laporan</th>
              <th className="p-4 font-bold">Tanggal</th>
              <th className="p-4 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {reports && reports.length > 0 ? (
              reports.map((report) => (
                <tr key={report.id} className="hover:bg-white-[0.02] transition">
                  <td className="p-4 font-bold text-white max-w-[200px] truncate" title={report.contents?.title}>
                    <a href={`/watch/${report.content_id}`} target="_blank" className="hover:text-primary transition underline decoration-white/20">
                      {report.contents?.title || 'Film Dihapus'}
                    </a>
                  </td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-gray-300">
                      {report.issue_type}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 max-w-[250px] truncate" title={report.details}>
                    {report.details}
                  </td>
                  <td className="p-4 text-gray-500 font-semibold">
                    {new Date(report.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="p-4 flex gap-2 items-center">
                    {report.status === 'pending' ? (
                      <span className="flex items-center gap-1 text-yellow-500 font-bold bg-yellow-500/10 px-2 py-1 rounded">
                        <Clock size={14} /> Pending
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded">
                        <CheckCircle size={14} /> Resolusi
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-12 text-center text-gray-500 font-bold">Hore! Tidak ada laporan link rusak saat ini.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
