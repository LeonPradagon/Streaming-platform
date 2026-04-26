import { supabase } from "@/lib/supabase";
import { Skeleton, RowSkeleton, HeroSkeleton } from "@/components/Skeleton";
import { Suspense } from "react";
import {
  fetchTMDBMetadata,
  classifyPlatform,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  Platform,
} from "@/lib/tmdb";
import HeroCarousel from "@/components/HeroCarousel";
import ContentRow from "@/components/ContentRow";
import PersonalizedRows from "@/components/PersonalizedRows";
import { groupContent } from "@/lib/content-grouping";
import {
  Flame,
  Sparkles,
  Tv,
  MonitorPlay,
  Clapperboard,
  Globe,
  Film,
  Star,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  // 1. Fetch content in parallel for performance
  const [popularRes, latestRes, drakorRes, animeRes] = await Promise.all([
    supabase
      .from("contents")
      .select("id, tmdb_id, title, type, overview, poster_path, backdrop_path, vote_average, popularity, release_date, platform, genre_names, cast_data, quality, status, tv_status")
      .eq("status", "approved")
      .order("popularity", { ascending: false })
      .limit(100),
    supabase
      .from("contents")
      .select("id, tmdb_id, title, type, overview, poster_path, backdrop_path, vote_average, popularity, release_date, platform, genre_names, cast_data, quality, status, tv_status")
      .eq("status", "approved")
      .order("release_date", { ascending: false })
      .limit(60),
    supabase
      .from("contents")
      .select("id, tmdb_id, title, type, overview, poster_path, backdrop_path, vote_average, popularity, release_date, platform, genre_names, cast_data, quality, status, tv_status")
      .eq("status", "approved")
      .eq("type", "drakor")
      .order("popularity", { ascending: false })
      .limit(40),
    supabase
      .from("contents")
      .select("id, tmdb_id, title, type, overview, poster_path, backdrop_path, vote_average, popularity, release_date, platform, genre_names, cast_data, quality, status, tv_status")
      .eq("status", "approved")
      .in("type", ["anime", "donghua"])
      .order("popularity", { ascending: false })
      .limit(40)
  ]);

  const allContent = [
    ...(popularRes.data || []),
    ...(latestRes.data || []),
    ...(drakorRes.data || []),
    ...(animeRes.data || [])
  ];

  // Remove duplicates
  const uniqueContent = Array.from(new Map(allContent.map(item => [item.id, item])).values());

  if (popularRes.error || !uniqueContent.length) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="glass p-8 rounded-2xl text-center max-w-md">
          <h2 className="text-xl font-bold mb-2 text-white">Gagal Memuat Konten</h2>
          <p className="text-gray-400">Silakan periksa koneksi database Anda.</p>
        </div>
      </div>
    );
  }

  // 2. Map and group content
  const validContent = uniqueContent.map((item: any) => ({
    ...item,
    metadata: {
      id: item.tmdb_id,
      title: item.title,
      overview: item.overview || "",
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average || 0,
      popularity: item.popularity || 0,
      release_date: item.release_date,
      genres: (item.genre_names || []).map((name: string) => ({ id: 0, name })),
      credits: { cast: item.cast_data || [] },
      status: item.tv_status,
    },
    platform: item.platform || "other",
  }));

  const { typeGroups, genreGroups } = groupContent(validContent);

  // 3. Logic for mixed trending
  const movies = typeGroups.movie.slice(0, 15);
  const drakors = typeGroups.drakor.slice(0, 15);
  const animes = [...(typeGroups.anime || []), ...(typeGroups.donghua || [])].slice(0, 15);
  
  const mixedTrending: any[] = [];
  const maxLen = Math.max(movies.length, drakors.length, animes.length);
  for (let i = 0; i < maxLen; i++) {
    if (movies[i]) mixedTrending.push(movies[i]);
    if (drakors[i]) mixedTrending.push(drakors[i]);
    if (animes[i]) mixedTrending.push(animes[i]);
  }

  return (
    <div className="pb-20 relative bg-[#0a0a0a]">
      {/* Hero Section */}
      <Suspense fallback={<HeroSkeleton />}>
        {validContent.length > 0 && (
          <HeroCarousel items={validContent.slice(0, 6)} />
        )}
      </Suspense>

      {/* Main Content Rows */}
      <div className="relative z-10 -mt-24 md:-mt-36 space-y-4 md:space-y-6">
        
        {/* Continue Watching (Client Component) */}
        <Suspense fallback={<div className="h-40 bg-white/5 mx-4 md:mx-12 rounded-2xl animate-pulse" />}>
          <PersonalizedRows />
        </Suspense>

        {/* Trending Interleaved */}
        <Suspense fallback={<RowSkeleton title="Trending Minggu Ini" />}>
          <ContentRow 
            title="Trending Minggu Ini" 
            items={mixedTrending.slice(0, 24)} 
            isTrendingRow={true}
            icon={<Flame size={20} className="text-red-500" />}
          />
        </Suspense>

        {/* Categories */}
        <Suspense fallback={<RowSkeleton title="Drama Korea Terbaru" />}>
          <ContentRow 
            title="Drama Korea Terbaru" 
            items={typeGroups.drakor.slice(0, 20)} 
            icon={<Tv size={20} className="text-blue-500" />}
          />
        </Suspense>

        <Suspense fallback={<RowSkeleton title="Populer Hari Ini" />}>
          <ContentRow 
            title="Populer Hari Ini" 
            items={typeGroups.movie.slice(0, 20)} 
            icon={<Film size={20} className="text-purple-500" />}
          />
        </Suspense>

        <Suspense fallback={<RowSkeleton title="Anime & Donghua" />}>
          <ContentRow 
            title="Anime & Donghua" 
            items={animes.slice(0, 20)} 
            icon={<Sparkles size={20} className="text-yellow-500" />}
          />
        </Suspense>

        {/* Genre Based Rows */}
        {Object.entries(genreGroups).slice(0, 5).map(([genre, items]) => (
          items.length >= 4 && (
            <Suspense key={genre} fallback={<RowSkeleton title={genre} />}>
              <ContentRow 
                title={genre} 
                items={items.slice(0, 20)} 
              />
            </Suspense>
          )
        ))}

      </div>
    </div>
  );
}
