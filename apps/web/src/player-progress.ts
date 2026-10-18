export interface PlaybackContext { tmdbId?: number; mediaType?: string; season?: number; episode?: number }
export interface PlayerProgress { position: number; duration: number; event?: string }

export function isTrustedPlayerEvent(event: MessageEvent, frame: HTMLIFrameElement | null, src: string) {
  if (!frame || event.source !== frame.contentWindow) return false;
  try {
    const origin = new URL(src).origin;
    return event.origin === origin && ["https://vidlink.pro", "https://videasy.xyz", "https://player.videasy.net", "https://moviesapi.to"].includes(origin);
  } catch { return false; }
}

export function parsePlayerProgress(raw: unknown, context: PlaybackContext): PlayerProgress | null {
  try {
    const payload: any = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!payload || typeof payload !== "object" || !["MEDIA_DATA", "PLAYER_EVENT", "TIME_UPDATE"].includes(payload.type)) return null;
    let data = payload.type === "TIME_UPDATE" ? payload : payload.data;
    if (!data || typeof data !== "object") return null;
    const id = data.tmdbId ?? data.mtmdbId ?? data.id;
    if (id !== undefined && String(id) !== String(context.tmdbId)) return null;
    const mediaType = data.mediaType || (payload.type === "TIME_UPDATE" ? undefined : data.type);
    if (mediaType && mediaType !== context.mediaType) return null;
    if ((data.season !== undefined && Number(data.season) !== context.season) || (data.episode !== undefined && Number(data.episode) !== context.episode)) return null;
    if (context.tmdbId && data[String(context.tmdbId)]) {
      data = data[String(context.tmdbId)];
      if (data.type && data.type !== context.mediaType) return null;
      if (context.mediaType === "tv") {
        if (Number(data.last_season_watched) !== context.season || Number(data.last_episode_watched) !== context.episode) return null;
        data = data.show_progress?.[`s${context.season}e${context.episode}`]?.progress || data.progress;
      } else data = data.progress;
    }
    const position = data?.currentTime ?? data?.watched;
    const duration = data?.duration;
    if (typeof position !== "number" || typeof duration !== "number" || !Number.isFinite(position) || !Number.isFinite(duration) || position < 0 || duration <= 0 || position > duration + 5) return null;
    return { position: Math.min(position, duration), duration, event: data.event };
  } catch { return null; }
}

export function withResume(src: string, position: number) {
  try {
    const url = new URL(src);
    if (url.origin !== "https://vidlink.pro" || !Number.isFinite(position) || position < 10) return src;
    url.searchParams.set("startAt", String(Math.floor(position)));
    return url.toString();
  } catch { return src; }
}
