import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, Headers, Inject, NotFoundException, Param, Patch, Post, Put, Query, Res, UnauthorizedException } from "@nestjs/common";
import { access, readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { and, arrayContains, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "./db/database";
import { auditLogs, contents, embedLinks, episodes, profiles, reports, scraperLogs, seasons, settings, user, watchHistory, watchlist } from "./db/schema";
import { auth } from "./auth/auth";
import { ScraperService } from "./scraper/scraper.service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_SETTING_KEY = /(secret|password|token|api[_-]?key)/i;
const EDITABLE_SETTING_KEYS = new Set(["site_config", "scraper_config"]);

function mapSettingSecrets(value: unknown, transform: (key: string, value: unknown) => unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => mapSettingSecrets(item, transform));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, PRIVATE_SETTING_KEY.test(key) ? transform(key, child) : mapSettingSecrets(child, transform)]));
}

function redactSettingSecrets(value: unknown): unknown {
  return mapSettingSecrets(value, () => "[hidden]");
}

function preserveSettingSecrets(current: unknown, proposed: unknown): unknown {
  if (Array.isArray(current) || !current || typeof current !== "object" || Array.isArray(proposed) || !proposed || typeof proposed !== "object") return proposed;
  const result = { ...(proposed as Record<string, unknown>) };
  for (const [key, value] of Object.entries(current)) {
    if (PRIVATE_SETTING_KEY.test(key)) result[key] = value;
    else if (key in result) result[key] = preserveSettingSecrets(value, result[key]);
  }
  return result;
}

async function subtitleStorageRoot() {
  const candidates = [
    path.resolve(__dirname, "../storage/subtitles"),
    path.resolve(__dirname, "../../storage/subtitles"),
    path.resolve(__dirname, "../../../storage/subtitles"),
  ];
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* Try the source or compiled layout. */ }
  }
  throw new NotFoundException("Subtitle storage is unavailable.");
}

function safeDrivePreview(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || url.username || url.password || url.port) return null;
    const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,200})(?:\/(?:view|preview))?\/?$/);
    const fileId = match?.[1] ?? (["/open", "/uc"].includes(url.pathname) ? url.searchParams.get("id") : null);
    if (!fileId || !/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return null;
    const preview = new URL(`https://drive.google.com/file/d/${fileId}/preview`);
    const resourceKey = url.searchParams.get("resourcekey");
    if (resourceKey && /^[A-Za-z0-9_-]{1,200}$/.test(resourceKey)) preview.searchParams.set("resourcekey", resourceKey);
    return preview.toString();
  } catch {
    return null;
  }
}

function makeEmbedUrl(provider: "MoviesAPI" | "SuperEmbed" | "VidAPI.xyz", tmdbId: number, mediaType: "movie" | "tv", season: number, episode: number) {
  if (provider === "MoviesAPI") return mediaType === "movie"
    ? `https://moviesapi.to/movie/${tmdbId}`
    : `https://moviesapi.to/tv/${tmdbId}-${season}-${episode}`;
  if (provider === "SuperEmbed") {
    const url = new URL("https://multiembed.mov/");
    url.searchParams.set("video_id", String(tmdbId));
    url.searchParams.set("tmdb", "1");
    if (mediaType === "tv") {
      url.searchParams.set("s", String(season));
      url.searchParams.set("e", String(episode));
    }
    return url.toString();
  }
  return mediaType === "movie"
    ? `https://vidapi.xyz/embed/movie/${tmdbId}`
    : `https://vidapi.xyz/embed/tv/${tmdbId}/${season}/${episode}`;
}

async function fetchMetadata(tmdbId: number, mediaType: "movie" | "tv") {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  try {
    const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("append_to_response", "credits,videos");
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return await response.json() as Record<string, any>;
  } catch {
    return null;
  }
}

@Controller()
export class AppController {
  constructor(@Inject(ScraperService) private readonly scraper: ScraperService) {}

  private async requireSession(cookie?: string) {
    const session = await auth.api.getSession({ headers: new globalThis.Headers(cookie ? { cookie } : {}) });
    if (!session) throw new UnauthorizedException("Sign in is required.");
    return session;
  }

  private async requireAdmin(cookie?: string) {
    const session = await this.requireSession(cookie);
    if (!session.user.role || !["admin", "moderator", "super_admin"].includes(session.user.role)) throw new ForbiddenException("Administrator access is required.");
    return session;
  }

  @Get("site-config")
  async publicSiteConfig(@Headers("cookie") cookie?: string) {
    const [row] = await db.select().from(settings).where(eq(settings.key, "site_config")).limit(1);
    const value = row?.value && typeof row.value === "object" ? row.value as Record<string, unknown> : {};
    const session = await auth.api.getSession({ headers: new globalThis.Headers(cookie ? { cookie } : {}) });
    return {
      title: typeof value.title === "string" ? value.title.slice(0, 80) : "NETIX",
      primaryColor: typeof value.primary_color === "string" && /^#[0-9a-f]{6}$/i.test(value.primary_color) ? value.primary_color : "#eab308",
      navbarColor: typeof value.navbar_color === "string" && /^#[0-9a-f]{6}$/i.test(value.navbar_color) ? value.navbar_color : "#38bdf8",
      maintenanceMode: value.maintenance_mode === true,
      allowRegistrations: value.allow_registrations !== false,
      isSuperAdmin: session?.user.role === "super_admin",
    };
  }

  private async requireSuperAdmin(cookie?: string) {
    const session = await this.requireAdmin(cookie);
    if (session.user.role !== "super_admin") throw new ForbiddenException("Super administrator access is required.");
    return session;
  }

  @Get("admin/scraper/logs")
  async scraperLogsList(@Headers("cookie") cookie?: string) {
    await this.requireAdmin(cookie);
    return await this.scraper.logs();
  }

  @Get("admin/scraper/recovery")
  async scraperRecovery(@Headers("cookie") cookie?: string) {
    await this.requireAdmin(cookie);
    return await this.scraper.recoverable();
  }

  @Get("admin/scraper/health")
  async scraperHealth(@Headers("cookie") cookie?: string) {
    await this.requireAdmin(cookie);
    return await this.scraper.health();
  }

  @Get("cron/scraper")
  async scheduledScraper(@Headers("authorization") authorization?: string, @Query("task") requestedTask = "scrape") {
    const secret = process.env.SCRAPER_SECRET ?? "";
    const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const expectedBytes = Buffer.from(secret);
    const suppliedBytes = Buffer.from(supplied);
    if (!secret || expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
      throw new UnauthorizedException("Invalid scraper schedule credentials.");
    }

    if (!new Set(["scrape", "trending"]).has(requestedTask)) throw new BadRequestException("Unsupported scheduled scraper task.");
    const recovery = await this.scraper.recoverable();
    if (recovery.task && recovery.task !== requestedTask) throw new ConflictException("Another scraper task is running.");
    return this.scraper.run(requestedTask, recovery.task ? recovery.state : {});
  }

  @Post("admin/scraper/run")
  async runScraper(@Headers("cookie") cookie: string | undefined, @Body() body: { task?: unknown; state?: unknown }) {
    await this.requireAdmin(cookie);
    if (!body || typeof body !== "object" || typeof body.task !== "string") throw new BadRequestException("A scraper task is required.");
    return await this.scraper.run(body.task, body.state ?? {});
  }

  @Post("admin/scraper/stop")
  async stopScraper(@Headers("cookie") cookie?: string) {
    await this.requireAdmin(cookie);
    return await this.scraper.stop();
  }

  @Get("admin/overview")
  async adminOverview(@Headers("cookie") cookie?: string) {
    await this.requireAdmin(cookie);
    const [contentsCount, pendingCount, userCount, todayHistory, missingPosterCount, missingOverviewCount, recentLogs] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(contents),
      db.select({ count: sql<number>`count(*)::int` }).from(contents).where(eq(contents.status, "pending")),
      db.select({ count: sql<number>`count(*)::int` }).from(user),
      db.select({ count: sql<number>`count(*)::int` }).from(watchHistory).where(sql`${watchHistory.updatedAt} >= current_date`),
      db.select({ count: sql<number>`count(*)::int` }).from(contents).where(or(isNull(contents.posterPath), eq(contents.posterPath, ""))),
      db.select({ count: sql<number>`count(*)::int` }).from(contents).where(or(isNull(contents.overview), eq(contents.overview, ""))),
      db.select({ id: scraperLogs.id, taskName: scraperLogs.taskName, status: scraperLogs.status, itemsCount: scraperLogs.itemsCount, summary: scraperLogs.summary, errorMessage: scraperLogs.errorMessage, createdAt: scraperLogs.createdAt, finishedAt: scraperLogs.finishedAt, progress: scraperLogs.progress }).from(scraperLogs).orderBy(desc(scraperLogs.createdAt)).limit(8),
    ]);
    return { contents: contentsCount[0].count, pending: pendingCount[0].count, users: userCount[0].count, todayViews: todayHistory[0].count, missingPosters: missingPosterCount[0].count, missingOverviews: missingOverviewCount[0].count, recentLogs };
  }

  @Get("admin/catalog")
  async adminCatalog(
    @Headers("cookie") cookie: string | undefined,
    @Query("status") status = "pending",
    @Query("limit") rawLimit?: string,
    @Query("page") rawPage?: string,
    @Query("q") search?: string,
    @Query("type") type?: string,
    @Query("platform") platform?: string,
    @Query("missing") missing?: string,
  ) {
    await this.requireAdmin(cookie);
    if (!["pending", "approved", "rejected", "all"].includes(status)) throw new BadRequestException("Invalid catalog status.");
    if (type && !["movie", "tv"].includes(type)) throw new BadRequestException("Invalid content type.");
    if (missing && !["poster", "overview"].includes(missing)) throw new BadRequestException("Invalid missing metadata filter.");
    const limit = Number.isSafeInteger(Number(rawLimit)) && Number(rawLimit) > 0 ? Math.min(Number(rawLimit), 100) : 20;
    const page = Number.isSafeInteger(Number(rawPage)) && Number(rawPage) > 0 ? Math.min(Number(rawPage), 10000) : 1;
    const filters = [];
    if (status !== "all") filters.push(eq(contents.status, status));
    if (type === "tv") filters.push(inArray(contents.type, ["tv", "drakor", "korea", "drachin", "drathai", "drajep", "variety", "donghua"]));
    else if (type) filters.push(eq(contents.type, type));
    if (platform === "unassigned") filters.push(isNull(contents.platform));
    else if (platform) filters.push(arrayContains(contents.platforms, [platform]));
    if (missing === "poster") filters.push(or(isNull(contents.posterPath), eq(contents.posterPath, ""))!);
    if (missing === "overview") filters.push(or(isNull(contents.overview), eq(contents.overview, ""))!);
    if (search?.trim()) filters.push(ilike(contents.title, `%${search.trim().slice(0, 100)}%`));
    const where = filters.length ? and(...filters) : undefined;
    const [items, count] = await Promise.all([
      db.select().from(contents).where(where).orderBy(desc(contents.createdAt)).limit(limit).offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)::int` }).from(contents).where(where),
    ]);
    return { items, total: count[0].count, page, limit };
  }

  @Get("admin/platforms")
  async adminPlatforms(@Headers("cookie") cookie?: string) {
    await this.requireAdmin(cookie);
    return { items: await db.select({ platform: contents.platform, count: sql<number>`count(*)::int` }).from(contents).groupBy(contents.platform).orderBy(asc(contents.platform)) };
  }

  @Patch("admin/catalog/:id")
  async updateCatalogItem(@Headers("cookie") cookie: string | undefined, @Param("id") id: string, @Body() body: { title?: unknown; overview?: unknown; platform?: unknown; quality?: unknown }) {
    const session = await this.requireAdmin(cookie);
    if (!UUID_PATTERN.test(id)) throw new BadRequestException("Invalid content ID.");
    const values: Partial<typeof contents.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) throw new BadRequestException("Title cannot be empty.");
      values.title = body.title.trim().slice(0, 300);
    }
    if (body.overview !== undefined) values.overview = typeof body.overview === "string" ? body.overview.slice(0, 10000) : null;
    if (body.platform !== undefined) {
      const platforms = ["netflix", "disney", "amazon", "apple", "hbo", "paramount", "anime", "other"];
      if (body.platform !== null && !platforms.includes(String(body.platform))) throw new BadRequestException("Invalid platform.");
      values.platform = body.platform === null ? null : String(body.platform);
      values.platforms = body.platform === null ? [] : [String(body.platform)];
    }
    if (body.quality !== undefined) values.quality = typeof body.quality === "string" ? body.quality.slice(0, 30) : null;
    const [updated] = await db.update(contents).set(values).where(eq(contents.id, id)).returning({ id: contents.id });
    if (!updated) throw new NotFoundException("Content not found.");
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: "catalog.update", targetId: id, targetType: "contents", details: { fields: Object.keys(body) }, createdAt: new Date() });
    return { ok: true };
  }

  @Get("admin/catalog/:id/drive")
  async getDriveVideo(@Headers("cookie") cookie: string | undefined, @Param("id") id: string) {
    await this.requireAdmin(cookie);
    if (!UUID_PATTERN.test(id)) throw new BadRequestException("Invalid content ID.");
    const [content] = await db.select({ id: contents.id, title: contents.title, type: contents.type }).from(contents).where(eq(contents.id, id)).limit(1);
    if (!content) throw new NotFoundException("Content not found.");
    if (content.type !== "movie") throw new BadRequestException("Google Drive links are supported for movies only.");
    const links = await db.select().from(embedLinks).where(and(eq(embedLinks.contentId, id), eq(embedLinks.provider, "Google Drive"))).limit(2);
    return { content, url: links.length === 1 ? links[0].url : "", duplicateLinks: links.length > 1 };
  }

  @Put("admin/catalog/:id/drive")
  async saveDriveVideo(@Headers("cookie") cookie: string | undefined, @Param("id") id: string, @Body() body: { url?: unknown; rightsConfirmed?: unknown }) {
    const session = await this.requireAdmin(cookie);
    if (!UUID_PATTERN.test(id)) throw new BadRequestException("Invalid content ID.");
    if (body.rightsConfirmed !== true || typeof body.url !== "string" || body.url.length > 2048) throw new BadRequestException("Confirm rights and provide a valid Drive file link.");
    const input = body.url.trim();
    const normalizedInput = /^[A-Za-z0-9_-]{10,200}$/.test(input) ? `https://drive.google.com/file/d/${input}/preview` : input;
    const url = safeDrivePreview(normalizedInput);
    if (!url) throw new BadRequestException("Use a valid HTTPS Google Drive file link.");
    const [content] = await db.select({ id: contents.id, type: contents.type }).from(contents).where(eq(contents.id, id)).limit(1);
    if (!content) throw new NotFoundException("Content not found.");
    if (content.type !== "movie") throw new BadRequestException("Google Drive links are supported for movies only.");
    const links = await db.select({ id: embedLinks.id }).from(embedLinks).where(and(eq(embedLinks.contentId, id), eq(embedLinks.provider, "Google Drive"))).limit(2);
    if (links.length > 1) throw new ConflictException("Duplicate Drive links exist; remove them before saving a replacement.");
    if (links.length) await db.update(embedLinks).set({ url }).where(eq(embedLinks.id, links[0].id));
    else await db.insert(embedLinks).values({ id: crypto.randomUUID(), contentId: id, provider: "Google Drive", url, quality: "HD", language: "Original", createdAt: new Date() });
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: "SAVE_DRIVE_VIDEO", targetId: id, targetType: "contents", createdAt: new Date() });
    return { ok: true };
  }

  @Delete("admin/catalog/:id/drive")
  async removeDriveVideo(@Headers("cookie") cookie: string | undefined, @Param("id") id: string) {
    const session = await this.requireAdmin(cookie);
    if (!UUID_PATTERN.test(id)) throw new BadRequestException("Invalid content ID.");
    const deleted = await db.delete(embedLinks).where(and(eq(embedLinks.contentId, id), eq(embedLinks.provider, "Google Drive"))).returning({ id: embedLinks.id });
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: "REMOVE_DRIVE_VIDEO", targetId: id, targetType: "contents", details: { count: deleted.length }, createdAt: new Date() });
    return { ok: true, removed: deleted.length };
  }

  @Delete("admin/catalog/:id")
  async deleteCatalogItem(@Headers("cookie") cookie: string | undefined, @Param("id") id: string) {
    const session = await this.requireAdmin(cookie);
    if (!UUID_PATTERN.test(id)) throw new BadRequestException("Invalid content ID.");
    const [deleted] = await db.delete(contents).where(eq(contents.id, id)).returning({ id: contents.id, title: contents.title });
    if (!deleted) throw new NotFoundException("Content not found.");
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: "DELETE_CONTENT", targetId: id, targetType: "contents", details: { title: deleted.title }, createdAt: new Date() });
    return { ok: true };
  }

  @Post("admin/catalog/bulk-delete")
  async bulkDeleteCatalog(@Headers("cookie") cookie: string | undefined, @Body() body: { ids?: unknown }) {
    const session = await this.requireAdmin(cookie);
    if (!Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 100 || body.ids.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) throw new BadRequestException("Provide 1–100 valid content IDs.");
    const deleted = await db.delete(contents).where(sql`${contents.id} = ANY(${body.ids}::uuid[])`).returning({ id: contents.id });
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: "BULK_DELETE_CONTENT", targetId: (body.ids as string[]).join(","), targetType: "contents", details: { count: deleted.length }, createdAt: new Date() });
    return { ok: true, deleted: deleted.length };
  }

  @Post("admin/catalog/approve-pending")
  async approvePendingCatalog(@Headers("cookie") cookie?: string) {
    const session = await this.requireAdmin(cookie);
    const updated = await db.update(contents).set({ status: "approved", updatedAt: new Date() }).where(eq(contents.status, "pending")).returning({ id: contents.id });
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: "Approved all pending content", targetId: "bulk-approve", targetType: "contents", details: { count: updated.length }, createdAt: new Date() });
    return { ok: true, approved: updated.length };
  }

  @Patch("admin/catalog/:id/metadata")
  async updateCatalogMetadata(@Headers("cookie") cookie: string | undefined, @Param("id") id: string, @Body() body: { title?: unknown; castData?: unknown }) {
    const session = await this.requireAdmin(cookie);
    if (!UUID_PATTERN.test(id)) throw new BadRequestException("Invalid content ID.");
    const values: Partial<typeof contents.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) throw new BadRequestException("Title cannot be empty.");
      values.title = body.title.trim().slice(0, 300);
    }
    if (body.castData !== undefined) {
      if (!Array.isArray(body.castData) || body.castData.length > 50 || body.castData.some((person) => !person || typeof person !== "object" || typeof person.name !== "string")) throw new BadRequestException("Cast must be an array of named people.");
      values.castData = body.castData;
    }
    const [updated] = await db.update(contents).set(values).where(eq(contents.id, id)).returning({ id: contents.id });
    if (!updated) throw new NotFoundException("Content not found.");
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: "UPDATE_CONTENT_METADATA", targetId: id, targetType: "contents", details: { title: body.title }, createdAt: new Date() });
    return { ok: true };
  }

  @Patch("admin/catalog/:id/status")
  async setCatalogStatus(@Headers("cookie") cookie: string | undefined, @Param("id") id: string, @Body() body: { status?: unknown; reason?: unknown }) {
    const session = await this.requireAdmin(cookie);
    if (!UUID_PATTERN.test(id) || !["pending", "approved", "rejected"].includes(String(body.status))) throw new BadRequestException("Invalid catalog status update.");
    if (body.status === "rejected" && (typeof body.reason !== "string" || body.reason.trim().length < 3)) throw new BadRequestException("A rejection reason of at least 3 characters is required.");
    const [updated] = await db.update(contents).set({ status: String(body.status), updatedAt: new Date() }).where(eq(contents.id, id)).returning({ id: contents.id });
    if (!updated) throw new NotFoundException("Content not found.");
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : undefined;
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: `catalog.${String(body.status)}`, targetId: id, targetType: "contents", details: reason ? { reason } : undefined, createdAt: new Date() });
    return { ok: true };
  }

  @Get("admin/reports")
  async adminReports(@Headers("cookie") cookie?: string) {
    await this.requireAdmin(cookie);
    const rows = await db.select({ report: reports, contentTitle: contents.title, tmdbId: contents.tmdbId, contentType: contents.type })
      .from(reports).leftJoin(contents, eq(reports.contentId, contents.id)).orderBy(desc(reports.createdAt)).limit(100);
    return { items: rows.map(({ report, ...content }) => ({ ...report, ...content })) };
  }

  @Patch("admin/reports/:id")
  async setReportStatus(@Headers("cookie") cookie: string | undefined, @Param("id") id: string, @Body() body: { status?: unknown }) {
    const session = await this.requireAdmin(cookie);
    if (!UUID_PATTERN.test(id) || !["pending", "resolved", "dismissed"].includes(String(body.status))) throw new BadRequestException("Invalid report update.");
    const [updated] = await db.update(reports).set({ status: String(body.status) }).where(eq(reports.id, id)).returning({ id: reports.id });
    if (!updated) throw new NotFoundException("Report not found.");
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: `report.${String(body.status)}`, targetId: id, targetType: "reports", createdAt: new Date() });
    return { ok: true };
  }

  @Get("admin/audit")
  async adminAudit(@Headers("cookie") cookie?: string) {
    await this.requireAdmin(cookie);
    return { items: await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100) };
  }

  @Get("admin/settings")
  async adminSettings(@Headers("cookie") cookie?: string) {
    await this.requireSuperAdmin(cookie);
    const rows = await db.select().from(settings).where(inArray(settings.key, [...EDITABLE_SETTING_KEYS])).orderBy(asc(settings.key));
    return { items: rows.map((row) => ({ ...row, value: redactSettingSecrets(row.value) })) };
  }

  @Patch("admin/settings/:key")
  async updateAdminSetting(@Headers("cookie") cookie: string | undefined, @Param("key") key: string, @Body() body: { value?: unknown }) {
    const session = await this.requireSuperAdmin(cookie);
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) throw new BadRequestException("Invalid setting key.");
    if (!EDITABLE_SETTING_KEYS.has(key) || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) throw new BadRequestException("This setting cannot be edited here.");
    const [existing] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    const value = existing ? preserveSettingSecrets(existing.value, body.value) : body.value;
    await db.insert(settings).values({ key, value, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: "settings.update", targetId: key, targetType: "settings", createdAt: new Date() });
    return { ok: true };
  }

  @Get("admin/users")
  async adminUsers(@Headers("cookie") cookie?: string, @Query("q") search = "", @Query("page") rawPage?: string, @Query("limit") rawLimit?: string) {
    const session = await this.requireAdmin(cookie);
    const page = Number.isSafeInteger(Number(rawPage)) && Number(rawPage) > 0 ? Math.min(Number(rawPage), 10000) : 1;
    const limit = Number.isSafeInteger(Number(rawLimit)) && Number(rawLimit) > 0 ? Math.min(Number(rawLimit), 100) : 25;
    const term = search.trim().slice(0, 100);
    const where = term ? or(ilike(user.name, `%${term}%`), ilike(user.email, `%${term}%`)) : undefined;
    const [users, count] = await Promise.all([
      db.select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }).from(user).where(where).orderBy(asc(user.createdAt)).limit(limit).offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)::int` }).from(user).where(where),
    ]);
    return { items: users, total: count[0].count, page, limit, canManage: session.user.role === "super_admin", currentUserId: session.user.id };
  }

  @Patch("admin/users/:id/role")
  async updateUserRole(@Headers("cookie") cookie: string | undefined, @Param("id") id: string, @Body() body: { role?: unknown }) {
    const session = await this.requireSuperAdmin(cookie);
    if (id === session.user.id) throw new ForbiddenException("You cannot change your own administrator role.");
    if (!UUID_PATTERN.test(id) || !["moderator", "user", "super_admin"].includes(String(body.role))) throw new BadRequestException("Invalid user role.");
    const [target] = await db.select({ role: user.role }).from(user).where(eq(user.id, id)).limit(1);
    if (!target) throw new NotFoundException("User not found.");
    if (target.role === "super_admin" && session.user.role !== "super_admin") throw new ForbiddenException("Only a super administrator can change a super administrator.");
    const [updated] = await db.update(user).set({ role: String(body.role), updatedAt: new Date() }).where(eq(user.id, id)).returning({ id: user.id });
    if (!updated) throw new NotFoundException("User not found.");
    await db.update(profiles).set({ role: String(body.role), updatedAt: new Date() }).where(eq(profiles.id, id));
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: `user.role.${String(body.role)}`, targetId: id, targetType: "user", createdAt: new Date() });
    return { ok: true };
  }

  @Delete("admin/users/:id")
  async deleteAdminManagedUser(@Headers("cookie") cookie: string | undefined, @Param("id") id: string) {
    const session = await this.requireSuperAdmin(cookie);
    if (!UUID_PATTERN.test(id) || id === session.user.id) throw new BadRequestException("Invalid user ID.");
    const [target] = await db.select({ role: user.role, email: user.email }).from(user).where(eq(user.id, id)).limit(1);
    if (!target) throw new NotFoundException("User not found.");
    if (target.role === "super_admin") throw new ForbiddenException("Super administrator accounts cannot be deleted here.");
    await db.delete(user).where(eq(user.id, id));
    await db.delete(profiles).where(eq(profiles.id, id));
    await db.insert(auditLogs).values({ id: crypto.randomUUID(), userId: session.user.id, action: "DELETE_USER", targetId: id, targetType: "user", details: { email: target.email }, createdAt: new Date() });
    return { ok: true };
  }

  @Get("profile")
  async getProfile(@Headers("cookie") cookie?: string) {
    const session = await this.requireSession(cookie);
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, session.user.id)).limit(1);
    const [saved] = await db.select({ count: sql<number>`count(*)::int` }).from(watchlist).where(eq(watchlist.userId, session.user.id));
    const [watched] = await db.select({ count: sql<number>`count(*)::int` }).from(watchHistory).where(eq(watchHistory.userId, session.user.id));
    return { user: session.user, profile, watchlistCount: saved.count, historyCount: watched.count };
  }

  @Patch("profile")
  async updateProfile(@Headers("cookie") cookie: string | undefined, @Body() body: { name?: unknown; preferences?: unknown }) {
    const session = await this.requireSession(cookie);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : session.user.name;
    if (!name) throw new BadRequestException("Name cannot be empty.");
    await db.update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, session.user.id));
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, session.user.id)).limit(1);
    const preferences = body.preferences && typeof body.preferences === "object" && !Array.isArray(body.preferences) ? body.preferences : profile?.preferences ?? {};
    await db.insert(profiles).values({
      id: session.user.id,
      fullName: name,
      role: profile?.role ?? "user",
      preferences,
      updatedAt: new Date(),
    }).onConflictDoUpdate({ target: profiles.id, set: { fullName: name, preferences, updatedAt: new Date() } });
    return { ok: true };
  }

  @Get("profile/watchlist")
  async getWatchlist(@Headers("cookie") cookie?: string) {
    const session = await this.requireSession(cookie);
    const rows = await db.select({ content: contents, createdAt: watchlist.createdAt })
      .from(watchlist).innerJoin(contents, eq(watchlist.contentId, contents.id))
      .where(eq(watchlist.userId, session.user.id)).orderBy(desc(watchlist.createdAt));
    return { items: rows.map((row) => ({ ...row.content, addedAt: row.createdAt })) };
  }

  @Post("profile/watchlist")
  async addToWatchlist(@Headers("cookie") cookie: string | undefined, @Body() body: { contentId?: unknown }) {
    const session = await this.requireSession(cookie);
    if (typeof body.contentId !== "string" || !UUID_PATTERN.test(body.contentId)) throw new BadRequestException("Invalid content ID.");
    const [content] = await db.select({ id: contents.id }).from(contents).where(and(eq(contents.id, body.contentId), eq(contents.status, "approved"))).limit(1);
    if (!content) throw new NotFoundException("Content not found.");
    const [existing] = await db.select({ id: watchlist.id }).from(watchlist).where(and(eq(watchlist.userId, session.user.id), eq(watchlist.contentId, content.id))).limit(1);
    if (!existing) await db.insert(watchlist).values({ id: crypto.randomUUID(), userId: session.user.id, contentId: content.id, createdAt: new Date() });
    return { ok: true };
  }

  @Delete("profile/watchlist/:contentId")
  async removeFromWatchlist(@Headers("cookie") cookie: string | undefined, @Param("contentId") contentId: string) {
    const session = await this.requireSession(cookie);
    if (!UUID_PATTERN.test(contentId)) throw new BadRequestException("Invalid content ID.");
    await db.delete(watchlist).where(and(eq(watchlist.userId, session.user.id), eq(watchlist.contentId, contentId)));
    return { ok: true };
  }

  @Get("profile/history")
  async getWatchHistory(@Headers("cookie") cookie?: string) {
    const session = await this.requireSession(cookie);
    const rows = await db.select({ content: contents, progressTime: watchHistory.progressTime, duration: watchHistory.duration, updatedAt: watchHistory.updatedAt })
      .from(watchHistory).innerJoin(contents, eq(watchHistory.contentId, contents.id))
      .where(eq(watchHistory.userId, session.user.id)).orderBy(desc(watchHistory.updatedAt));
    return { items: rows.map((row) => ({ ...row.content, progressTime: row.progressTime, duration: row.duration, updatedAt: row.updatedAt })) };
  }

  @Get("profile/history/:contentId")
  async getContentWatchProgress(@Headers("cookie") cookie: string | undefined, @Param("contentId") contentId: string) {
    if (!UUID_PATTERN.test(contentId)) throw new BadRequestException("Invalid content ID.");
    const session = await auth.api.getSession({ headers: new globalThis.Headers(cookie ? { cookie } : {}) });
    if (!session) return { progressTime: 0, duration: 0 };
    const [progress] = await db.select({ progressTime: watchHistory.progressTime, duration: watchHistory.duration })
      .from(watchHistory)
      .where(and(eq(watchHistory.userId, session.user.id), eq(watchHistory.contentId, contentId)))
      .limit(1);
    return { progressTime: progress?.progressTime ?? 0, duration: progress?.duration ?? 0 };
  }

  @Post("profile/history")
  async saveWatchHistory(@Headers("cookie") cookie: string | undefined, @Body() body: { contentId?: unknown; progressTime?: unknown; duration?: unknown }) {
    const session = await this.requireSession(cookie);
    if (typeof body.contentId !== "string" || !UUID_PATTERN.test(body.contentId)) throw new BadRequestException("Invalid content ID.");
    const progressTime = Number(body.progressTime);
    const duration = Number(body.duration);
    if (!Number.isSafeInteger(progressTime) || progressTime < 0 || !Number.isSafeInteger(duration) || duration < 0) throw new BadRequestException("Invalid playback position.");
    const [content] = await db.select({ id: contents.id }).from(contents).where(and(eq(contents.id, body.contentId), eq(contents.status, "approved"))).limit(1);
    if (!content) throw new NotFoundException("Content not found.");
    const [existing] = await db.select({ id: watchHistory.id }).from(watchHistory).where(and(eq(watchHistory.userId, session.user.id), eq(watchHistory.contentId, body.contentId))).limit(1);
    if (existing) await db.update(watchHistory).set({ progressTime, duration, updatedAt: new Date() }).where(eq(watchHistory.id, existing.id));
    else await db.insert(watchHistory).values({ id: crypto.randomUUID(), userId: session.user.id, contentId: body.contentId, progressTime, duration, updatedAt: new Date() });
    return { ok: true };
  }

  @Delete("profile/history")
  async clearWatchHistory(@Headers("cookie") cookie?: string) {
    const session = await this.requireSession(cookie);
    await db.delete(watchHistory).where(eq(watchHistory.userId, session.user.id));
    return { ok: true };
  }

  @Get("subtitles")
  async getSubtitle(@Query("path") relativePath: string | undefined, @Res() response: { setHeader(name: string, value: string): void; send(body: Buffer): void }) {
    if (!relativePath || relativePath.includes("\\") || relativePath.includes("\0")) {
      throw new BadRequestException("A valid subtitle path is required.");
    }
    const root = await subtitleStorageRoot();
    const filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new BadRequestException("Invalid subtitle path.");
    let contents: Buffer;
    try {
      contents = await readFile(filePath);
    } catch {
      throw new NotFoundException("Subtitle not found.");
    }
    const extension = path.extname(filePath).toLowerCase();
    const contentType = extension === ".vtt" ? "text/vtt; charset=utf-8" : extension === ".srt" ? "application/x-subrip; charset=utf-8" : "application/octet-stream";
    response.setHeader("Content-Type", contentType);
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.send(contents);
  }

  @Get("subtitles/catalog")
  async listSubtitles(@Query("tmdb_id") rawTmdbId: string | undefined, @Query("type") type = "movie", @Query("season") rawSeason?: string, @Query("episode") rawEpisode?: string) {
    if (!rawTmdbId || !/^[1-9]\d{0,9}$/.test(rawTmdbId) || Number(rawTmdbId) > 2147483647 || !["movie", "tv"].includes(type)) {
      throw new BadRequestException("Invalid subtitle request.");
    }
    const tmdbId = Number(rawTmdbId);
    const season = rawSeason && /^[1-9]\d{0,9}$/.test(rawSeason) ? Number(rawSeason) : undefined;
    const episode = rawEpisode && /^[1-9]\d{0,9}$/.test(rawEpisode) ? Number(rawEpisode) : undefined;
    if (type === "tv" && (!season || !episode)) throw new BadRequestException("TV subtitles require a season and episode.");
    const [content] = await db.select({ id: contents.id }).from(contents)
      .where(and(eq(contents.tmdbId, tmdbId), eq(contents.status, "approved"), eq(contents.type, type))).limit(1);
    if (!content) throw new NotFoundException("Content not found in approved catalog.");

    const root = await subtitleStorageRoot();
    const baseNames = type === "movie"
      ? [`${tmdbId}_id.vtt`, `${tmdbId}_en.vtt`, `${tmdbId}.vtt`]
      : [`${tmdbId}/s${season}e${episode}_id.vtt`, `${tmdbId}/s${season}e${episode}_en.vtt`, `${tmdbId}/s${season}e${episode}.vtt`, `${tmdbId}_s${season}e${episode}_id.vtt`, `${tmdbId}_s${season}e${episode}_en.vtt`];
    const categoryFolders = type === "movie" ? ["movie", "anime", "drakor"] : ["tv", "anime", "drakor"];
    const candidates = categoryFolders.flatMap((category) => baseNames.map((name) => `${category}/${name}`));
    const subtitles: { language: string; label: string; url: string }[] = [];
    for (const relativePath of candidates) {
      try {
        await access(path.resolve(root, relativePath));
        const language = relativePath.match(/_(id|en)\.vtt$/)?.[1] ?? "unknown";
        if (!subtitles.some((subtitle) => subtitle.language === language)) {
          subtitles.push({ language, label: language === "id" ? "Indonesia" : language === "en" ? "English" : "Default", url: `/api/subtitles?path=${encodeURIComponent(relativePath)}` });
        }
      } catch { /* This language/episode is not in the local export. */ }
    }
    return { subtitles };
  }

  @Get("health")
  health() {
    return { status: "ok", service: "netix-api" };
  }

  @Get("contents")
  async listContents(
    @Query("q") search?: string,
    @Query("type") type?: string,
    @Query("limit") rawLimit?: string,
    @Query("page") rawPage?: string,
    @Query("platform") platform?: string,
    @Query("sort") rawSort?: string,
    @Query("genre") genre?: string,
  ) {
    const requestedLimit = Number(rawLimit);
    const requestedPage = Number(rawPage);
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 24;
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
    const filters = [eq(contents.status, "approved")];
    if (type === "tv") filters.push(inArray(contents.type, ["tv", "drakor", "korea", "drachin", "drathai", "drajep", "variety", "donghua"]));
    else if (type === "korea") filters.push(inArray(contents.type, ["korea", "drakor"]));
    else if (type) filters.push(eq(contents.type, type));
    if (platform) filters.push(arrayContains(contents.platforms, [platform]));
    if (search?.trim()) filters.push(ilike(contents.title, `%${search.trim().replace(/[%,]/g, "\\$&")}%`));
    if (genre?.trim()) filters.push(sql`exists (select 1 from jsonb_array_elements_text(coalesce(${contents.genreNames}, '[]'::jsonb)) as genre(genre_name) where genre.genre_name ilike ${genre.trim()})`);

    const where = and(...filters);
    const sort = rawSort === "release_date" || rawSort === "terbaru" ? desc(contents.releaseDate)
      : rawSort === "rating" ? desc(contents.voteAverage)
        : rawSort === "az" ? asc(contents.title)
          : desc(contents.popularity);
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(contents)
        .where(where)
        .orderBy(sort)
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ total: sql<number>`count(*)::int` }).from(contents).where(where),
    ]);
    return { items: rows, total, page, limit };
  }

  @Get("contents/:id/watch")
  async getWatchData(
    @Param("id") id: string,
    @Query("season") rawSeason?: string,
    @Query("episode") rawEpisode?: string,
  ) {
    if (!UUID_PATTERN.test(id)) throw new BadRequestException("Invalid content ID.");
    const seasonNumber = rawSeason && /^\d+$/.test(rawSeason) ? Number(rawSeason) : 1;
    const episodeNumber = rawEpisode && /^[1-9]\d*$/.test(rawEpisode) ? Number(rawEpisode) : 1;
    if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 0 || !Number.isSafeInteger(episodeNumber)) {
      throw new BadRequestException("Invalid season or episode.");
    }

    const [content] = await db.select().from(contents)
      .where(and(eq(contents.id, id), eq(contents.status, "approved"))).limit(1);
    if (!content) throw new NotFoundException("Content not found.");

    const isMovie = content.type === "movie";
    const mediaType = isMovie ? "movie" : "tv";
    const [storedLinks, availableSeasons, metadata] = await Promise.all([
      db.select().from(embedLinks).where(eq(embedLinks.contentId, id)).orderBy(asc(embedLinks.provider)),
      isMovie ? Promise.resolve([]) : db.select().from(seasons).where(eq(seasons.contentId, id)).orderBy(asc(seasons.seasonNumber)),
      fetchMetadata(content.tmdbId, mediaType),
    ]);
    const activeSeason = availableSeasons.find((season) => season.seasonNumber === seasonNumber) ?? availableSeasons[0];
    const activeSeasonNumber = activeSeason?.seasonNumber ?? seasonNumber;
    const episodeRows = activeSeason
      ? await db.select().from(episodes).where(eq(episodes.seasonId, activeSeason.id)).orderBy(asc(episodes.episodeNumber))
      : [];
    const airedEpisodes = episodeRows.filter((episode) => !episode.airDate || new Date(episode.airDate) <= new Date());

    const links: { id: string; provider: string; url: string }[] = [];
    const moviesApi = storedLinks.find((link) => link.provider.toLowerCase().includes("moviesapi"));
    if (moviesApi) links.push({ id: moviesApi.id, provider: "MoviesAPI", url: makeEmbedUrl("MoviesAPI", content.tmdbId, mediaType, activeSeasonNumber, episodeNumber) });
    if (isMovie) {
      for (const link of storedLinks.filter((stored) => stored.provider === "Google Drive")) {
        const url = safeDrivePreview(link.url);
        if (url) links.push({ id: link.id, provider: "Google Drive", url });
      }
    }
    links.push(
      { id: "superembed-tmdb", provider: "SuperEmbed", url: makeEmbedUrl("SuperEmbed", content.tmdbId, mediaType, activeSeasonNumber, episodeNumber) },
      { id: "vidapi-xyz-tmdb-embed", provider: "VidAPI.xyz", url: makeEmbedUrl("VidAPI.xyz", content.tmdbId, mediaType, activeSeasonNumber, episodeNumber) },
    );

    return {
      content,
      mediaType,
      metadata,
      links,
      seasons: availableSeasons.map((season) => ({ ...season, name: season.title ?? season.name })),
      episodes: airedEpisodes.map((episode) => ({ ...episode, name: episode.title ?? episode.name })),
      activeSeason: activeSeasonNumber,
    };
  }
}
