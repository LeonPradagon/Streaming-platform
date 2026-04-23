import { supabase } from "@/lib/supabase";
import {
  fetchTMDBMetadata,
  fetchTMDBTVSeasonDetails,
  getTMDBImageUrl,
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
  const { data: content } = await supabase
    .from("contents")
    .select("title, tmdb_id, type, overview, backdrop_path, poster_path")
    .eq("id", id)
    .single();

  // Fetch Site Config for brand name
  const { data: settingsData } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "site_config")
    .single();
  const siteConfig = settingsData?.value || { title: "NETIX" };

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

  const currentServerIndex = parseInt(s || "0");
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

  // Fetch embed links
  const { data: links } = await supabase
    .from("embed_links")
    .select("*")
    .eq("content_id", id)
    .order("provider", { ascending: true });

  const activeLink =
    links && links.length > currentServerIndex
      ? links[currentServerIndex]
      : links?.[0];
  const isMovie = content.type === "movie";

  // Construct Final URL based on episode/season
  let finalUrl = activeLink?.url || "";
  const isVideoProvider =
    finalUrl.includes("vidsrc") ||
    finalUrl.includes("embed.su") ||
    finalUrl.includes("vidlink") ||
    finalUrl.includes("jenius");

  if (isVideoProvider) {
    const [urlWithoutQuery, query] = finalUrl.split("?");
    const queryString = query ? `?${query}` : "";

    if (urlWithoutQuery.includes("vidlink")) {
      const type = isMovie ? "/movie/" : "/tv/";
      const baseUrl = urlWithoutQuery.split(type)[0] + type + content.tmdb_id;
      finalUrl = isMovie
        ? `${baseUrl}${queryString}`
        : `${baseUrl}/${currentSeason}/${currentEpisode}${queryString}`;
    } else {
      const type = urlWithoutQuery.includes("tv") ? "tv/" : "movie/";
      const baseUrl =
        urlWithoutQuery.split("/embed/")[0] +
        "/embed/" +
        type +
        content.tmdb_id;
      finalUrl = isMovie
        ? `${baseUrl}${queryString}`
        : `${baseUrl}/${currentSeason}/${currentEpisode}${queryString}`;
    }
  }

  // Fetch TMDB metadata for details only
  const metadata = await fetchTMDBMetadata(
    content.tmdb_id,
    !isMovie ? "tv" : "movie",
  );

  // Fetch Seasons from Database
  const { data: seasons } = await supabase
    .from("seasons")
    .select("*")
    .eq("content_id", id)
    .order("season_number", { ascending: true });

  const activeSeason =
    seasons?.find((s) => s.season_number === currentSeason) || seasons?.[0];

  // Fetch Episodes for active season from Database
  const { data: episodes } = activeSeason
    ? await supabase
        .from("episodes")
        .select("*")
        .eq("season_id", activeSeason.id)
        .order("episode_number", { ascending: true })
    : { data: [] };

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

      <main className="relative z-10 pt-24 px-4 md:px-12 lg:px-20 max-w-[1600px] mx-auto pb-20">
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8 lg:gap-12 items-start">
          {/* Left Column: Player & Info */}
          <section>
            {/* Player Container */}
            <div className="w-full aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 bg-black">
              {activeLink ? (
                <VideoPlayer
                  src={finalUrl}
                  title={content.title}
                  backdrop={getTMDBImageUrl(
                    metadata?.backdrop_path || "",
                    "original",
                  )}
                  tmdbId={content.tmdb_id}
                  mediaType={isMovie ? "movie" : "tv"}
                  season={isMovie ? undefined : currentSeason}
                  episode={isMovie ? undefined : currentEpisode}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-500 relative">
                  <Play size={64} className="opacity-20" />
                  <span className="font-semibold text-lg">
                    Server video tidak tersedia.
                  </span>
                </div>
              )}
            </div>

            {/* Content Info (Below Player) */}
            <div className="mt-8">
              <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tight drop-shadow-md">
                {content.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm md:text-base text-gray-300 font-semibold mb-6">
                <div className="flex items-center gap-1 text-yellow-400">
                  <Star size={16} fill="currentColor" />
                  <span>{metadata?.vote_average?.toFixed(1) || "N/A"}</span>
                </div>
                <span>|</span>
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  <span>
                    {
                      (
                        metadata?.first_air_date ||
                        metadata?.release_date ||
                        ""
                      ).split("-")[0]
                    }
                  </span>
                </div>
                <span>|</span>
                <div className="flex items-center gap-1">
                  <Clock size={16} />
                  <span className="uppercase">
                    {content.type === "tv"
                      ? `Series • ${metadata?.status === "Ended" || metadata?.status === "Canceled" ? "Completed" : "Ongoing"}`
                      : content.type}
                  </span>
                </div>
                <div className="px-2 py-0.5 border border-gray-500 rounded text-xs font-bold text-gray-400">
                  HD
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

              {/* Action Toolbar (functional) */}
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

              <div className="border-t border-white/10 pt-6">
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
                      .replace(" (Mirror)", "")}
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
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
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
