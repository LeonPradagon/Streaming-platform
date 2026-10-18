export const VIDEASY_ORIGIN = "https://videasy.xyz";
export const VIDEASY_LEGACY_ORIGIN = "https://player.videasy.net";

export function videasyVariant(input: string): "current" | "legacy" | null {
  try {
    const url = new URL(input);
    if (url.username || url.password || url.port) return null;
    return url.origin === VIDEASY_ORIGIN ? "current" : url.origin === VIDEASY_LEGACY_ORIGIN ? "legacy" : null;
  } catch { return null; }
}

export function videasyEmbedUrl(tmdbId: number, type: "movie" | "tv", season = 1, episode = 1, legacy = false): string {
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0 || !["movie", "tv"].includes(type)) throw new Error("Invalid Videasy media identity.");
  if (type === "tv" && (!Number.isSafeInteger(season) || season < 0 || !Number.isSafeInteger(episode) || episode <= 0)) throw new Error("Invalid Videasy season/episode.");
  return `${legacy ? VIDEASY_LEGACY_ORIGIN : `${VIDEASY_ORIGIN}/embed`}/${type}/${tmdbId}${type === "tv" ? `/${season}/${episode}` : ""}`;
}

interface EmbedLink { id: string; provider: string; url: string }

/** Upgrade existing Videasy slots in memory without changing database rows. */
export function upgradeVideasyLinks(links: EmbedLink[], tmdbId: number, type: "movie" | "tv"): EmbedLink[] {
  return links.map(link => {
    if (!link.provider.toLowerCase().includes("videasy") || !videasyVariant(link.url)) return link;
    return { ...link, url: videasyEmbedUrl(tmdbId, type) };
  });
}

/** XYZ documents these parameters; it does not document external subtitles or start-time seeking. */
export function styleCurrentVideasy(input: string): string {
  if (videasyVariant(input) !== "current") return input;
  const url = new URL(input);
  for (const parameter of ["color", "sub", "sub_url", "subtitle_url", "subtitle", "startAt"]) url.searchParams.delete(parameter);
  url.searchParams.set("primarycolor", "ED574B");
  url.searchParams.set("secondarycolor", "ffffff");
  url.searchParams.set("iconcolor", "ffffff");
  url.searchParams.set("fontcolor", "ffffff");
  url.searchParams.set("autoplay", "true");
  return url.toString();
}
