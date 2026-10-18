import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { and, asc, desc, eq, gt, lte, not, sql } from "drizzle-orm";
import { db } from "../db/database";
import { contents, embedLinks, episodes, scraperLogs, seasons, settings } from "../db/schema";
import { SubtitleSyncService } from "../subtitles/subtitle-sync.service";

const NETWORK_PROVIDER_IDS: Record<string, number> = { netflix: 8, disney: 337, amazon: 119, apple: 350, hbo: 1899, paramount: 531 };
const MIN_DISCOVERY_RATING = 6;
const MIN_DISCOVERY_VOTES = 50;
const TASKS = new Set(["scrape", "trending", "sync", "validate", "reclassify", "tv_sync", "subtitles", ...Object.keys(NETWORK_PROVIDER_IDS).flatMap((name) => [`network_${name}`, `network_tv_${name}`])]);
@Injectable()
export class ScraperService {
  constructor(private readonly subtitleSync: SubtitleSyncService) {}

  async logs() {
    const items = await db.select({
      id: scraperLogs.id,
      taskName: scraperLogs.taskName,
      status: scraperLogs.status,
      itemsCount: scraperLogs.itemsCount,
      summary: scraperLogs.summary,
      errorMessage: scraperLogs.errorMessage,
      createdAt: scraperLogs.createdAt,
      finishedAt: scraperLogs.finishedAt,
      progress: scraperLogs.progress,
    }).from(scraperLogs).orderBy(desc(scraperLogs.createdAt)).limit(25);
    return { items };
  }

  async health() {
    const providers = [
      { name: "TMDB API", url: "https://api.themoviedb.org/3/configuration" },
      { name: "MoviesAPI", url: "https://moviesapi.to" },
      { name: "VidAPI.xyz", url: "https://vidapi.xyz" },
      { name: "SuperEmbed", url: "https://multiembed.mov" },
    ];
    return { providers: await Promise.all(providers.map(async ({ name, url }) => {
      const start = Date.now();
      try {
        const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        return { name, status: response.ok || response.status === 403 ? "online" : "degraded", latency: Date.now() - start };
      } catch {
        return { name, status: "offline", latency: Date.now() - start };
      }
    })) };
  }

  async stop() {
    const active = await db.select({ id: scraperLogs.id }).from(scraperLogs).where(eq(scraperLogs.status, "running"));
    for (const log of active) {
      await db.update(scraperLogs).set({ status: "failed", errorMessage: "Stopped by administrator", finishedAt: new Date() }).where(eq(scraperLogs.id, log.id));
    }
    return { ok: true, stopped: active.length };
  }

  async recoverable() {
    const [log] = await db.select().from(scraperLogs).where(eq(scraperLogs.status, "running")).orderBy(desc(scraperLogs.createdAt)).limit(1);
    if (!log) return { task: null };
    const checkpoint = log.checkpoint && typeof log.checkpoint === "object" && !Array.isArray(log.checkpoint)
      ? log.checkpoint as Record<string, unknown>
      : {};
    return { task: log.taskName, logId: log.id, state: { ...checkpoint, logId: log.id }, progress: log.progress };
  }

  private async saveCheckpoint<T extends { hasMore: boolean; nextState: Record<string, unknown> }>(logId: string, result: T): Promise<T> {
    await db.update(scraperLogs).set({ checkpoint: result.hasMore ? result.nextState : null }).where(eq(scraperLogs.id, logId));
    return result;
  }

  private async runMaintenance(task: string, state: Record<string, unknown>, logId: string, apiKey: string) {
    const offset = (Number(state.page ?? 1) - 1) * 10;
    const where = undefined;
    const [rows, count] = await Promise.all([
      db.select().from(contents).where(where).orderBy(desc(contents.createdAt)).limit(10).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(contents).where(where),
    ]);
    const summary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] as string[] };
    const providerResults = new Map<string, { platforms?: string[]; error?: string }>();
    if (task === "reclassify") {
      await Promise.all(rows.map(async (item) => {
        try {
          const mediaType = item.type === "movie" ? "movie" : "tv";
          const providerUrl = new URL(`https://api.themoviedb.org/3/${mediaType}/${item.tmdbId}/watch/providers`);
          providerUrl.searchParams.set("api_key", apiKey);
          const response = await fetch(providerUrl, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error(`TMDB watch providers responded ${response.status}`);
          const data = await response.json() as { results?: Record<string, { flatrate?: { provider_id: number }[] }> };
          const ids = new Set((data.results?.ID?.flatrate ?? []).map(({ provider_id }) => provider_id));
          providerResults.set(item.id, { platforms: Object.entries(NETWORK_PROVIDER_IDS).filter(([, id]) => ids.has(id)).map(([name]) => name) });
        } catch (error) {
          providerResults.set(item.id, { error: error instanceof Error ? error.message : "TMDB provider lookup failed" });
        }
      }));
    }
    for (const item of rows) {
      const [activeLog] = await db.select({ status: scraperLogs.status }).from(scraperLogs).where(eq(scraperLogs.id, logId)).limit(1);
      if (activeLog?.status !== "running") throw new ConflictException("Scraper task was stopped.");
      summary.items_processed++;
      try {
        if (task === "validate") {
          const links = await db.select().from(embedLinks).where(eq(embedLinks.contentId, item.id));
          let healthy = false;
          for (const link of links) {
            let target: URL;
            try { target = new URL(link.url); } catch { continue; }
            if (target.protocol !== "https:" || !["moviesapi.to", "vidapi.xyz", "multiembed.mov", "drive.google.com"].includes(target.hostname)) continue;
            try {
              const response = await fetch(target, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(3500) });
              if (response.ok || [206, 403].includes(response.status)) { healthy = true; break; }
            } catch { /* Try the next saved provider link. */ }
          }
          await db.update(contents).set({ isHealthy: healthy, lastCheckedAt: new Date(), updatedAt: new Date() }).where(eq(contents.id, item.id));
          if (healthy) summary.items_added++;
        } else if (task === "reclassify") {
          const result = providerResults.get(item.id);
          if (!result || result.error) throw new Error(result?.error ?? "TMDB provider lookup failed");
          const platforms = result.platforms ?? [];
          await db.update(contents).set({ platform: platforms[0] ?? "other", platforms, updatedAt: new Date() }).where(eq(contents.id, item.id));
          summary.items_added++;
        } else {
          const mediaType = item.type === "movie" ? "movie" : "tv";
          const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${item.tmdbId}`);
          url.searchParams.set("api_key", apiKey);
          url.searchParams.set("language", "id-ID");
          url.searchParams.set("append_to_response", "credits,videos");
          const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error(`TMDB responded ${response.status}`);
          const metadata = await response.json() as Record<string, any>;
          const trailer = metadata.videos?.results?.find((video: any) => video.type === "Trailer" && video.site === "YouTube") ?? metadata.videos?.results?.find((video: any) => video.site === "YouTube");
          const fields: Partial<typeof contents.$inferInsert> = {
            title: metadata.title ?? metadata.name ?? item.title,
            overview: metadata.overview ?? item.overview,
            posterPath: metadata.poster_path ?? item.posterPath,
            backdropPath: metadata.backdrop_path ?? item.backdropPath,
            releaseDate: metadata.release_date ?? metadata.first_air_date ?? item.releaseDate,
            voteAverage: metadata.vote_average == null ? item.voteAverage : String(metadata.vote_average),
            popularity: metadata.popularity == null ? item.popularity : String(metadata.popularity),
            castData: metadata.credits?.cast?.slice(0, 10) ?? item.castData,
            genreNames: metadata.genres?.map((genre: any) => genre.name) ?? item.genreNames,
            trailerKey: trailer?.key ?? item.trailerKey,
            tvStatus: metadata.status ?? item.tvStatus,
            updatedAt: new Date(),
          };
          await db.update(contents).set(fields).where(eq(contents.id, item.id));
          summary.items_added++;
        }
      } catch (error) {
        summary.items_failed++;
        if (summary.errors.length < 10) summary.errors.push(`${item.title}: ${error instanceof Error ? error.message : "Processing failed"}`);
      }
      await db.update(scraperLogs).set({
        itemsCount: offset + summary.items_processed,
        summary: { items_processed: offset + summary.items_processed, items_added: Number(state.accumulatedAdded ?? 0) + summary.items_added, items_failed: Number(state.accumulatedFailed ?? 0) + summary.items_failed, errors: summary.errors },
        progress: { current: offset + summary.items_processed, total: count[0].count, current_item: item.title, _lastUpdated: new Date().toISOString() },
      }).where(and(eq(scraperLogs.id, logId), eq(scraperLogs.status, "running")));
    }
    const hasMore = offset + rows.length < count[0].count;
    const nextState = hasMore ? { page: Number(state.page ?? 1) + 1, logId, accumulatedAdded: Number(state.accumulatedAdded ?? 0) + summary.items_added, accumulatedFailed: Number(state.accumulatedFailed ?? 0) + summary.items_failed } : {};
    if (!hasMore) await db.update(scraperLogs).set({ status: "success", finishedAt: new Date() }).where(and(eq(scraperLogs.id, logId), eq(scraperLogs.status, "running")));
    return { success: true, summary, hasMore, nextState, logId, total: count[0].count };
  }

  private async runSubtitleSync(state: Record<string, unknown>, logId: string) {
    const offset = Number(state.subtitleOffset ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw new BadRequestException("Invalid subtitle sync state.");
    const [item] = await db.select().from(contents).where(eq(contents.status, "approved")).orderBy(asc(contents.id)).limit(1).offset(offset);
    const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(contents).where(eq(contents.status, "approved"));
    if (!item) {
      await db.update(scraperLogs).set({ status: "success", finishedAt: new Date() }).where(and(eq(scraperLogs.id, logId), eq(scraperLogs.status, "running")));
      return { success: true, summary: { items_processed: 0, items_added: 0, items_failed: 0, errors: [] }, hasMore: false, nextState: {}, logId };
    }
    const priorProcessed = Number(state.accumulatedProcessed ?? 0);
    const priorAdded = Number(state.accumulatedAdded ?? 0);
    const priorFailed = Number(state.accumulatedFailed ?? 0);
    const priorSkipped = Number(state.accumulatedSkipped ?? 0);
    const priorId = Number(state.accumulatedIndonesian ?? 0);
    const priorEn = Number(state.accumulatedEnglish ?? 0);
    let added = 0;
    let failed = 0;
    let skipped = 0;
    let subtitleId = 0;
    let subtitleEn = 0;
    let currentItem = item.title;
    let errorMessage = "";
    try {
      let season: number | undefined;
      let episode: number | undefined;
      const isMovie = item.type === "movie";
      if (!isMovie) {
        const today = new Date().toISOString().slice(0, 10);
        const [aired] = await db.select({ seasonNumber: seasons.seasonNumber, episodeNumber: episodes.episodeNumber })
          .from(episodes).innerJoin(seasons, eq(episodes.seasonId, seasons.id))
          .where(and(eq(seasons.contentId, item.id), gt(seasons.seasonNumber, 0), lte(episodes.airDate, today)))
          .orderBy(desc(episodes.airDate)).limit(1);
        if (!aired) skipped++;
        else { season = aired.seasonNumber; episode = aired.episodeNumber; currentItem = `${item.title} · S${season}E${episode}`; }
      }
      if (isMovie || season && episode) {
        const result = await this.subtitleSync.sync(item.tmdbId, isMovie ? "movie" : "tv", season, episode);
        if (result.status === "created") added++;
        else if (result.status === "cached") skipped++;
        else { failed++; errorMessage = result.reason ?? "Subtitle unavailable."; }
        if (result.language === "id") subtitleId++;
        if (result.language === "en") subtitleEn++;
      }
    } catch (error) { failed++; errorMessage = error instanceof Error ? error.message : "Subtitle sync failed."; }
    const processed = priorProcessed + 1;
    const nextOffset = offset + 1;
    const hasMore = nextOffset < count.count;
    const errors = Array.isArray(state.errors) ? state.errors.filter((value): value is string => typeof value === "string").slice(-19) : [];
    if (errorMessage) errors.push(`${item.tmdbId}: ${errorMessage}`);
    const nextState = hasMore ? {
      subtitleOffset: nextOffset, logId, accumulatedProcessed: processed, accumulatedAdded: priorAdded + added,
      accumulatedFailed: priorFailed + failed, accumulatedSkipped: priorSkipped + skipped,
      accumulatedIndonesian: priorId + subtitleId, accumulatedEnglish: priorEn + subtitleEn, errors,
    } : {};
    await db.update(scraperLogs).set({
      itemsCount: processed,
      summary: { items_processed: processed, items_added: priorAdded + added, items_failed: priorFailed + failed, items_skipped: priorSkipped + skipped, subtitle_id: priorId + subtitleId, subtitle_en: priorEn + subtitleEn, errors },
      progress: { current: nextOffset, total: count.count, current_item: currentItem, _lastUpdated: new Date().toISOString() },
      ...(hasMore ? {} : { status: "success", finishedAt: new Date() }),
    }).where(and(eq(scraperLogs.id, logId), eq(scraperLogs.status, "running")));
    return { success: true, summary: { items_processed: 1, items_added: added, items_failed: failed, items_skipped: skipped, subtitle_id: subtitleId, subtitle_en: subtitleEn, errors: errorMessage ? [errorMessage] : [] }, hasMore, nextState, logId, total: count.count };
  }

  private async runTvSync(state: Record<string, unknown>, logId: string, apiKey: string) {
    const contentOffset = Number(state.contentOffset ?? 0);
    const seasonIndex = Number(state.seasonIndex ?? 0);
    if (!Number.isSafeInteger(contentOffset) || contentOffset < 0 || contentOffset > 5000 || !Number.isSafeInteger(seasonIndex) || seasonIndex < 0 || seasonIndex > 100) throw new BadRequestException("Invalid TV sync state.");
    const tvContent = not(eq(contents.type, "movie"));
    const [item] = await db.select().from(contents).where(tvContent).orderBy(desc(contents.createdAt)).limit(1).offset(contentOffset);
    const [count] = await db.select({ count: sql<number>`count(*)::int` }).from(contents).where(tvContent);
    if (!item) {
      await db.update(scraperLogs).set({ status: "success", finishedAt: new Date() }).where(and(eq(scraperLogs.id, logId), eq(scraperLogs.status, "running")));
      return { success: true, summary: { items_processed: 0, items_added: 0, items_failed: 0, errors: [] }, hasMore: false, nextState: {}, logId };
    }
    const priorProcessed = Number(state.accumulatedProcessed ?? 0);
    const priorUpdated = Number(state.accumulatedAdded ?? 0);
    const priorFailed = Number(state.accumulatedFailed ?? 0);
    let updatedEpisodes = 0;
    let failed = 0;
    let message = item.title;
    let hasMore = false;
    let nextContentOffset = contentOffset + 1;
    let nextSeasonIndex = 0;
    try {
      const seriesUrl = new URL(`https://api.themoviedb.org/3/tv/${item.tmdbId}`);
      seriesUrl.searchParams.set("api_key", apiKey);
      const seriesResponse = await fetch(seriesUrl, { signal: AbortSignal.timeout(8000) });
      if (!seriesResponse.ok) throw new Error(`TMDB series request failed (${seriesResponse.status}).`);
      const series = await seriesResponse.json() as { seasons?: Record<string, any>[] };
      const validSeasons = (series.seasons ?? []).filter((season) => Number(season.season_number) > 0);
      const seasonMeta = validSeasons[seasonIndex];
      if (seasonMeta) {
        const seasonUrl = new URL(`https://api.themoviedb.org/3/tv/${item.tmdbId}/season/${seasonMeta.season_number}`);
        seasonUrl.searchParams.set("api_key", apiKey);
        seasonUrl.searchParams.set("language", "id-ID");
        const seasonResponse = await fetch(seasonUrl, { signal: AbortSignal.timeout(10000) });
        if (!seasonResponse.ok) throw new Error(`TMDB season request failed (${seasonResponse.status}).`);
        const seasonData = await seasonResponse.json() as Record<string, any>;
        const [existingSeason] = await db.select({ id: seasons.id }).from(seasons).where(and(eq(seasons.contentId, item.id), eq(seasons.seasonNumber, Number(seasonMeta.season_number)))).limit(1);
        const seasonValues = {
          title: seasonData.name ?? seasonMeta.name ?? null,
          overview: seasonData.overview ?? seasonMeta.overview ?? null,
          posterPath: seasonData.poster_path ?? seasonMeta.poster_path ?? null,
          airDate: seasonData.air_date ?? seasonMeta.air_date ?? null,
          episodeCount: Number(seasonData.episodes?.length ?? seasonMeta.episode_count ?? 0),
        };
        let seasonId = existingSeason?.id;
        if (seasonId) await db.update(seasons).set(seasonValues).where(eq(seasons.id, seasonId));
        else {
          const [created] = await db.insert(seasons).values({ id: crypto.randomUUID(), contentId: item.id, seasonNumber: Number(seasonMeta.season_number), ...seasonValues, createdAt: new Date() }).returning({ id: seasons.id });
          seasonId = created.id;
        }
        for (const episode of (seasonData.episodes ?? []) as Record<string, any>[]) {
          const episodeNumber = Number(episode.episode_number);
          if (!Number.isSafeInteger(episodeNumber) || episodeNumber < 1) continue;
          const [existingEpisode] = await db.select({ id: episodes.id }).from(episodes).where(and(eq(episodes.seasonId, seasonId), eq(episodes.episodeNumber, episodeNumber))).limit(1);
          const episodeValues = { title: episode.name ?? null, overview: episode.overview ?? null, stillPath: episode.still_path ?? null, airDate: episode.air_date ?? null };
          if (existingEpisode) await db.update(episodes).set(episodeValues).where(eq(episodes.id, existingEpisode.id));
          else await db.insert(episodes).values({ id: crypto.randomUUID(), seasonId, episodeNumber, ...episodeValues, createdAt: new Date() });
          updatedEpisodes++;
        }
        message = `${item.title} · ${seasonMeta.name ?? `Season ${seasonMeta.season_number}`}`;
        if (seasonIndex + 1 < validSeasons.length) { hasMore = true; nextContentOffset = contentOffset; nextSeasonIndex = seasonIndex + 1; }
        else hasMore = nextContentOffset < count.count;
      } else hasMore = nextContentOffset < count.count;
    } catch (error) {
      failed = 1;
      message = error instanceof Error ? error.message : "TV sync failed.";
      hasMore = nextContentOffset < count.count;
    }
    const accumulatedProcessed = priorProcessed + 1;
    const accumulatedAdded = priorUpdated + updatedEpisodes;
    const accumulatedFailed = priorFailed + failed;
    const nextState = hasMore ? { contentOffset: nextContentOffset, seasonIndex: nextSeasonIndex, logId, accumulatedProcessed, accumulatedAdded, accumulatedFailed } : {};
    await db.update(scraperLogs).set({
      itemsCount: accumulatedProcessed,
      summary: { items_processed: accumulatedProcessed, items_added: accumulatedAdded, items_failed: accumulatedFailed, errors: failed ? [message] : [] },
      progress: { current: contentOffset + 1, total: count.count, current_item: message, _lastUpdated: new Date().toISOString() },
      ...(hasMore ? {} : { status: "success", finishedAt: new Date() }),
    }).where(and(eq(scraperLogs.id, logId), eq(scraperLogs.status, "running")));
    return { success: true, summary: { items_processed: 1, items_added: updatedEpisodes, items_failed: failed, errors: failed ? [message] : [] }, hasMore, nextState, logId, total: count.count };
  }

  async run(task: unknown, rawState: unknown) {
    if (typeof task !== "string" || !TASKS.has(task)) throw new BadRequestException("Unsupported scraper task.");
    if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) throw new BadRequestException("Invalid scraper state.");
    const state = rawState as Record<string, unknown>;
    const page = state.page === undefined ? 1 : Number(state.page);
    const offset = state.offset === undefined ? 0 : Number(state.offset);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || ![0, 10].includes(offset)) throw new BadRequestException("Invalid scraper state.");
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException("TMDB_API_KEY is not configured.");

    let logId = typeof state.logId === "string" ? state.logId : undefined;
    if (logId) {
      const [log] = await db.select().from(scraperLogs).where(eq(scraperLogs.id, logId)).limit(1);
      if (!log || log.status !== "running" || log.taskName !== task) throw new ConflictException("Scraper task cannot be resumed.");
    } else {
      const [active] = await db.select({ id: scraperLogs.id }).from(scraperLogs).where(eq(scraperLogs.status, "running")).limit(1);
      if (active) throw new ConflictException("Another scraper task is already running.");
      logId = crypto.randomUUID();
      await db.insert(scraperLogs).values({ id: logId, taskName: task, status: "running", itemsCount: 0, summary: {}, createdAt: new Date(), progress: { current: 0, total: 0, current_item: "Starting", _lastUpdated: new Date().toISOString() } });
    }

    const [configRow] = await db.select().from(settings).where(eq(settings.key, "scraper_config")).limit(1);
    const config = configRow?.value && typeof configRow.value === "object" ? configRow.value as Record<string, unknown> : {};
    if (task === "subtitles") return this.saveCheckpoint(logId, await this.runSubtitleSync(state, logId));
    if (task === "tv_sync") return this.saveCheckpoint(logId, await this.runTvSync(state, logId, apiKey));
    if (["sync", "validate", "reclassify"].includes(task)) return this.saveCheckpoint(logId, await this.runMaintenance(task, state, logId, apiKey));
    const isTvNetworkTask = task.startsWith("network_tv_");
    const isNetworkTask = task.startsWith("network_");
    const networkName = isTvNetworkTask ? task.slice("network_tv_".length) : isNetworkTask ? task.slice("network_".length) : undefined;
    const url = new URL(`https://api.themoviedb.org/3/${task === "trending" ? "trending/movie/week" : isNetworkTask ? `discover/${isTvNetworkTask ? "tv" : "movie"}` : "movie/now_playing"}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", "id-ID");
    url.searchParams.set("page", String(page));
    if (networkName) {
      url.searchParams.set("with_watch_providers", String(NETWORK_PROVIDER_IDS[networkName]));
      url.searchParams.set("watch_region", "ID");
      url.searchParams.set("sort_by", "popularity.desc");
    }
    let result: { results?: Record<string, any>[]; total_pages?: number };
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`TMDB request failed (${response.status}).`);
      result = await response.json() as { results?: Record<string, any>[]; total_pages?: number };
    } catch (error) {
      await db.update(scraperLogs).set({ status: "failed", errorMessage: error instanceof Error ? error.message : "TMDB request failed", finishedAt: new Date() }).where(and(eq(scraperLogs.id, logId), eq(scraperLogs.status, "running")));
      throw error;
    }
    const items = result.results ?? [];
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const batchItems = items.slice(offset, offset + 10);
    for (const item of batchItems) {
      const rating = Number(item.vote_average ?? 0);
      const voteCount = Number(item.vote_count ?? 0);
      if (!Number.isFinite(rating) || rating < MIN_DISCOVERY_RATING || !Number.isFinite(voteCount) || voteCount < MIN_DISCOVERY_VOTES) {
        skipped++;
        continue;
      }
      const mediaType = item.media_type === "tv" || item.name ? "tv" : "movie";
      const isKoreanTv = isTvNetworkTask && (item.original_language === "ko" || (item.origin_country ?? []).includes("KR"));
      const tmdbId = Number(item.id);
      const title = String(item.title ?? item.name ?? "").trim();
      if (!Number.isSafeInteger(tmdbId) || !title) continue;
      const [existing] = await db.select({ id: contents.id, overview: contents.overview, posterPath: contents.posterPath, backdropPath: contents.backdropPath, releaseDate: contents.releaseDate, platform: contents.platform, platforms: contents.platforms }).from(contents).where(eq(contents.tmdbId, tmdbId)).limit(1);
      if (existing) {
        const platform = networkName;
        const platforms = [...new Set([...(existing.platforms ?? []).filter((name) => name !== "other"), ...(platform ? [platform] : [])])];
        await db.update(contents).set({
          overview: existing.overview || item.overview || null,
          posterPath: existing.posterPath || item.poster_path || null,
          backdropPath: existing.backdropPath || item.backdrop_path || null,
          releaseDate: existing.releaseDate || item.release_date || item.first_air_date || null,
          voteAverage: item.vote_average == null ? undefined : String(item.vote_average),
          popularity: item.popularity == null ? undefined : String(item.popularity),
          ...(isKoreanTv ? { type: "drakor" } : {}),
          ...(platform ? { platforms } : {}),
          ...(platform && (!existing.platform || existing.platform === "other") ? { platform } : {}),
          updatedAt: new Date(),
        }).where(eq(contents.id, existing.id));
        updated++;
        continue;
      }
      const autoApprove = config.auto_approve === true;
      const inserted = await db.insert(contents).values({
        tmdbId, title, type: isKoreanTv ? "drakor" : isTvNetworkTask ? "tv" : mediaType, status: autoApprove ? "approved" : "pending",
        overview: item.overview ?? null, posterPath: item.poster_path ?? null, backdropPath: item.backdrop_path ?? null,
        releaseDate: item.release_date ?? item.first_air_date ?? null,
        voteAverage: item.vote_average == null ? null : String(item.vote_average),
        popularity: item.popularity == null ? null : String(item.popularity),
        platform: networkName ?? null,
        platforms: networkName ? [networkName] : [],
        createdAt: new Date(), updatedAt: new Date(),
      }).onConflictDoNothing().returning({ id: contents.id });
      if (inserted.length) added++;
    }
    const hasMore = offset + 10 < items.length || page < Math.min(result.total_pages ?? page, 500);
    const nextPage = offset + 10 < items.length ? page : page + 1;
    const nextOffset = offset + 10 < items.length ? offset + 10 : 0;
    const accumulatedProcessed = Number(state.accumulatedProcessed ?? 0) + batchItems.length;
    const accumulatedAdded = Number(state.accumulatedAdded ?? 0) + added;
    const nextState = hasMore ? { page: nextPage, offset: nextOffset, logId, accumulatedProcessed, accumulatedAdded } : {};
    await db.update(scraperLogs).set({
      itemsCount: accumulatedProcessed,
      summary: { items_processed: accumulatedProcessed, items_added: accumulatedAdded + added, items_updated: updated, items_skipped: Number(state.accumulatedSkipped ?? 0) + skipped, items_failed: 0, errors: [] },
      progress: { current: accumulatedProcessed, total: (result.total_pages ?? page) * items.length, current_item: batchItems.at(-1)?.title ?? batchItems.at(-1)?.name ?? "TMDB discovery", _lastUpdated: new Date().toISOString() },
      ...(hasMore ? {} : { status: "success", finishedAt: new Date() }),
    }).where(and(eq(scraperLogs.id, logId), eq(scraperLogs.status, "running")));
    return this.saveCheckpoint(logId, { success: true, summary: { items_processed: batchItems.length, items_added: added, items_updated: updated, items_skipped: skipped, items_failed: 0, errors: [] }, hasMore, nextState: hasMore ? { ...nextState, accumulatedSkipped: Number(state.accumulatedSkipped ?? 0) + skipped } : nextState, logId });
  }
}
