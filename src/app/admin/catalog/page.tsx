import { createClient } from '@/lib/supabase/server';
import { 
  Film, 
  Trash2, 
  CheckCircle, 
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { deleteContent, updateContentStatus } from './actions';
import { approveAllContent } from '../approve/actions';
import SweetDelete from '@/components/Admin/SweetDelete';
import SweetApprove from '@/components/Admin/SweetApprove';
import SweetEdit from './SweetEdit';
import { NETWORK_CONFIGS } from '@/lib/tmdb';

import CatalogFilters from './CatalogFilters';

export default async function ContentCatalog({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string; platform?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const query = searchParams.q || '';
  const typeFilter = searchParams.type || '';
  const statusFilter = searchParams.status || '';
  const page = parseInt(searchParams.page || '1');
  const pageSize = 20;

  let dbQuery = supabase
    .from('contents')
    .select('id, title, tmdb_id, type, status, platform, created_at, cast_data', { count: 'exact' });

  if (query) {
    dbQuery = dbQuery.ilike('title', `%${query}%`);
  }
  if (typeFilter) {
    dbQuery = dbQuery.eq('type', typeFilter);
  }
  if (statusFilter) {
    dbQuery = dbQuery.eq('status', statusFilter);
  }
  if (searchParams.platform) {
    dbQuery = dbQuery.eq('platform', searchParams.platform);
  }

  const { data: contents, count } = await dbQuery
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Katalog Konten</h2>
          <p className="text-zinc-500 font-medium">Kelola semua film dan serial yang ada di database.</p>
        </div>
        <div className="flex gap-4 items-center bg-white/5 p-2 rounded-2xl border border-white/5 shadow-xl">
          <SweetApprove approveAllAction={approveAllContent} />
          <span className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-sm font-black shadow-lg shadow-yellow-500/20">
            Total: {count || 0}
          </span>
        </div>
      </div>

      <CatalogFilters query={query} type={typeFilter} status={statusFilter} />

      {/* Content Table */}
      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">Konten</th>
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">Tipe</th>
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">Platform</th>
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">TMDb ID</th>
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest">Ditambahkan</th>
                <th className="p-6 text-zinc-500 text-xs font-black uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contents?.map((item) => (
                <tr key={item.id} className="hover:bg-white-[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-14 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/5 group-hover:border-yellow-500/30 transition-colors">
                        <Film size={20} className="text-yellow-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{item.title}</div>
                        <div className="text-[10px] font-mono text-zinc-600 mt-0.5">ID: {item.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-sky-500/10 text-sky-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-sky-400/20">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.status === 'approved' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-yellow-500'}`} />
                      <span className="text-sm font-bold text-zinc-300">{item.status === 'approved' ? 'Active' : 'Pending'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.platform && item.platform !== 'other' ? (
                      <span 
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border"
                        style={{ 
                          backgroundColor: `${NETWORK_CONFIGS.find(n => n.slug === item.platform)?.color}15`,
                          color: NETWORK_CONFIGS.find(n => n.slug === item.platform)?.color,
                          borderColor: `${NETWORK_CONFIGS.find(n => n.slug === item.platform)?.color}30`
                        }}
                      >
                        {item.platform}
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest italic">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                    <span className="bg-white/5 px-2 py-1 rounded border border-white/5">{item.tmdb_id}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-zinc-600">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      {item.status === 'pending' ? (
                        <form action={async () => {
                          'use server';
                          await updateContentStatus(item.id, 'approved');
                        }}>
                          <button title="Approve" className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20">
                            <CheckCircle size={18} />
                          </button>
                        </form>
                      ) : (
                        <form action={async () => {
                          'use server';
                          await updateContentStatus(item.id, 'pending');
                        }}>
                          <button title="Deactivate" className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-white transition-all border border-yellow-500/20">
                            <XCircle size={18} />
                          </button>
                        </form>
                      )}
                      <SweetEdit content={item} />
                      <SweetDelete 
                        contentId={item.id} 
                        contentTitle={item.title} 
                        deleteAction={deleteContent} 
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {(!contents || contents.length === 0) && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-600 font-bold italic">
                    Film tidak ditemukan. Silakan gunakan filter atau pencarian lain.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-4">
          <a 
            href={`?q=${query}&type=${typeFilter}&status=${statusFilter}&page=${Math.max(1, page - 1)}`}
            className={`p-3 rounded-2xl bg-white/5 border border-white/5 transition-all flex items-center justify-center ${
              page === 1 ? 'opacity-30 pointer-events-none' : 'hover:bg-white/10 text-white'
            }`}
          >
            <ChevronLeft size={20} />
          </a>
          <div className="flex items-center gap-2 font-black text-sm">
            <span className="text-yellow-500">{page}</span>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-500">{totalPages}</span>
          </div>
          <a 
            href={`?q=${query}&type=${typeFilter}&status=${statusFilter}&page=${Math.min(totalPages, page + 1)}`}
            className={`p-3 rounded-2xl bg-white/5 border border-white/5 transition-all flex items-center justify-center ${
              page === totalPages ? 'opacity-30 pointer-events-none' : 'hover:bg-white/10 text-white'
            }`}
          >
            <ChevronRight size={20} />
          </a>
        </div>
      )}
    </div>
  );
}
