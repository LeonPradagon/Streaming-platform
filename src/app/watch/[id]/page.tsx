import { supabase } from '@/lib/supabase';
import { fetchTMDBMetadata, getTMDBImageUrl } from '@/lib/tmdb';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function WatchPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // 1. Fetch content info
  const { data: content, error } = await supabase
    .from('contents')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !content) return <div>Content not found</div>;

  // 2. Fetch embed links
  const { data: links } = await supabase
    .from('embed_links')
    .select('*')
    .eq('content_id', id);

  // 3. Fetch TMDB metadata
  const metadata = await fetchTMDBMetadata(content.tmdb_id, content.type === 'anime' ? 'tv' : 'tv');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617' }}>
      {/* Player Header */}
      <nav style={{ padding: '1.5rem 5%', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #1e293b' }}>
        <Link href="/" style={{ color: '#94a3b8' }}>← Kembali</Link>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{content.title}</h1>
      </nav>

      <div style={{ padding: '2rem 5%', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
        {/* Main Player */}
        <section>
          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
            {links && links.length > 0 ? (
              <iframe 
                src={links[0].url} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
              ></iframe>
            ) : (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Embed link tidak tersedia.
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>{content.title}</h2>
                  <div style={{ display: 'flex', gap: '1rem', color: '#94a3b8', marginBottom: '1rem' }}>
                    <span>{metadata?.first_air_date?.split('-')[0]}</span>
                    <span>{metadata?.vote_average.toFixed(1)} Rating</span>
                    <span style={{ color: '#38bdf8' }}>{content.type.toUpperCase()}</span>
                  </div>
                </div>
             </div>
             <p style={{ color: '#cbd5e1', lineHeight: 1.6, maxWidth: '800px' }}>{metadata?.overview}</p>
          </div>
        </section>

        {/* Sidebar Info */}
        <aside>
          <div className="glass" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Pilih Server</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {links?.map((link, idx) => (
                <button 
                  key={link.id} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #334155', background: idx === 0 ? '#1e293b' : 'transparent', color: '#f8fafc', textAlign: 'left', cursor: 'pointer' }}
                >
                  Server {idx + 1} - {link.provider}
                </button>
              ))}
            </div>
            
            <div style={{ marginTop: '2rem' }}>
               <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Genre</h3>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                 {metadata?.genres.map(g => (
                   <span key={g.id} style={{ fontSize: '0.8rem', backgroundColor: '#1e293b', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>{g.name}</span>
                 ))}
               </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
