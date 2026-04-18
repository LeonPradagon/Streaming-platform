import { createClient } from '@/lib/supabase/server';
import { approveContent, rejectContent, approveAllContent } from './actions';
import { Check, X, AlertCircle, Film, Tv } from 'lucide-react';
import SweetApprove from '@/components/Admin/SweetApprove';

export default async function ApprovePage() {
  const supabase = await createClient();

  // Fetch pending content
  const { data: pendingContent } = await supabase
    .from('contents')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Persetujuan Konten</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {pendingContent && pendingContent.length > 0 && (
              <SweetApprove approveAllAction={approveAllContent} />
            )}
            <span style={{ 
            padding: '0.4rem 0.8rem', 
            backgroundColor: 'rgba(234, 179, 8, 0.1)', 
            color: '#eab308', 
            borderRadius: '2rem', 
            fontSize: '0.8rem', 
            fontWeight: 700 
          }}>
            {pendingContent?.length || 0} Menunggu Review
          </span>
        </div>
      </div>

      {!pendingContent || pendingContent.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '5rem', borderRadius: '1.5rem' }}>
          <div style={{ color: '#475569', marginBottom: '1rem' }}><Check size={48} style={{ margin: '0 auto' }} /></div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>Semua Beres!</h3>
          <p style={{ color: '#64748b' }}>Tidak ada konten yang menunggu persetujuan saat ini.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {pendingContent.map((item: any) => (
            <div key={item.id} className="glass" style={{ 
              padding: '1.5rem', 
              borderRadius: '1.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '2rem',
              transition: 'transform 0.2s ease',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {/* Poster Placeholder */}
              <div style={{ 
                width: '80px', 
                height: '110px', 
                backgroundColor: 'rgba(255,255,255,0.03)', 
                borderRadius: '0.75rem', 
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <img 
                  src={item.poster_url || `https://placehold.co/400x600/060d17/eab308?text=${item.title}`} 
                  alt={item.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{item.title}</h4>
                  <span style={{ 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px', 
                    fontSize: '0.65rem', 
                    fontWeight: 900, 
                    backgroundColor: item.type === 'movie' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                    color: item.type === 'movie' ? '#eab308' : '#38bdf8',
                    textTransform: 'uppercase'
                  }}>
                    {item.type}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Film size={14} /> ID: {item.tmdb_id}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><AlertCircle size={14} /> Source: Scraper</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <form action={rejectContent.bind(null, item.id, item.title)}>
                  <button 
                    type="submit" 
                    style={{ 
                      padding: '0.75rem 1.25rem', 
                      borderRadius: '0.75rem', 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                      color: '#ef4444', 
                      border: '1px solid rgba(239, 68, 68, 0.1)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                    className="hover:bg-red-500/20"
                  >
                    <X size={18} /> Reject
                  </button>
                </form>
                
                <form action={approveContent.bind(null, item.id, item.title)}>
                  <button 
                    type="submit" 
                    style={{ 
                      padding: '0.75rem 1.5rem', 
                      borderRadius: '0.75rem', 
                      backgroundColor: '#10b981', 
                      color: '#060d17', 
                      border: 'none',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px -2px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <Check size={18} /> Approve
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
