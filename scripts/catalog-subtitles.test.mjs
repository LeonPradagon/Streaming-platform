import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { parseOptions, runTask } from "./catalog-refresh.mjs";

function load(path, dependencies = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const context = { exports: {}, Buffer, URL, URLSearchParams, AbortController, AbortSignal, Request, setTimeout, clearTimeout, console: { log() {}, error() {}, warn() {} }, process: { env: { OPENSUBTITLES_API_KEY: "fake-os-key", SUBDL_API_KEY: "fake-subdl-key" } }, require: name => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; }, ...globals };
  runInNewContext(source, context);
  return context.exports;
}
const format = load("src/lib/subtitle-format.ts");
const videasy = load("src/lib/videasy.ts");
const srt = "1\r\n00:00:01,000 --> 00:00:03,000\r\nHalo dunia!\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\nSelamat datang.\r\n";
test("subtitle paths require safe movie/episode identities", () => {
  assert.equal(format.subtitleRequest(42, "movie").basePath, "movie/42");
  assert.equal(format.subtitleRequest(42, "tv", "2", "3").basePath, "tv/42/s2e3");
  for (const args of [["../42", "movie"], [42, "other"], [42, "tv"], [42, "tv", "1", "0"], [42, "tv", "1", "../2"]]) assert.throws(() => format.subtitleRequest(...args));
  assert.equal(format.subtitleLabel("en"), "Inggris"); assert.equal(format.subtitleLabel("unknown"), "Subtitle");
});
test("SRT converts valid cues and rejects empty, HTML and invalid timestamps", () => {
  const vtt = format.toWebVtt(`\uFEFF${srt}`);
  assert.ok(vtt.startsWith("WEBVTT\n\n")); assert.ok(vtt.includes("00:00:01.000 --> 00:00:03.000")); assert.ok(vtt.includes("Halo dunia!"));
  for (const text of ["", "<html>Forbidden</html>", "1\n00:00:03,000 --> 00:00:01,000\nwrong", "1\n00:99:01,000 --> 00:00:03,000\nwrong"]) assert.throws(() => format.toWebVtt(text));
});

function subtitleService({ files = [], osId = false, subdlId = true, badArchive = false, uploadError = null } = {}) {
  const calls = []; const uploads = []; let lists = 0;
  const storage = {
    list: async () => { lists++; return { data: files.map(name => ({ name })) }; },
    getPublicUrl: path => ({ data: { publicUrl: `https://storage.test/${path}` } }),
    upload: async (path, bytes) => { uploads.push({ path, text: bytes.toString() }); return { error: uploadError }; },
  };
  const fetch = async (input, options) => {
    const url = new URL(input); calls.push({ url, options });
    if (url.hostname === "api.opensubtitles.com" && url.pathname.endsWith("/subtitles")) return { ok: true, json: async () => ({ data: osId && url.searchParams.get("languages") === "id" ? [{ attributes: { language: "id", files: [{ file_id: 123 }] } }] : [] }) };
    if (url.hostname === "api.opensubtitles.com" && url.pathname.endsWith("/download")) return { ok: true, json: async () => ({ link: "https://vip.opensubtitles.com/download/test" }) };
    if (url.hostname === "vip.opensubtitles.com") return { ok: true, text: async () => srt };
    if (url.hostname === "api.subdl.com") {
      const language = url.searchParams.get("languages");
      return { ok: true, json: async () => ({ status: true, subtitles: subdlId && language === "ID" ? [{ language: "ID", url: "/subtitle/123-456.zip?api_key=fake", full_season: false, episode: null, episode_from: null, episode_end: 0 }] : [] }) };
    }
    if (url.hostname === "dl.subdl.com") return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
    throw new Error(`Unexpected request host: ${url.hostname}`);
  };
  class Zip {
    getEntryCount() { return 1; }
    getEntries() { return [{ entryName: "subtitle.srt", header: { size: srt.length } }]; }
    readAsText() { return badArchive ? "<html>failed</html>" : srt; }
  }
  const { SubtitleService } = load("src/services/SubtitleService.ts", { "@supabase/supabase-js": { createClient: () => ({ storage: { from: () => storage } }) }, "adm-zip": Zip, "@/lib/subtitle-format": format }, { fetch });
  return { SubtitleService, calls, uploads, lists: () => lists };
}
test("cached English does not prevent an Indonesian upgrade; legacy cache is not mislabeled", async () => {
  const state = subtitleService({ files: ["42_en.vtt"] });
  const result = await state.SubtitleService.fetchAndUploadSubtitle(42, "movie");
  assert.equal(result.language, "id"); assert.equal(state.uploads[0].path, "movie/42_id.vtt");
  const legacy = subtitleService({ files: ["42.vtt"], subdlId: false });
  assert.equal((await legacy.SubtitleService.fetchAndUploadSubtitle(42, "movie")).language, "unknown");
  assert.equal(legacy.uploads.length, 0);
});
test("explicit Indonesian cache avoids downloads and duplicate concurrent requests coalesce", async () => {
  const cache = subtitleService({ files: ["42_id.vtt", "42_en.vtt"] });
  const result = await cache.SubtitleService.fetchAndUploadSubtitle(42, "movie");
  assert.equal(result.status, "skipped"); assert.equal(result.language, "id"); assert.equal(cache.calls.length, 0);
  const live = subtitleService({ osId: true });
  const both = await Promise.all([live.SubtitleService.fetchAndUploadSubtitle(42, "movie"), live.SubtitleService.fetchAndUploadSubtitle(42, "movie")]);
  assert.equal(both[0].language, "id"); assert.equal(live.uploads.length, 1); assert.equal(live.lists(), 1);
  assert.equal((await live.SubtitleService.fetchAndUploadSubtitle(42, "movie")).status, "skipped"); assert.equal(live.lists(), 1);
});
test("TV subtitle search uses show ID plus exact season/episode and episode-specific storage", async () => {
  const state = subtitleService({ osId: true });
  const result = await state.SubtitleService.fetchAndUploadSubtitle(42, "tv", "2", "3");
  assert.equal(result.language, "id");
  const search = state.calls[0].url;
  assert.equal(search.searchParams.get("parent_tmdb_id"), "42"); assert.equal(search.searchParams.get("tmdb_id"), null);
  assert.equal(search.searchParams.get("season_number"), "2"); assert.equal(search.searchParams.get("episode_number"), "3");
  assert.equal(state.uploads[0].path, "tv/42/s2e3_id.vtt");
});
test("invalid requests, unusable archives and upload failures never become available subtitles", async () => {
  const invalid = subtitleService();
  assert.equal((await invalid.SubtitleService.fetchAndUploadSubtitle(42, "tv")).status, "error"); assert.equal(invalid.lists(), 0);
  const bad = subtitleService({ badArchive: true });
  assert.equal((await bad.SubtitleService.fetchAndUploadSubtitle(42, "movie")).status, "error"); assert.equal(bad.uploads.length, 0);
  const failed = subtitleService({ uploadError: { message: "denied" } });
  assert.equal((await failed.SubtitleService.fetchAndUploadSubtitle(42, "movie")).status, "error");
});

function access({ user = null, role = "viewer", secret } = {}) {
  const client = { auth: { getUser: async () => ({ data: { user } }) }, from: table => ({ select: () => ({ eq: () => ({ single: async () => ({ data: table === "settings" ? { value: { scraper_secret: secret } } : { role } }) }) }) }) };
  return load("src/lib/maintenance-access.ts", { "node:crypto": awaitCrypto, "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status }) } }, "@/lib/supabase/server": { createClient: async () => client } }, { process: { env: {} } }).maintenanceAccess;
}
import * as awaitCrypto from "node:crypto";
test("maintenance rejects guests/viewers/missing secrets; permits admins or exact configured cron credentials", async () => {
  const request = authorization => new Request("http://localhost/api/scraper/run", { method: "POST", headers: authorization ? { authorization } : {} });
  assert.equal((await access()(request())).denied.status, 401);
  assert.equal((await access({ user: { id: "viewer" } })(request())).denied.status, 403);
  assert.equal((await access({ user: { id: "admin" }, role: "super_admin" })(request())).denied, null);
  assert.equal((await access({ secret: "abc" })(request("Bearer abc"))).cron, true);
  assert.equal((await access({ secret: "abc" })(request("Bearer abc"), false)).denied.status, 401);
  assert.equal((await access({ secret: "abc" })(request("Bearer äbc"))).denied.status, 401);
  assert.equal((await access()(request("Bearer undefined"))).denied.status, 401);
});

test("maintenance CLI is preview-first and rejects unbounded limits", () => {
  assert.equal(parseOptions([]).apply, false); assert.equal(parseOptions(["--apply"]).apply, true);
  for (const args of [["--subtitle-limit", "101"], ["--metadata-limit", "501"], ["--metadata-limit", "-1"], ["--wat"]]) assert.throws(() => parseOptions(args));
});
test("CLI never retries a failed or non-progressing mutation batch blindly", async () => {
  const previous = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ success: true, hasMore: true, nextState: {}, summary: { items_processed: 0 } }) }; };
    await assert.rejects(runTask("http://localhost", "fake", "sync", {}, () => {}), /no progress/); assert.equal(calls, 1);
    globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: "denied" }) });
    await assert.rejects(runTask("http://localhost", "fake", "sync", {}, () => {}), /denied/);
  } finally { globalThis.fetch = previous; }
});

function scraper({ metadataStatus = 200, current = { overview: "", poster_path: "/keep.jpg", backdrop_path: null }, writeError = null, targets = [{ id: "movie", tmdb_id: 42, type: "movie" }], total = 5339, subtitle = { status: "skipped", language: "id", url: "https://storage.test/id.vtt" } } = {}) {
  const calls = []; const subtitleCalls = [];
  const db = { from(table) {
    const call = { table, operation: "select", filters: [] }; calls.push(call);
    const query = {
      select: () => query, eq: (key, value) => { call.filters.push([key, value]); return query; },
      gt: () => query, lte: () => query, order: () => query, limit: () => query,
      range: (start, end) => { call.range = [start, end]; return query; },
      update: value => { call.operation = "update"; call.value = value; return query; },
      upsert: (value, options) => { call.operation = "upsert"; call.value = value; call.options = options; return query; },
      single: async () => ({ data: current }),
      maybeSingle: async () => ({ data: { episode_number: 3, seasons: { season_number: 2 } } }),
      then: (resolve, reject) => Promise.resolve(call.operation === "update" ? { data: writeError ? null : [{ id: "movie" }], error: writeError } : { data: targets, count: total, error: null }).then(resolve, reject),
    };
    return query;
  } };
  const { ScraperService } = load("src/services/ScraperService.ts", {
    "@supabase/supabase-js": { createClient: () => db },
    "@/lib/tmdb": { classifyContentType: () => "movie", classifyPlatform: () => "other" },
    "@/lib/videasy": videasy,
    "@/services/SubtitleService": { SubtitleService: { fetchAndUploadSubtitle: async (...args) => { subtitleCalls.push(args); return subtitle; } } },
  }, { fetch: async () => ({ ok: metadataStatus === 200, status: metadataStatus, json: async () => ({ id: 42, overview: "New synopsis", poster_path: "/replace.jpg", backdrop_path: "/new.jpg" }) }) });
  return { service: new ScraperService(), calls, subtitleCalls };
}
test("metadata completion writes missing fields only, preserving curated metadata and approval", async () => {
  const state = scraper();
  const result = await state.service.runSyncMetadataChunk({ contents: [{ id: "movie", tmdb_id: 42, type: "movie" }], fillMissingOnly: true });
  assert.equal(result.summary.items_added, 1);
  const update = state.calls.find(call => call.operation === "update").value;
  assert.deepEqual(Object.keys(update).sort(), ["backdrop_path", "overview"]);
  assert.equal(update.overview, "New synopsis");
});
test("metadata HTTP and write failures are reported without destructive updates or false success", async () => {
  const invalid = scraper({ metadataStatus: 404 });
  const result = await invalid.service.runSyncMetadataChunk({ contents: [{ id: "movie", tmdb_id: 42, type: "movie" }] });
  assert.equal(result.summary.items_failed, 1); assert.equal(invalid.calls.some(call => call.operation === "update"), false);
  const denied = scraper({ writeError: { message: "denied" } });
  assert.equal((await denied.service.runSyncMetadataChunk({ contents: [{ id: "movie", tmdb_id: 42, type: "movie" }] })).summary.items_failed, 1);
});
test("subtitle sync paginates beyond the default database row limit and treats cached subtitles as success", async () => {
  const state = scraper();
  const result = await state.service.runSyncSubtitlesChunk({ offset: 1002 });
  assert.deepEqual(state.calls[0].range, [1002, 1004]); assert.equal(result.total, 5339); assert.equal(result.hasMore, true);
  assert.equal(result.summary.items_failed, 0); assert.equal(result.summary.items_skipped, 1); assert.equal(result.summary.subtitle_id, 1);
  assert.equal(result.nextState.contents, undefined); assert.equal(result.nextState.offset, 1003);
});
test("series sync resolves the latest aired episode and retains explicit episode targets", async () => {
  const state = scraper({ targets: [{ id: "series", tmdb_id: 42, type: "tv" }] });
  await state.service.runSyncSubtitlesChunk();
  assert.deepEqual(state.subtitleCalls[0], [42, "tv", "2", "3"]);
  assert.ok(state.calls.some(call => call.table === "episodes"));
  const explicit = scraper();
  await explicit.service.runSyncSubtitlesChunk({ contents: [{ tmdb_id: 42, type: "tv", season: 1, episode: 4 }] });
  assert.deepEqual(explicit.subtitleCalls[0], [42, "tv", "1", "4"]);
  assert.equal(explicit.calls.some(call => call.table === "episodes"), false);
});

test("scraper creates current Videasy movie/TV links and respects disabled-provider settings", async () => {
  for (const type of ['movie', 'tv']) {
    const state = scraper();
    await state.service.addProviderLinks('content', type, 42, {});
    const write = state.calls.find(call => call.table === 'embed_links' && call.operation === 'upsert');
    const link = write.value.find(link => link.provider === 'Videasy');
    assert.equal(link.url, type === 'movie' ? 'https://videasy.xyz/embed/movie/42' : 'https://videasy.xyz/embed/tv/42/1/1');
    assert.equal(write.options.onConflict, 'content_id,provider');
    assert.equal(write.value.some(link => link.provider === 'VidLink'), false);
  }
  const disabled = scraper();
  await disabled.service.addProviderLinks('content', 'movie', 42, { videasy_enabled: false });
  assert.equal(disabled.calls.find(call => call.operation === 'upsert').value.some(link => link.provider === 'Videasy'), false);
});

test("catalog and approval server actions independently block unauthorized invocation", async () => {
  const dependencies = { "@/lib/maintenance-access": { requireAdminClient: async () => { throw new Error("Admin access required"); } }, "next/cache": { revalidatePath: () => assert.fail("Unauthorized actions must not invalidate pages") }, "@/lib/audit": { logAudit: () => assert.fail("Unauthorized actions must not write audit events") } };
  const catalog = load("src/app/admin/catalog/actions.ts", dependencies);
  for (const [method, args] of [["deleteContent", ["id"]], ["updateContentStatus", ["id", "approved"]], ["bulkDeleteContent", [["id"]]], ["updateContentMetadata", ["id", { title: "x", cast_data: [] }]]]) await assert.rejects(catalog[method](...args), /Admin access required/);
  const approval = load("src/app/admin/approve/actions.ts", dependencies);
  for (const [method, args] of [["approveContent", ["id", "x"]], ["approveAllContent", []], ["rejectContent", ["id", "x"]]]) await assert.rejects(approval[method](...args), /Admin access required/);
});
test("service-role metadata action rejects unauthorized calls before constructing the scraper", async () => {
  const action = load("src/app/admin/catalog/sync-action.ts", {
    "@/lib/maintenance-access": { requireAdminClient: async () => { throw new Error("Admin access required"); } },
    "@/services/ScraperService": { ScraperService: class { constructor() { assert.fail("Privileged scraper must not start"); } } },
    "next/cache": { revalidatePath: () => assert.fail("No invalidation") },
  });
  assert.equal((await action.syncMetadataAction("id", 42, "movie")).success, false);
});
test("authorized metadata action preserves its sync flow and rejects invalid IDs/types", async () => {
  const calls = []; const paths = [];
  const action = load("src/app/admin/catalog/sync-action.ts", {
    "@/lib/maintenance-access": { requireAdminClient: async () => ({}) },
    "@/services/ScraperService": { ScraperService: class { async syncSpecificContent(...args) { calls.push(args); return { title: "Test" }; } } },
    "next/cache": { revalidatePath: path => paths.push(path) },
  });
  assert.equal((await action.syncMetadataAction("id", 42, "movie")).success, true);
  assert.deepEqual(calls, [["id", 42, "movie"]]); assert.deepEqual(paths, ["/admin/catalog", "/watch/id"]);
  assert.equal((await action.syncMetadataAction("id", -1, "movie")).success, false);
  assert.equal((await action.syncMetadataAction("id", 42, "other")).success, false); assert.equal(calls.length, 1);
});
