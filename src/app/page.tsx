import { supabase } from "@/lib/supabase";
import { groupContent } from "@/lib/content-grouping";
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
  // 1. Fetch approved content — SELECT only needed columns, no JOINs
  // 1. Fetch content in parallel for better row accuracy
  const [popularRes, latestRes, drakorRes, animeRes] = await Promise.all([
    supabase
      .from("contents")
      .select("id, tmdb_id, title, type, overview, poster_path, backdrop_path, vote_average, popularity, release_date, platform, genre_names, cast_data, quality, status, tv_status")
      .eq("status", "approved")
      .order("popularity", { ascending: false })
      .limit(200),
    supabase
      .from("contents")
      .select("id, tmdb_id, title, type, overview, poster_path, backdrop_path, vote_average, popularity, release_date, platform, genre_names, cast_data, quality, status, tv_status")
      .eq("status", "approved")
      .order("release_date", { ascending: false })
      .limit(100),
    supabase
      .from("contents")
      .select("id, tmdb_id, title, type, overview, poster_path, backdrop_path, vote_average, popularity, release_date, platform, genre_names, cast_data, quality, status, tv_status")
      .eq("status", "approved")
      .eq("type", "drakor")
      .order("popularity", { ascending: false })
      .limit(50),
    supabase
      .from("contents")
      .select("id, tmdb_id, title, type, overview, poster_path, backdrop_path, vote_average, popularity, release_date, platform, genre_names, cast_data, quality, status, tv_status")
      .eq("status", "approved")
      .in("type", ["anime", "donghua"])
      .order("popularity", { ascending: false })
      .limit(50)
  ]);

  const allContent = [
    ...(popularRes.data || []),
    ...(latestRes.data || []),
    ...(drakorRes.data || []),
    ...(animeRes.data || [])
  ];

  // Remove duplicates by ID
  const uniqueContent = Array.from(new Map(allContent.map(item => [item.id, item])).values());

  if (popularRes.error || !uniqueContent) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="glass p-8 rounded-2xl text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">Gagal Memuat Konten</h2>
          <p className="text-gray-400">
            Silakan periksa koneksi database Anda.
          </p>
        </div>
      </div>
    );
  }

  // 2. Map stored metadata
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

  // 3. Grouping using utility
  const { typeGroups, genreGroups, regionGroups } = groupContent(validContent);

  // Layout logic
  const currTime = new Date().getTime();

  // Mixed Trending logic (Interleaving for variety)
  const movies = typeGroups.movie.sort((a, b) => (b.metadata?.popularity || 0) - (a.metadata?.popularity || 0)).slice(0, 15);
  const drakors = typeGroups.drakor.sort((a, b) => (b.metadata?.popularity || 0) - (a.metadata?.popularity || 0)).slice(0, 15);
  const animes = [...typeGroups.anime, ...typeGroups.donghua].sort((a, b) => (b.metadata?.popularity || 0) - (a.metadata?.popularity || 0)).slice(0, 15);
  
  const mixedTrending: any[] = [];
  const maxLen = Math.max(movies.length, drakors.length, animes.length);
  
  for (let i = 0; i < maxLen; i++) {
    if (movies[i]) mixedTrending.push(movies[i]);
    if (drakors[i]) mixedTrending.push(drakors[i]);
    if (animes[i]) mixedTrending.push(animes[i]);
  }
  
  const trending = mixedTrending.slice(0, 30);

  // Popular Movies
  const popularMovies = typeGroups.movie
    .sort((a, b) => (b.metadata?.popularity || 0) - (a.metadata?.popularity || 0))
    .slice(0, 24);

  // Popular TV Shows
  const popularTV = typeGroups.tv
    .sort((a, b) => (b.metadata?.popularity || 0) - (a.metadata?.popularity || 0))
    .slice(0, 24);

  // Top Rated (min 5 votes)
  const topRated = [...validContent]
    .filter((a) => (a.metadata?.vote_count || 0) > 5)
    .sort((a, b) => (b.metadata?.vote_average || 0) - (a.metadata?.vote_average || 0))
    .slice(0, 24);

  // Latest = newest release_date
  const latest = [...validContent]
    .filter(
      (a) =>
        a.metadata?.release_date &&
        new Date(a.metadata.release_date).getTime() <= currTime,
    )
    .sort(
      (a, b) =>
        new Date(b.metadata.release_date).getTime() -
        new Date(a.metadata.release_date).getTime(),
    );

  // Ongoing Series (TV shows that are recently updated or marked as ongoing)
  const ongoingSeries = typeGroups.tv.filter(item => item.status === 'Returning Series' || item.type === 'tv').slice(0, 20);

  // Hero uses a mix of newest high-quality content
  const heroItems = [...latest]
    .filter((a) => (a.metadata?.vote_average || 0) >= 5)
    .slice(0, 5);

  const SECTION_LABELS = {
    newReleases: "🔥 Rilis Terbaru",
    trending: "🌟 Sedang Tren",
    popularMovies: "🎬 Film Terpopuler",
    popularTV: "📺 Serial TV Terpopuler",
    topRated: "⭐ Rating Tertinggi",
    ongoing: "📡 Series Ongoing",
    drakor: "🇰🇷 Drama Korea (Drakor)",
    drachin: "🇨🇳 Drama China",
    anime: "🎌 Anime & Donghua",
    west: "🇺🇸 Film & Series Barat",
    action: "💥 Aksi & Petualangan",
    horror: "👻 Horor & Misteri",
    comedy: "😂 Komedi Terlucu",
  };

  return (
    <div className="pb-10 relative bg-[#0f0f0f]">
      {heroItems.length > 0 ? (
        <HeroCarousel items={heroItems} />
      ) : (
        <div className="h-[80vh] flex items-center justify-center">
          <div className="skeleton w-3/4 h-1/2 rounded-xl"></div>
        </div>
      )}

      {/* Main Content Sections */}
      <div className="relative z-30 flex flex-col gap-6 pb-20 mt-0 md:-mt-12">
        {/* Continue Watching & My List (Client Side) */}
        <PersonalizedRows />

        {/* Trending Now (With Ranking) */}
        {trending.length > 0 && (
          <ContentRow
            title={SECTION_LABELS.trending}
            items={trending.slice(0, 24)}
            isNewRow={false}
            isTrendingRow={true}
            icon={<Flame size={20} className="text-red-500" />}
            viewAllHref="/browse?sort=populer"
          />
        )}

        {/* Popular Movies */}
        {popularMovies.length > 0 && (
          <ContentRow
            title={SECTION_LABELS.popularMovies}
            items={popularMovies}
            icon={<Film size={20} className="text-blue-500" />}
            viewAllHref="/browse?type=movie&sort=populer"
          />
        )}

        {/* Popular TV Series */}
        {popularTV.length > 0 && (
          <ContentRow
            title={SECTION_LABELS.popularTV}
            items={popularTV}
            icon={<MonitorPlay size={20} className="text-indigo-500" />}
            viewAllHref="/browse?type=tv&sort=populer"
          />
        )}

        {/* New Releases */}
        {latest.length > 0 && (
          <ContentRow
            title={SECTION_LABELS.newReleases}
            items={latest.slice(0, 24)}
            isNewRow={true}
            icon={<Sparkles size={20} className="text-yellow-500" />}
            viewAllHref="/browse?sort=terbaru"
          />
        )}

        {/* Top Rated */}
        {topRated.length > 0 && (
          <ContentRow
            title={SECTION_LABELS.topRated}
            items={topRated}
            icon={<Star size={20} className="text-yellow-400" />}
            viewAllHref="/browse?sort=rating"
          />
        )}

        {/* Ongoing Series */}
        {ongoingSeries.length > 0 && (
          <ContentRow
            title={SECTION_LABELS.ongoing}
            items={ongoingSeries}
            icon={<Tv size={20} className="text-emerald-500" />}
            viewAllHref="/browse?type=tv"
          />
        )}

        {/* Drakor Row */}
        {typeGroups.drakor.length > 0 && (
          <ContentRow
            title={SECTION_LABELS.drakor}
            items={typeGroups.drakor.slice(0, 24)}
            icon={<Tv size={20} className="text-purple-500" />}
            viewAllHref="/browse?type=drakor"
          />
        )}

        {/* Action Movies */}
        {genreGroups["Aksi & Petualangan"].length > 0 && (
          <ContentRow
            title={SECTION_LABELS.action}
            items={genreGroups["Aksi & Petualangan"].slice(0, 24)}
            icon={<Clapperboard size={20} className="text-orange-500" />}
            viewAllHref="/browse?genre=aksi"
          />
        )}

        {/* Western Content */}
        {regionGroups.west.length > 0 && (
          <ContentRow
            title={SECTION_LABELS.west}
            items={regionGroups.west.slice(0, 24)}
            icon={<Globe size={20} className="text-green-500" />}
            viewAllHref="/browse?country=us"
          />
        )}

        {/* Drachin Row */}
        {typeGroups.drachin.length > 0 && (
          <ContentRow
            title={SECTION_LABELS.drachin}
            items={typeGroups.drachin.slice(0, 24)}
            viewAllHref="/browse?type=drachin"
          />
        )}

        {/* Anime / Animation */}
        {(typeGroups.anime.length > 0 || typeGroups.donghua.length > 0) && (
          <ContentRow
            title={SECTION_LABELS.anime}
            items={[...typeGroups.anime, ...typeGroups.donghua].slice(0, 24)}
            viewAllHref="/browse?type=anime"
          />
        )}

        {/* Horror & Mystery */}
        {genreGroups["Horor & Misteri"].length > 0 && (
          <ContentRow
            title={SECTION_LABELS.horror}
            items={genreGroups["Horor & Misteri"].slice(0, 24)}
          />
        )}

        {/* Comedy */}
        {genreGroups["Komedi"].length > 0 && (
          <ContentRow
            title={SECTION_LABELS.comedy}
            items={genreGroups["Komedi"].slice(0, 24)}
          />
        )}

        {/* Empty State */}
        {validContent.length === 0 && (
          <div className="px-5 mt-20">
            <div className="glass p-12 text-center rounded-3xl mx-auto max-w-2xl border-white/5 bg-white/5 backdrop-blur-xl">
              <h2 className="text-2xl md:text-4xl font-black mb-4 text-white uppercase italic tracking-tighter">
                Situs Masih Kosong
              </h2>
              <p className="text-gray-400 text-lg font-medium">
                Gunakan panel admin atau scraper untuk mengisi konten premium pertama Anda.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
