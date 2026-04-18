import { createClient } from '@/lib/supabase/server';
import { 
  Film, 
  Search, 
  Filter, 
  Trash2, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  MoreVertical,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { deleteContent, updateContentStatus } from './actions';
import { approveAllContent } from '../approve/actions';
import SweetDelete from '@/components/Admin/SweetDelete';
import SweetApprove from '@/components/Admin/SweetApprove';
import { revalidatePath } from 'next/cache';

import CatalogFilters from './CatalogFilters';

export default async function ContentCatalog({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const query = searchParams.q || '';
  const typeFilter = searchParams.type || '';
  const statusFilter = searchParams.status || '';
  const page = parseInt(searchParams.page || '1');
  const pageSize = 10;

  let dbQuery = supabase
    .from('contents')
    .select('*', { count: 'exact' });

  if (query) {
    dbQuery = dbQuery.ilike('title', `%${query}%`);
  }
  if (typeFilter) {
    dbQuery = dbQuery.eq('type', typeFilter);
  }
  if (statusFilter) {
    dbQuery = dbQuery.eq('status', statusFilter);
  }

  const { data: contents, count } = await dbQuery
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.5px' }}>Katalog Konten</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Kelola semua film dan serial yang ada di database.</p>
        </div>
        <div style={{ 
          display: 'flex', 
          gap: '1rem',
          padding: '0.5rem',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: '1rem',
          border: '1px solid rgba(255,255,255,0.05)',
          alignItems: 'center'
        }}>
          <SweetApprove approveAllAction={approveAllContent} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.5rem 1rem', borderRadius: '0.75rem', backgroundColor: '#eab308', color: '#0f172a' }}>
            Total: {count || 0}
          </span>
        </div>
      </div>

      <CatalogFilters query={query} type={typeFilter} status={statusFilter} />

      {/* Content Table */}
      <div className="glass" style={{ borderRadius: '1.5rem', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={{ padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Konten</th>
              <th style={{ padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Tipe</th>
              <th style={{ padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
              <th style={{ padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>TMDb ID</th>
              <th style={{ padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Ditambahkan</th>
              <th style={{ padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {contents?.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s' }}>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '56px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Film size={20} color="#eab308" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {item.id.slice(0, 8)}...</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <span style={{ 
                    padding: '0.4rem 0.8rem', 
                    borderRadius: '2rem', 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    backgroundColor: 'rgba(56, 189, 248, 0.1)', 
                    color: '#38bdf8',
                    textTransform: 'capitalize'
                  }}>
                    {item.type}
                  </span>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.status === 'approved' ? '#10b981' : '#eab308' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.status === 'approved' ? 'Active' : 'Pending'}</span>
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                  <code style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.4rem', borderRadius: '0.25rem' }}>{item.tmdb_id}</code>
                </td>
                <td style={{ padding: '1.25rem 1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                  {new Date(item.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    {item.status === 'pending' ? (
                      <form action={async () => {
                        'use server';
                        await updateContentStatus(item.id, 'approved');
                      }}>
                        <button title="Approve" style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', cursor: 'pointer' }}>
                          <CheckCircle size={18} />
                        </button>
                      </form>
                    ) : (
                      <form action={async () => {
                        'use server';
                        await updateContentStatus(item.id, 'pending');
                      }}>
                        <button title="Deactivate" style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308', cursor: 'pointer' }}>
                          <XCircle size={18} />
                        </button>
                      </form>
                    )}
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
                <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
                  Film tidak ditemukan. Silakan gunakan filter atau pencarian lain.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
          <a 
            href={`?q=${query}&type=${typeFilter}&status=${statusFilter}&page=${Math.max(1, page - 1)}`}
            style={{ 
              padding: '0.75rem', 
              borderRadius: '0.75rem', 
              backgroundColor: 'rgba(255,255,255,0.03)', 
              color: page === 1 ? '#475569' : 'white',
              pointerEvents: page === 1 ? 'none' : 'auto',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronLeft size={20} />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <span style={{ color: '#eab308' }}>{page}</span> / <span style={{ color: '#94a3b8' }}>{totalPages}</span>
          </div>
          <a 
            href={`?q=${query}&type=${typeFilter}&status=${statusFilter}&page=${Math.min(totalPages, page + 1)}`}
            style={{ 
              padding: '0.75rem', 
              borderRadius: '0.75rem', 
              backgroundColor: 'rgba(255,255,255,0.03)', 
              color: page === totalPages ? '#475569' : 'white',
              pointerEvents: page === totalPages ? 'none' : 'auto',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronRight size={20} />
          </a>
        </div>
      )}
    </div>
  );
}
