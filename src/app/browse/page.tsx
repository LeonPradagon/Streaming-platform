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
  const genre = typeof unresolvedParams?.genre === 'string' ? unresolvedParams.genre : '';
  const sort = typeof unresolvedParams?.sort === 'string' ? unresolvedParams.sort : 'populer';
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

  if (genre) {
    const capitalizedGenre = genre.charAt(0).toUpperCase() + genre.slice(1);
    query = query.contains('genre_names', [capitalizedGenre]);
  }

  // Improved Smart Search
  if (q) {
    const flexQ = q.trim().replace(/\s+/g, '%');
    query = query.or(`title.ilike.%${flexQ}%,overview.ilike.%${flexQ}%`);
  }
  
  // Sort Logic - Default to Popularity 2025
  if (sort === 'rating') {
    query = query.order('vote_average', { ascending: false, nullsFirst: false });
  } else if (sort === 'az') {
    query = query.order('title', { ascending: true });
  } else if (sort === 'terbaru') {
    query = query.order('created_at', { ascending: false });
  } else {
    // DEFAULT: POPULER
    query = query.order('popularity', { ascending: false });
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
    <div className="min-h-screen bg-[#0a0a0a] pt-32 px-4 md:px-12 lg:px-20 relative overflow-hidden pb-24">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/10 blur-[120px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] -z-10" />

      <div className="max-w-[1700px] mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none">
              {q ? `Hasil: "${q}"` : genre ? `Genre: ${genre}` : type !== 'all' ? `Koleksi ${type === 'movie' ? 'Film' : type === 'tv' ? 'Series' : type === 'anime' ? 'Anime' : 'Premium'}` : 'Jelajahi Dunia'}
            </h1>
            <p className="text-gray-500 font-bold tracking-[0.2em] text-[10px] uppercase">
              Ditemukan <span className="text-red-600">{count || 0}</span> Judul Berkualitas
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="h-10 w-[2px] bg-white/10 hidden md:block" />
             <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest hidden md:block text-right">
               Filter &<br />Sorting
             </div>
          </div>
        </header>

        {/* Filters Section */}
        <div className="mb-12">
          <BrowseFilters currentQ={q} currentType={type} currentSort={sort} currentView={view} currentGenre={genre} />
        </div>

        {/* Results */}
        {validResults.length > 0 ? (
          <>
            {view === 'list' ? (
              <div className="space-y-4">
                {validResults.map((item) => (
                  <Link 
                    key={item.id} 
                    href={`/watch/${item.id}?type=${item.type === 'movie' ? 'movie' : 'tv'}`} 
                    className="flex gap-6 p-4 glass-card group"
                  >
                     <div className="relative w-24 md:w-40 aspect-[2/3] rounded-xl overflow-hidden flex-shrink-0">
                        <Image 
                          src={getTMDBImageUrl(item.poster_path, 'w342')} 
                          alt={item.title}
                          fill 
                          className="object-cover group-hover:scale-110 transition-transform duration-700" 
                        />
                     </div>
                     <div className="flex flex-col justify-center flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="bg-white/10 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-white/5">
                            {item.type}
                          </span>
                          <span className="text-gray-600 font-black text-xs">/</span>
                          <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">
                            {item.release_date?.split('-')[0]}
                          </span>
                        </div>
                        <h3 className="text-white text-xl md:text-3xl font-black mb-3 group-hover:text-red-600 transition-colors tracking-tight uppercase line-clamp-1">
                          {item.title}
                        </h3>
                        <p className="text-gray-500 text-sm line-clamp-2 md:line-clamp-3 max-w-3xl leading-relaxed mb-4">
                          {item.overview}
                        </p>
                        {item.vote_average > 0 && (
                          <div className="flex items-center gap-1.5 text-yellow-500 font-black text-xs tracking-widest">
                             <Star size={14} fill="currentColor" />
                             <span>{item.vote_average.toFixed(1)} TMDB RATING</span>
                          </div>
                        )}
                     </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
                {validResults.map((item) => (
                  <MovieCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {Math.ceil((count || 0) / PAGE_SIZE) > 1 && (
              <div className="flex justify-center items-center gap-6 mt-20">
                 <Link 
                   href={`/browse?${new URLSearchParams({ ...(unresolvedParams as any), page: Math.max(1, page - 1).toString() }).toString()}`}
                   className={`p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${page <= 1 ? 'bg-white/2 text-gray-700 border-white/5 pointer-events-none' : 'bg-white/5 text-white border-white/10 hover:bg-white/10 active:scale-95'}`}
                 >
                   PREV
                 </Link>
                 <div className="flex flex-col items-center">
                    <span className="text-white font-black text-lg leading-none">{page}</span>
                    <span className="text-gray-600 text-[9px] font-black uppercase tracking-tighter mt-1">OF {Math.ceil((count || 0) / PAGE_SIZE)}</span>
                 </div>
                 <Link 
                   href={`/browse?${new URLSearchParams({ ...(unresolvedParams as any), page: (page + 1).toString() }).toString()}`}
                   className={`p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${page >= Math.ceil((count || 0) / PAGE_SIZE) ? 'bg-white/2 text-gray-700 border-white/5 pointer-events-none' : 'bg-red-600 text-white border-red-500 hover:bg-red-700 active:scale-95 shadow-lg shadow-red-600/20'}`}
                 >
                   NEXT
                 </Link>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center glass-card rounded-[3rem]">
             <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6 text-gray-500">
               <Search size={40} />
             </div>
             <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Tidak Ada Hasil</h3>
             <p className="text-gray-500 max-w-sm font-medium">Coba ganti kata kunci atau filter yang Anda gunakan untuk menemukan konten lainnya.</p>
          </div>
        )}
      </div>
    </div>
  );
}
