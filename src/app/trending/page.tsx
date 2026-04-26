import { supabase } from '@/lib/supabase';
import MovieCard from '@/components/MovieCard';
import { Flame } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TrendingPage() {
  // ⚡ PERFORMANCE: Parallel fetch categories for a mixed trending experience
  const [moviesRes, drakorRes, animeRes, settingsResult] = await Promise.all([
    supabase.from('contents').select('id, tmdb_id, title, type, poster_path, vote_average, popularity, release_date').eq('status', 'approved').eq('type', 'movie').order('popularity', { ascending: false }).limit(20),
    supabase.from('contents').select('id, tmdb_id, title, type, poster_path, vote_average, popularity, release_date').eq('status', 'approved').eq('type', 'drakor').order('popularity', { ascending: false }).limit(20),
    supabase.from('contents').select('id, tmdb_id, title, type, poster_path, vote_average, popularity, release_date').eq('status', 'approved').in('type', ['anime', 'donghua']).order('popularity', { ascending: false }).limit(20),
    supabase.from('settings').select('value').eq('key', 'site_config').single(),
  ]);

  const siteConfig = settingsResult.data?.value || { title: 'Netix' };
  
  // Interleave the results for variety
  const movies = moviesRes.data || [];
  const drakors = drakorRes.data || [];
  const animes = animeRes.data || [];
  
  const mixedResults: any[] = [];
  const maxLen = Math.max(movies.length, drakors.length, animes.length);
  
  for (let i = 0; i < maxLen; i++) {
    if (movies[i]) mixedResults.push(movies[i]);
    if (drakors[i]) mixedResults.push(drakors[i]);
    if (animes[i]) mixedResults.push(animes[i]);
  }

  const validResults = mixedResults.map((item) => ({
    ...item,
    metadata: {
      poster_path: item.poster_path,
      vote_average: typeof item.vote_average === 'number' ? item.vote_average : parseFloat(item.vote_average || '0'),
      release_date: item.release_date,
      first_air_date: item.release_date,
    }
  }));

  return (
    <div className="min-h-screen pt-28 px-4 md:px-12 lg:px-20 animate-fade-in relative z-10 pb-20">
      <div className="flex flex-col justify-between items-start gap-4 mb-10">
        <h1 className="text-3xl md:text-5xl font-black text-white mb-2 flex items-center gap-3">
          <Flame size={40} className="text-red-500" fill="currentColor" />
          Trending di {siteConfig.title}
        </h1>
        <p className="text-gray-400 font-semibold text-lg max-w-2xl">
          Sesuai dengan data tren TMDB global terbaru. Ini adalah film dan serial paling populer yang saat ini banyak ditonton di seluruh dunia dan tersedia di platform ini.
        </p>
      </div>

      {/* Grid Results */}
      {validResults.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8 mt-8">
          {validResults.map((item, index) => (
            <MovieCard key={item.id} item={item} rank={index + 1} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-20 text-center glass rounded-2xl mt-8">
           <Flame size={48} className="text-gray-500 mb-4" />
           <h3 className="text-2xl font-bold text-white mb-2">Belum Ada Data</h3>
           <p className="text-gray-400 max-w-md">Data trending belum disinkronkan dari TMDB. Admin perlu menjalankan Trending Discovery.</p>
        </div>
      )}
    </div>
  );
}
