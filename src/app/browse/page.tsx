import { supabase } from '@/lib/supabase';
import { fetchTMDBMetadata } from '@/lib/tmdb';
import MovieCard from '@/components/MovieCard';
import BrowseFilters from '@/components/BrowseFilters';
import { Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const unresolvedParams = await searchParams;
  const q = typeof unresolvedParams?.q === 'string' ? unresolvedParams.q : '';
  const type = typeof unresolvedParams?.type === 'string' ? unresolvedParams.type : 'all';
  const sort = typeof unresolvedParams?.sort === 'string' ? unresolvedParams.sort : 'terbaru';

  // Fetch from Supabase DB
  let query = supabase.from('contents').select('*').eq('status', 'approved');
  
  if (type !== 'all') {
    if (type === 'tv') {
      query = query.in('type', ['tv', 'drakor']);
    } else if (type === 'anime') {
      query = query.eq('type', 'anime');
    } else {
      query = query.eq('type', type);
    }
  }

  // Use ilike for server-side search when possible
  if (q) {
    query = query.ilike('title', `%${q}%`);
  }
  
  const { data: dbContents, error } = await query.order('created_at', { ascending: false });
  
  let validResults: any[] = [];
  
  if (!error && dbContents) {
    // Fetch TMDB Metadata in parallel
    const contentWithMetadata = await Promise.all(
      dbContents.map(async (item) => {
        try {
          const metadata = await fetchTMDBMetadata(item.tmdb_id, item.type === 'movie' ? 'movie' : 'tv');
          return { ...item, metadata };
        } catch (e) {
          return { ...item, metadata: null };
        }
      })
    );
    
    validResults = contentWithMetadata.filter(c => c.metadata);

    // Apply sorting
    if (sort === 'rating') {
      validResults.sort((a, b) => (b.metadata?.vote_average || 0) - (a.metadata?.vote_average || 0));
    } else if (sort === 'az') {
      validResults.sort((a, b) => a.title.localeCompare(b.title));
    }
    // 'terbaru' is default from DB order
  }

  return (
    <div className="min-h-screen pt-28 px-4 md:px-12 lg:px-20 animate-fade-in relative z-10 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        
        {/* Title */}
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
            {q ? `Hasil pencarian: "${q}"` : type !== 'all' ? `Koleksi ${type === 'movie' ? 'Film' : type === 'tv' ? 'Series' : type === 'anime' ? 'Anime' : 'Semua'}` : 'Jelajahi Koleksi'}
          </h1>
          <p className="text-gray-400 font-semibold">{validResults.length} judul ditemukan</p>
        </div>
      </div>

      {/* Client-side Filters + Search Bar */}
      <BrowseFilters currentQ={q} currentType={type} currentSort={sort} />

      {/* Grid Results */}
      {validResults.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 mt-8">
          {validResults.map((item) => (
            <MovieCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-20 text-center glass rounded-2xl mt-8">
           <Search size={48} className="text-gray-500 mb-4" />
           <h3 className="text-2xl font-bold text-white mb-2">Tidak ditemukan</h3>
           <p className="text-gray-400 max-w-md">Tidak ada film yang cocok dengan pencarian atau filter Anda. Coba kata kunci lain atau hapus filter.</p>
        </div>
      )}
    </div>
  );
}
