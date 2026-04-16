import { supabase } from '@/lib/supabase';
import { fetchTMDBMetadata, getTMDBImageUrl } from '@/lib/tmdb';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Fetch approved content
  const { data: movies, error } = await supabase
    .from('contents')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  return (
    <main style={{ minHeight: '100vh', paddingBottom: '4rem' }}>
      {/* Hero Section */}
      <section style={{ height: '70vh', position: 'relative', display: 'flex', alignItems: 'center', padding: '0 5%' }}>
        <div style={{ zIndex: 2, maxWidth: '600px' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem' }}>
            Cinematic <span style={{ color: '#38bdf8' }}>Streaming</span> Experience
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: '2rem' }}>
            Nonton Anime dan Drakor terbaru dengan kualitas HD secara gratis. 
            Tanpa ribet, langsung klik dan tonton.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="#trending" className="btn-primary">Mulai Menonton</Link>
            <Link href="/admin" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid #1e293b', fontWeight: 'bold' }}>Dashboard Admin</Link>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '60%', height: '100%', background: 'linear-gradient(to left, var(--background), transparent)', zIndex: 1 }}></div>
      </section>

      {/* Movie Grid */}
      <section id="trending" style={{ padding: '2rem 5%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Terbaru di <span style={{ color: '#f43f5e' }}>Antigravity</span></h2>
          <div style={{ display: 'flex', gap: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
            <span>Anime</span>
            <span>Drakor</span>
          </div>
        </div>

        {!movies || movies.length === 0 ? (
          <div className="glass" style={{ padding: '4rem', textAlign: 'center', borderRadius: '1rem' }}>
            <p style={{ color: '#64748b' }}>Belum ada konten yang tersedia. Jalankan scraper untuk mengisi data!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '2rem' }}>
            {movies.map(async (movie) => {
               const metadata = await fetchTMDBMetadata(movie.tmdb_id, movie.type === 'anime' ? 'tv' : 'tv');
               return (
                 <Link href={`/watch/${movie.id}`} key={movie.id} className="movie-card">
                   <img 
                     src={getTMDBImageUrl(metadata?.poster_path || '', 'w500')} 
                     alt={movie.title}
                     style={{ width: '100%', height: 'auto', display: 'block' }}
                   />
                   <div className="overlay">
                     <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{movie.title}</h3>
                     <p style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{metadata?.vote_average.toFixed(1)} ★</p>
                   </div>
                 </Link>
               )
            })}
          </div>
        )}
      </section>
    </main>
  );
}
