import { supabase } from '@/lib/supabase';
import { fetchTMDBMetadata, getTMDBImageUrl } from '@/lib/tmdb';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  // 1. Fetch pending content from Supabase
  const { data: pendingItems, error } = await supabase
    .from('contents')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    return <div>Error loading pending items: {error.message}</div>;
  }

  return (
    <div style={{ padding: '2rem', backgroundColor: '#020617', minHeight: '100vh', color: '#f8fafc' }}>
      <header style={{ marginBottom: '2rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Admin Dashboard</h1>
        <p style={{ color: '#94a3b8' }}>Review and approve scraped movies/series.</p>
      </header>

      {pendingItems?.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
          No pending items to review.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {pendingItems?.map(async (item) => {
            const metadata = await fetchTMDBMetadata(item.tmdb_id, item.type === 'anime' ? 'tv' : 'tv'); // Simplified for demo
            
            return (
              <div key={item.id} style={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex' }}>
                  <img 
                    src={getTMDBImageUrl(metadata?.poster_path || '')} 
                    alt={item.title} 
                    style={{ width: '100px', height: '150px', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '1rem', flex: 1 }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{item.title}</h3>
                    <span style={{ fontSize: '0.8rem', backgroundColor: '#1e293b', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#38bdf8' }}>
                      {item.type.toUpperCase()}
                    </span>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <form action={async () => {
                        'use server';
                        await supabase.from('contents').update({ status: 'approved' }).eq('id', item.id);
                        redirect('/admin');
                      }}>
                        <button style={{ backgroundColor: '#22c55e', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}>
                          Approve
                        </button>
                      </form>
                      <form action={async () => {
                        'use server';
                        await supabase.from('contents').delete().eq('id', item.id);
                        redirect('/admin');
                      }}>
                        <button style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}>
                          Reject
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
