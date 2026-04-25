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

  // Filter out deprecated providers from the database results
  const ALLOWED_PROVIDERS = ['VidLink', 'MoviesAPI', 'Videasy'];
  const links = linksResult.data?.filter(link => 
    ALLOWED_PROVIDERS.some(allowed => link.provider?.toLowerCase().includes(allowed.toLowerCase()))
  ) || [];
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

  const nextEpisode = !isMovie && episodes?.find(ep => ep.episode_number === currentEpisode + 1);
  const nextEpisodeUrl = nextEpisode 
    ? `/watch/${id}?s=${currentServerIndex}&e=${nextEpisode.episode_number}&ss=${currentSeason}`
    : undefined;

  const prevEpisode = !isMovie && episodes?.find(ep => ep.episode_number === currentEpisode - 1);
  const prevEpisodeUrl = prevEpisode 
    ? `/watch/${id}?s=${currentServerIndex}&e=${prevEpisode.episode_number}&ss=${currentSeason}`
    : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden animate-fade-in">
      {/* Cinematic Backdrop */}
      <div
        className="absolute top-0 left-0 w-full h-[60vh] md:h-[80vh] bg-cover bg-center opacity-30 z-0 pointer-events-none"
        style={{
          backgroundImage: `url(${getTMDBImageUrl(metadata?.backdrop_path || "", "original")})`,
          maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
        }}
      />

      <main className="relative z-10 pt-28 px-4 md:px-12 lg:px-20 max-w-[1600px] mx-auto pb-32">
        {/* Breadcrumb / Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 font-semibold transition"
        >
          <ChevronLeft size={20} /> Kembali ke Beranda
        </Link>
        <div className="text-sm text-gray-500 font-semibold mb-6">
          {content.title}{" "}
          {!isMovie && episodes && episodes.length > 0
            ? `• S${currentSeason} E${currentEpisode}`
            : ""}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">
          {/* Left Column: Player & Info */}
          <section>
            {/* Player Container */}
            <div 
              className="w-full relative rounded-xl md:rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 bg-black mx-auto"
              style={{
                maxWidth: 'calc(75vh * 16 / 9)',
                aspectRatio: '16/9'
              }}
            >
              {activeLink ? (
                <VideoPlayer
                  src={finalUrl}
                  title={content.title}
                  backdrop={getTMDBImageUrl(
                    metadata?.backdrop_path || "",
                    "original",
                  )}
                  tmdbId={content.tmdb_id}
                  season={isMovie ? undefined : currentSeason}
                  episode={isMovie ? undefined : currentEpisode}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-5 relative">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Play size={36} className="text-zinc-600 ml-1" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-bold text-white text-lg">
                      Pilih Server untuk Menonton
                    </h3>
                    <p className="text-zinc-500 text-sm max-w-xs">
                      Pilih salah satu server di panel kanan untuk mulai memutar video.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Content Info (Below Player) */}
            <div className="mt-8">
              {/* Episode Navigation Bar */}
              {!isMovie && (prevEpisodeUrl || nextEpisodeUrl) && (
                <div className="flex items-center justify-between gap-3 mb-8 bg-white/5 p-2 rounded-2xl border border-white/5">
                  {prevEpisodeUrl ? (
                    <Link href={prevEpisodeUrl} className="flex-1 flex justify-center items-center gap-2 py-3 px-4 rounded-xl hover:bg-white/10 text-white font-bold text-[10px] md:text-xs uppercase tracking-widest transition">
                      <ChevronLeft size={16} className="text-zinc-400" /> Prev Episode
                    </Link>
                  ) : <div className="flex-1"></div>}
                  
                  <div className="w-px h-6 bg-white/10 shrink-0"></div>
                  
                  {nextEpisodeUrl ? (
                    <Link href={nextEpisodeUrl} className="flex-1 flex justify-center items-center gap-2 py-3 px-4 rounded-xl hover:bg-white/10 text-white font-bold text-[10px] md:text-xs uppercase tracking-widest transition group">
                      Next Episode <ChevronRight size={16} className="text-primary group-hover:translate-x-1 transition-transform" />
                    </Link>
                  ) : <div className="flex-1"></div>}
                </div>
              )}

              <h1 className="text-2xl md:text-5xl font-black mb-4 tracking-tight drop-shadow-md">
                {content.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm md:text-base font-semibold text-gray-300 mb-6">
                {content.platform && content.platform !== 'other' && (
                  <span 
                    className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-white shadow-lg"
                    style={{ backgroundColor: PLATFORM_COLORS[content.platform as Platform] || '#E50914' }}
                  >
                    {PLATFORM_LABELS[content.platform as Platform] || content.platform}
                  </span>
                )}
                <div className="flex items-center gap-1 text-yellow-400">
                  <Star size={16} fill="currentColor" />
                  <span>{metadata?.vote_average?.toFixed(1) || "N/A"}</span>
                </div>
                <span className="text-gray-700">|</span>
                <div className="flex items-center gap-1">
                  <Calendar size={16} className="text-gray-500" />
                  <span>
                    {(metadata?.first_air_date || metadata?.release_date || "").split("-")[0]}
                  </span>
                </div>
                <span className="text-gray-700">|</span>
                <span className="bg-primary/20 text-primary text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-primary/20">
                   {isMovie ? "Movie" : `${content.type === 'drakor' ? 'K-Drama' : content.type === 'drachin' ? 'C-Drama' : content.type === 'anime' ? 'Anime' : content.type === 'donghua' ? 'Donghua' : content.type === 'variety' ? 'Variety' : content.type === 'drathai' ? 'Thai Drama' : content.type === 'drajep' ? 'J-Drama' : 'Series'}`}
                </span>
                <div className="px-2 py-0.5 border border-gray-700 rounded text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/5">
                  {content.quality || 'HD'}
                </div>
              </div>

              <div className="flex gap-2 mb-6 flex-wrap">
                {metadata?.genres?.map((g: { id: number; name: string }) => (
                  <span
                    key={g.id}
                    className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-gray-300 hover:bg-white/10 transition cursor-default"
                  >
                    {g.name}
                  </span>
                ))}
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

              {/* Cast Section */}
              {metadata?.credits?.cast && metadata.credits.cast.length > 0 && (
                <div className="border-t border-white/10 pt-8 mt-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Star size={20} className="text-yellow-500" /> Pemain Utama
                  </h3>
                  <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
                    {metadata.credits.cast.slice(0, 15).map((actor) => (
                      <div key={actor.id} className="flex-shrink-0 w-20 md:w-24 group cursor-default">
                        <div className="aspect-square rounded-full overflow-hidden bg-white/5 border border-white/5 group-hover:border-yellow-500/50 transition-all duration-300 relative">
                          <img 
                            src={actor.profile_path ? getTMDBImageUrl(actor.profile_path, 'w185') : `https://placehold.co/200x200/060d17/64748b?text=${actor.name.charAt(0)}`}
                            alt={actor.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                        <div className="mt-3 text-center">
                          <div className="text-[10px] md:text-xs font-bold text-white line-clamp-1 group-hover:text-yellow-500 transition-colors">{actor.name}</div>
                          <div className="text-[9px] md:text-[10px] text-gray-500 line-clamp-1 mt-0.5">{actor.character}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-white/10 pt-8 mt-8">
                <h3 className="text-xl font-bold mb-3">Sinopsis</h3>
                <p className="text-gray-400 leading-relaxed text-lg max-w-4xl">
                  {metadata?.overview || "Sinopsis tidak tersedia."}
                </p>
              </div>
            </div>
          </section>

          {/* Right Column: Servers & Episodes */}
          <aside className="flex flex-col gap-6 w-full max-w-full">
            {/* Servers Selector */}
            <div className="glass p-5 md:p-6 rounded-2xl w-full box-border border-white/10">
              <h3 className="font-bold flex items-center gap-2 mb-4 text-primary opacity-90">
                <Server size={18} /> Pilihan Server
              </h3>
              <div className="flex flex-wrap gap-2">
                {links?.map((link, idx) => (
                  <Link
                    key={link.id}
                    href={`/watch/${id}?s=${idx}&e=${currentEpisode}&ss=${currentSeason}`}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      currentServerIndex === idx
                        ? "bg-primary text-white shadow-lg shadow-primary-glow border border-primary"
                        : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {link.provider
                      .replace(" (Main)", "")
                      .replace(" (Stabile)", "")
                      .replace(" (Mirror)", "")
                      .replace(" (Auto)", "")}
                  </Link>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-gray-400 leading-relaxed">
                <span className="text-primary font-bold">Tips:</span> Gunakan
                DNS 1.1.1.1 atau VPN jika video lambat atau diblokir.
              </div>
            </div>

            {/* Episode List for Series */}
            {!isMovie && (
              <div className="glass p-5 md:p-6 rounded-2xl w-full box-border border-white/10">
                <div className="flex flex-col gap-6">
                  {/* Season Selector */}
                  <div>
                    <h3 className="font-bold flex items-center gap-2 mb-4 text-primary opacity-90">
                      <List size={18} /> Season
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {seasons?.map((season) => (
                        <Link
                          key={season.id}
                          href={`/watch/${id}?s=${currentServerIndex}&e=1&ss=${season.season_number}`}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${
                            currentSeason === season.season_number
                              ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                              : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                          }`}
                        >
                          Season {season.season_number}
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Episode List */}
                  <div>
                    <h3 className="font-bold flex items-center gap-2 mb-4 text-gray-400">
                      <Play size={16} /> Episode di Season {currentSeason}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {episodes?.map((ep) => (
                        <Link
                          key={ep.id}
                          href={`/watch/${id}?s=${currentServerIndex}&e=${ep.episode_number}&ss=${currentSeason}`}
                          className={`flex items-center gap-4 p-3 rounded-xl border transition-all group ${
                            currentEpisode === ep.episode_number
                              ? "bg-primary/10 border-primary/30"
                              : "bg-white/2 border-white/5 hover:bg-white/5 hover:border-white/10"
                          }`}
                        >
                          <div
                            className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-sm font-black ${
                              currentEpisode === ep.episode_number
                                ? "bg-primary text-white"
                                : "bg-white/10 text-gray-400"
                            }`}
                          >
                            {ep.episode_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-bold truncate ${currentEpisode === ep.episode_number ? "text-white" : "text-gray-300 group-hover:text-white"}`}
                            >
                              {ep.title || `Episode ${ep.episode_number}`}
                            </div>
                            <div className="text-[10px] text-gray-500 font-semibold mt-0.5">
                              {ep.air_date
                                ? new Date(ep.air_date).toLocaleDateString(
                                    "id-ID",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )
                                : "Tanggal TBA"}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {(!episodes || episodes.length === 0) && (
                  <p className="text-sm text-gray-500 text-center py-8 bg-white/2 rounded-xl border border-dashed border-white/10">
                    Belum ada data episode untuk season ini.
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
