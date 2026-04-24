import { supabase } from '@/lib/supabase';
import { fetchTMDBMetadata, getTMDBImageUrl } from '@/lib/tmdb';
import MovieCard from '@/components/MovieCard';
import BrowseFilters from '@/components/BrowseFilters';
import { Search, Star } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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
  const view = typeof unresolvedParams?.view === 'string' ? unresolvedParams.view : 'grid';
  const page = typeof unresolvedParams?.page === 'string' ? parseInt(unresolvedParams.page) : 1;
  const PAGE_SIZE = 30;

  // Fetch from Supabase DB
  let query = supabase.from('contents').select('*', { count: 'exact' }).eq('status', 'approved');
  
  if (type !== 'all') {
    if (type === 'tv') {
      query = query.in('type', ['tv', 'drakor', 'drachin', 'drathai', 'drajep', 'variety', 'donghua']);
    } else if (type === 'anime') {
      query = query.eq('type', 'anime');
    } else {
      query = query.eq('type', type);
    }
  }

  // Use ilike for server-side search when possible
  if (q) {
    const sanitizedQuery = q.replace(/[%_\\]/g, '\\$&');
    // Search in title OR cast_data
    query = query.or(`title.ilike.%${sanitizedQuery}%,cast_data.cs.[{"name":"${q}"}]`);
    // Note: JSONB contain '@>' (cs) is more efficient than ilike in JSON but requires exact match for that specific path.
    // For a better UX, we'll keep it simple for now or use a more complex query if needed.
    // Actually, ilike on title is most common. To search inside JSONB array names with partial match is harder with simple OR.
    // Let's stick to title search for now as cast_data search might be slow without proper indexing.
  }
  
  // Sort at DB level!
  if (sort === 'rating') {
    query = query.order('vote_average', { ascending: false, nullsFirst: false });
  } else if (sort === 'az') {
    query = query.order('title', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  query = query.range(from, to);
  
  const { data: dbContents, count, error } = await query;
  
  let validResults: any[] = [];
  
  if (!error && dbContents) {
    validResults = dbContents.map((item) => ({
      ...item,
      metadata: {
        poster_path: item.poster_path,
        vote_average: typeof item.vote_average === 'number' ? item.vote_average : parseFloat(item.vote_average || '0'),
        release_date: item.release_date,
        first_air_date: item.release_date, // For TV backwards compatibility
      }
    }));
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
      <BrowseFilters currentQ={q} currentType={type} currentSort={sort} currentView={view} />

      {/* Grid/List Results */}
      {validResults.length > 0 ? (
        <>
          {view === 'list' ? (
            <div className="flex flex-col gap-4 mt-8">
              {validResults.map((item) => (
                <Link 
                  key={item.id} 
                  href={`/watch/${item.id}?type=${item.type === 'movie' ? 'movie' : 'tv'}`} 
                  className="flex gap-4 p-4 glass rounded-2xl hover:bg-white/10 transition-all group border border-white/5 hover:border-white/20"
                >
                   <div className="relative w-20 md:w-32 aspect-[2/3] rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                      <Image 
                        src={getTMDBImageUrl(item.poster_path, 'w185')} 
                        alt={item.title}
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                   </div>
                   <div className="flex flex-col justify-center py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-primary/20 text-primary text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">{item.type}</span>
                        <span className="text-gray-500 text-xs">•</span>
                        <span className="text-gray-400 text-xs font-bold">{item.release_date?.split('-')[0]}</span>
                      </div>
                      <h3 className="text-white text-lg md:text-xl font-black mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-2 md:line-clamp-3 max-w-2xl leading-relaxed mb-3">{item.overview}</p>
                      {item.vote_average > 0 && (
                        <div className="flex items-center gap-1.5 text-yellow-500 font-bold text-sm">
                           <Star size={14} fill="currentColor" />
                           <span>{item.vote_average.toFixed(1)}</span>
                        </div>
                      )}
                   </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 mt-8">
              {validResults.map((item) => (
                <MovieCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {Math.ceil((count || 0) / PAGE_SIZE) > 1 && (
            <div className="flex justify-center items-center gap-4 mt-12">
               <Link 
                 href={`/browse?${new URLSearchParams({ ...(unresolvedParams as any), page: Math.max(1, page - 1).toString() }).toString()}`}
                 className={`px-4 py-2 rounded-lg font-bold transition ${page <= 1 ? 'bg-white/5 text-gray-500 pointer-events-none' : 'bg-white/10 text-white hover:bg-white/20'}`}
               >
                 Sebelumnya
               </Link>
               <span className="text-gray-400 font-semibold">Halaman {page} dari {Math.ceil((count || 0) / PAGE_SIZE)}</span>
               <Link 
                 href={`/browse?${new URLSearchParams({ ...(unresolvedParams as any), page: (page + 1).toString() }).toString()}`}
                 className={`px-4 py-2 rounded-lg font-bold transition ${page >= Math.ceil((count || 0) / PAGE_SIZE) ? 'bg-white/5 text-gray-500 pointer-events-none' : 'bg-primary text-white hover:bg-red-700'}`}
               >
                 Selanjutnya
               </Link>
            </div>
          )}
        </>
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
