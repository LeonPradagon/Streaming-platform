import { supabase } from "@/lib/supabase";
import {
  fetchTMDBMetadata,
  fetchTMDBTVSeasonDetails,
  getTMDBImageUrl,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  Platform,
} from "@/lib/tmdb";
import Link from "next/link";
import {
  Play,
  Server,
  List,
  ChevronLeft,
  ChevronRight,
  Star,
  Calendar,
  Clock,
} from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import WatchActions from "@/components/WatchActions";
import SeasonSelector from "@/components/SeasonSelector";

import type { Metadata, ResolvingMetadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string; e?: string; ss?: string }>;
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;
  const supabaseForMeta = (await import('@/lib/supabase')).supabase;
  const [contentResult, settingsResult] = await Promise.all([
    supabaseForMeta.from("contents").select("title, tmdb_id, type, overview, backdrop_path, poster_path").eq("id", id).single(),
    supabaseForMeta.from("settings").select("value").eq("key", "site_config").single(),
  ]);
  const content = contentResult.data;
  const siteConfig = settingsResult.data?.value || { title: "NETIX" };

  if (!content) return { title: `Not Found - ${siteConfig.title}` };

  const siteTitle = siteConfig.title;
  const overviewSnippet = content.overview 
    ? (content.overview.length > 150 ? content.overview.substring(0, 150) + "..." : content.overview)
    : `Nonton streaming ${content.title} sub indo HD gratis di ${siteTitle}.`;

  return {
    title: `${content.title} - Nonton Gratis di ${siteTitle}`,
    description: overviewSnippet,
    openGraph: {
      title: `${content.title} - ${siteTitle}`,
      description: overviewSnippet,
      images: [
        getTMDBImageUrl(
          content.backdrop_path || content.poster_path || "",
          "original",
        ),
      ],
    },
  };
}

export default async function WatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { s, e, ss } = await searchParams;

  let currentServerIndex = s ? parseInt(s) : -1;
  const currentEpisode = parseInt(e || "1");
  const currentSeason = parseInt(ss || "1");

  // Fetch content info
  const { data: content, error } = await supabase
    .from("contents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !content)
    return <div className="text-white p-20 text-center">Content not found</div>;

  // All types that are NOT 'movie' are TV-like (have seasons/episodes)
  const isMovie = content.type === "movie";
  // For TMDB API calls, we need only 'movie' or 'tv'
  const tmdbType = isMovie ? "movie" : "tv";

  // ⚡ PERFORMANCE: Run ALL data fetches in parallel
  const [linksResult, metadataResult, seasonsResult] = await Promise.all([
    supabase.from("embed_links").select("*").eq("content_id", id).order("provider", { ascending: true }),
    fetchTMDBMetadata(content.tmdb_id, tmdbType),
    !isMovie 
      ? supabase.from("seasons").select("*").eq("content_id", id).order("season_number", { ascending: true })
      : Promise.resolve({ data: null }),
  ]);

  // Define priority order for providers
  const PROVIDER_PRIORITY = ['Videasy', 'MoviesAPI', 'VidLink'];
  
  const links = (linksResult.data || [])
    .filter(link => PROVIDER_PRIORITY.some(p => link.provider?.toLowerCase().includes(p.toLowerCase())))
    .sort((a, b) => {
      const aIndex = PROVIDER_PRIORITY.findIndex(p => a.provider?.toLowerCase().includes(p.toLowerCase()));
      const bIndex = PROVIDER_PRIORITY.findIndex(p => b.provider?.toLowerCase().includes(p.toLowerCase()));
      return aIndex - bIndex;
    });

  const metadata = metadataResult;
  const seasons = seasonsResult.data;

  if (currentServerIndex === -1) {
    const videasyIndex = links.findIndex(link => link.provider?.toLowerCase().includes('videasy'));
    currentServerIndex = videasyIndex !== -1 ? videasyIndex : 0;
  }

  const activeLink =
    links && links.length > currentServerIndex
      ? links[currentServerIndex]
      : links?.[0];

  // Construct Final URL based on episode/season for each provider
  let finalUrl = activeLink?.url || "";

  if (finalUrl) {
    try {
      const urlObj = new URL(finalUrl);
      const host = urlObj.hostname;
      const tmdbId = content.tmdb_id;

      if (isMovie) {
        // --- MOVIE URL construction ---
        if (host.includes('multiembed.mov')) {
          urlObj.searchParams.set('video_id', String(tmdbId));
          urlObj.searchParams.set('tmdb', '1');
          urlObj.searchParams.delete('s');
          urlObj.searchParams.delete('e');
          finalUrl = urlObj.toString();
        } else if (host.includes('player.videasy.net')) {
          finalUrl = `https://player.videasy.net/movie/${tmdbId}`;
        } else if (host.includes('vidlink.pro')) {
          finalUrl = `https://vidlink.pro/movie/${tmdbId}`;
        } else if (host.includes('moviesapi.to')) {
          finalUrl = `https://moviesapi.to/movie/${tmdbId}`;
        }
        // other providers stored correctly already
      } else {
        // --- TV URL construction ---
        if (host.includes('multiembed.mov')) {
          urlObj.searchParams.set('video_id', String(tmdbId));
          urlObj.searchParams.set('tmdb', '1');
          urlObj.searchParams.set('s', String(currentSeason));
          urlObj.searchParams.set('e', String(currentEpisode));
          finalUrl = urlObj.toString();
        } else if (host.includes('player.videasy.net')) {
          finalUrl = `https://player.videasy.net/tv/${tmdbId}/${currentSeason}/${currentEpisode}`;
        } else if (host.includes('vidlink.pro')) {
          finalUrl = `https://vidlink.pro/tv/${tmdbId}/${currentSeason}/${currentEpisode}`;
        } else if (host.includes('moviesapi.to')) {
          finalUrl = `https://moviesapi.to/tv/${tmdbId}-${currentSeason}-${currentEpisode}`;
        } else {
          // other providers — all use /embed/tv/{id}/{s}/{e}
          const pathParts = urlObj.pathname.split('/');
          const embedIdx = pathParts.indexOf('embed');
          if (embedIdx !== -1) {
            const prefix = pathParts.slice(0, embedIdx + 1).join('/');
            urlObj.pathname = `${prefix}/tv/${tmdbId}/${currentSeason}/${currentEpisode}`;
            finalUrl = urlObj.toString();
          } else {
            urlObj.pathname = `/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}`;
            finalUrl = urlObj.toString();
          }
        }
      }
    } catch {
      // Keep finalUrl as is if URL parsing fails
    }
  }


  const activeSeason =
    seasons?.find((s) => s.season_number === currentSeason) || seasons?.[0];

  // Fetch episodes (depends on activeSeason, so must be after)
  const { data: episodes } = activeSeason
    ? await supabase
        .from("episodes")
        .select("*")
        .eq("season_id", activeSeason.id)
        .order("episode_number", { ascending: true })
    : { data: [] };

  // 🎬 NEW: Fetch Subtitles (Scraped or Cached)
  let externalSubtitle = "";
  try {
    const { SubtitleService } = await import("@/services/SubtitleService");
    const subResult = await SubtitleService.fetchAndUploadSubtitle(
      content.tmdb_id, 
      isMovie ? 'movie' : 'tv',
      !isMovie ? String(currentSeason) : undefined,
      !isMovie ? String(currentEpisode) : undefined
    );
    if (subResult.url) {
      externalSubtitle = subResult.url;
    }
  } catch (err) {
    console.error("[WatchPage] Subtitle Fetch Error:", err);
  }

  const nextEpisode = !isMovie && episodes?.find(ep => ep.episode_number === currentEpisode + 1);
  const nextEpisodeUrl = nextEpisode 
    ? `/watch/${id}?s=${currentServerIndex}&e=${nextEpisode.episode_number}&ss=${currentSeason}`
    : undefined;

  const prevEpisode = !isMovie && episodes?.find(ep => ep.episode_number === currentEpisode - 1);
  const prevEpisodeUrl = prevEpisode 
    ? `/watch/${id}?s=${currentServerIndex}&e=${prevEpisode.episode_number}&ss=${currentSeason}`
    : undefined;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-x-hidden">
      {/* Cinematic Ambient Backdrop */}
      <div className="absolute top-0 left-0 w-full h-[100vh] pointer-events-none z-0">
        <div 
          className="absolute inset-0 opacity-40 grayscale-[0.2]"
          style={{
            backgroundImage: `url(${getTMDBImageUrl(metadata?.backdrop_path || "", "original")})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 20%',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-[#0a0a0a]/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(229,9,20,0.15),transparent_70%)]" />
      </div>

      <main className="relative z-10 pt-24 md:pt-32 px-4 md:px-12 lg:px-20 max-w-[1700px] mx-auto pb-32">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="space-y-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-2 font-bold transition-all group"
            >
              <div className="p-1.5 rounded-full bg-white/5 border border-white/10 group-hover:bg-red-600 group-hover:border-red-500 transition-all">
                <ChevronLeft size={16} />
              </div>
              Kembali
            </Link>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-tight uppercase">
              {content.title}
            </h1>
            {!isMovie && episodes && episodes.length > 0 && (
              <div className="flex items-center gap-2 text-red-500 font-black tracking-widest text-xs uppercase">
                <span className="bg-red-600/10 px-2 py-1 rounded border border-red-500/20">Season {currentSeason}</span>
                <span className="bg-white/10 text-white px-2 py-1 rounded border border-white/10">Episode {currentEpisode}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8 lg:gap-12">
          {/* Main Content Area */}
          <div className="space-y-10">
            {/* Player Section */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-indigo-600 rounded-[2rem] blur opacity-20 group-hover:opacity-30 transition duration-1000" />
              <div className="relative aspect-video w-full rounded-[1.5rem] md:rounded-[2rem] overflow-hidden bg-black border border-white/10 shadow-2xl z-10">
                {activeLink ? (
                  <VideoPlayer
                    src={finalUrl}
                    title={content.title}
                    backdrop={getTMDBImageUrl(metadata?.backdrop_path || "", "original")}
                    tmdbId={content.tmdb_id}
                    season={isMovie ? undefined : currentSeason}
                    episode={isMovie ? undefined : currentEpisode}
                    externalSubtitle={externalSubtitle}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
                      <Play size={40} className="text-gray-600 ml-1" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-black mb-2">PILIH SERVER</h3>
                      <p className="text-gray-500 text-sm">Pilih server di sebelah kanan untuk memulai</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions & Meta */}
            <div className="flex flex-wrap items-center justify-between gap-6 p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-yellow-500 font-black">
                  <Star size={20} fill="currentColor" />
                  <span className="text-2xl">{metadata?.vote_average?.toFixed(1) || "N/A"}</span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Release</span>
                  <span className="font-bold">{(metadata?.first_air_date || metadata?.release_date || "").split("-")[0]}</span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Quality</span>
                  <span className="font-bold text-red-500">{content.quality || '4K ULTRA HD'}</span>
                </div>
              </div>
              
              <WatchActions
                item={{
                  id: String(content.id),
                  title: content.title,
                  type: content.type,
                  poster_path: metadata?.poster_path || undefined,
                  vote_average: metadata?.vote_average,
                  release_date: metadata?.release_date,
                  first_air_date: metadata?.first_air_date,
                }}
              />
            </div>

            {/* Info & Cast Tabs (simplified for 2025) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-xl font-black tracking-widest uppercase flex items-center gap-3">
                  <div className="w-2 h-8 bg-red-600 rounded-full" /> Sinopsis
                </h3>
                <p className="text-gray-400 leading-relaxed font-medium text-lg">
                  {metadata?.overview || "Sinopsis tidak tersedia untuk judul ini."}
                </p>
                <div className="flex flex-wrap gap-2 pt-4">
                  {metadata?.genres?.map((g: any) => (
                    <span key={g.id} className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all cursor-default">
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-black tracking-widest uppercase flex items-center gap-3">
                  <div className="w-2 h-8 bg-indigo-600 rounded-full" /> Pemain Utama
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {metadata?.credits?.cast?.slice(0, 6).map((actor: any) => (
                    <div key={actor.id} className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-white/10 group hover:bg-white/10 transition-all">
                      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/20">
                        <img 
                          src={actor.profile_path ? getTMDBImageUrl(actor.profile_path, 'w185') : `https://placehold.co/100x100/1a1a1a/ffffff?text=${actor.name.charAt(0)}`}
                          alt={actor.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black truncate">{actor.name}</div>
                        <div className="text-[9px] text-gray-500 font-bold truncate uppercase tracking-tighter">{actor.character}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Sidebar) */}
          <aside className="space-y-8">
            {/* Server Selection */}
            <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-3xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-600/20 text-red-500">
                  <Server size={20} />
                </div>
                <h3 className="text-lg font-black tracking-widest uppercase">Pilih Server</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {links?.map((link, idx) => (
                  <Link
                    key={link.id}
                    href={`/watch/${id}?s=${idx}&e=${currentEpisode}&ss=${currentSeason}`}
                    className={`p-4 rounded-2xl text-center transition-all duration-300 font-black text-xs uppercase tracking-widest border ${
                      currentServerIndex === idx
                        ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20 scale-105"
                        : "bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {link.provider.replace(/\(.*\)/g, '').trim()}
                  </Link>
                ))}
              </div>
              <div className="p-4 rounded-2xl bg-indigo-600/10 border border-indigo-600/20">
                <p className="text-[10px] font-bold text-indigo-400 leading-relaxed uppercase tracking-widest text-center">
                   Tips: Jika loading lambat, coba ganti server lain atau gunakan VPN.
                </p>
              </div>
            </div>

            {/* Episode List (TV Only) */}
            {!isMovie && (
              <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-3xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-500">
                      <List size={20} />
                    </div>
                    <h3 className="text-lg font-black tracking-widest uppercase">Daftar Episode</h3>
                  </div>
                  <SeasonSelector 
                    id={id}
                    currentSeason={currentSeason}
                    currentServerIndex={currentServerIndex}
                    seasons={seasons || []}
                  />
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {episodes?.map((ep) => (
                    <Link
                      key={ep.id}
                      href={`/watch/${id}?s=${currentServerIndex}&e=${ep.episode_number}&ss=${currentSeason}`}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all group ${
                        currentEpisode === ep.episode_number
                          ? "bg-red-600/10 border-red-600/30"
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        currentEpisode === ep.episode_number ? "bg-red-600 text-white" : "bg-white/10 text-gray-500"
                      }`}>
                        {ep.episode_number}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-black truncate ${currentEpisode === ep.episode_number ? "text-white" : "text-gray-400 group-hover:text-white"}`}>
                          {ep.title || `Episode ${ep.episode_number}`}
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                          {ep.air_date ? new Date(ep.air_date).getFullYear() : 'TBA'}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
