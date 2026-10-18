import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(name, overrides = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, URL, URLSearchParams, Event, ...overrides };
  runInNewContext(source, context);
  return context.exports;
}
const player = load("player-progress");
const history = load("watch-history");
const recommendations = load("recommendations");
const movie = { id: "movie", title: "Film", type: "movie", genre_names: ["Action"], addedAt: 1 };
const series = { id: "series", title: "Serial", type: "tv", addedAt: 1 };
const context = { tmdbId: 42, mediaType: "movie" };

test("revisiting a title preserves position, progress, and existing metadata", () => {
  const first = history.mergeHistory([], { ...movie, progress: 40, position: 400, duration: 1000 }, 1);
  const visited = history.mergeHistory(first, { ...movie, backdrop_path: undefined }, 2);
  assert.equal(visited[0].position, 400); assert.equal(visited[0].progress, 40); assert.equal(visited[0].watchedAt, 2);
});
test("resume returns integer seconds and skips near-completed or invalid positions", () => {
  assert.equal(history.resumePosition({ position: 120.9, duration: 1000 }), 120);
  for (const position of [0, 9, 950, 1000, Infinity, NaN]) assert.equal(history.resumePosition({ position, duration: 1000 }), 0);
});
test("series episodes have separate resume positions", () => {
  const item = { ...series, season: 1, episode: 2, position: 200, duration: 1000, episodes: { s1e1: { position: 120, duration: 1000 } } };
  assert.equal(history.resumePosition(item, 1, 1), 120); assert.equal(history.resumePosition(item, 1, 2), 200); assert.equal(history.resumePosition(item, 1, 3), 0);
});
test("continue watching links retain last season and episode", () => {
  const url = new URL(history.historyHref({ ...series, season: 2, episode: 5 }), "https://example.test");
  assert.equal(url.pathname, "/watch/series"); assert.equal(url.searchParams.get("ss"), "2"); assert.equal(url.searchParams.get("e"), "5");
  assert.equal(new URL(history.historyHref(movie), "https://example.test").searchParams.has("e"), false);
});
test("history is bounded and writes notify same-page consumers", () => {
  let stored = "[]"; let notifications = 0;
  const h = load("watch-history", { localStorage: { getItem: () => stored, setItem: (_key, value) => { stored = value; } }, window: { dispatchEvent: () => { notifications++; } } });
  for (let i = 0; i < 60; i++) h.recordHistory({ ...movie, id: String(i) });
  assert.equal(h.readHistory().length, 50); assert.equal(notifications, 60);
  h.recordPlayback(series, 120, 1000, 1, 1); h.recordPlayback(series, 200, 1000, 1, 2);
  const saved = h.readHistory()[0]; assert.equal(saved.episodes.s1e1.position, 120); assert.equal(saved.episodes.s1e2.position, 200);
});
test("storage failures and malformed JSON do not interrupt playback", () => {
  const h = load("watch-history", { localStorage: { getItem: () => "bad json", setItem: () => { throw new Error("blocked"); } }, window: { dispatchEvent: () => {} } });
  assert.equal(h.readHistory().length, 0); assert.equal(h.recordHistory(movie), false);
  assert.equal(h.recordPlayback(movie, Infinity, 1000), false); assert.equal(h.recordPlayback(movie, 10, 0), false);
});
test("player messages require the active iframe and exact trusted origin", () => {
  const frame = {};
  assert.equal(player.isTrustedPlayerEvent({ source: frame, origin: "https://vidlink.pro" }, frame, "https://vidlink.pro/movie/42"), true);
  assert.equal(player.isTrustedPlayerEvent({ source: {}, origin: "https://vidlink.pro" }, frame, "https://vidlink.pro/movie/42"), false);
  assert.equal(player.isTrustedPlayerEvent({ source: frame, origin: "https://vidlink.pro.attacker.test" }, frame, "https://vidlink.pro/movie/42"), false);
  assert.equal(player.isTrustedPlayerEvent({ source: frame, origin: "https://unknown.test" }, frame, "https://unknown.test/movie/42"), false);
});
test("documented flat PLAYER_EVENT and legacy MEDIA_DATA formats parse", () => {
  const p = player.parsePlayerProgress({ type: "PLAYER_EVENT", data: { event: "pause", currentTime: 120, duration: 1000, mtmdbId: 42, mediaType: "movie" } }, context);
  assert.equal(p.position, 120); assert.equal(p.event, "pause");
  assert.equal(player.parsePlayerProgress(JSON.stringify({ type: "MEDIA_DATA", data: { currentTime: 100, duration: 500 } }), context).position, 100);
});
test("documented keyed VidLink movie progress parses only the current title", () => {
  const raw = { type: "MEDIA_DATA", data: { 42: { type: "movie", progress: { watched: 300, duration: 1000 } }, 43: { type: "movie", progress: { watched: 600, duration: 1000 } } } };
  assert.equal(player.parsePlayerProgress(raw, context).position, 300);
  assert.equal(player.parsePlayerProgress(raw, { tmdbId: 44, mediaType: "movie" }), null);
});
test("series progress validates season and episode; auto-next cannot corrupt the active episode", () => {
  const raw = { type: "MEDIA_DATA", data: { 42: { type: "tv", last_season_watched: "1", last_episode_watched: "2", show_progress: { s1e2: { progress: { watched: 200, duration: 1000 } } } } } };
  assert.equal(player.parsePlayerProgress(raw, { tmdbId: 42, mediaType: "tv", season: 1, episode: 2 }).position, 200);
  assert.equal(player.parsePlayerProgress(raw, { tmdbId: 42, mediaType: "tv", season: 1, episode: 1 }), null);
});
test("invalid times, wrong media and unrelated payloads are ignored", () => {
  for (const data of [{ currentTime: -1, duration: 100 }, { currentTime: Infinity, duration: 100 }, { currentTime: 120, duration: 100 }, { currentTime: 10, duration: 0 }, { currentTime: "10", duration: 100 }, { currentTime: 10, duration: 100, tmdbId: 43 }, { currentTime: 10, duration: 100, mediaType: "tv" }]) assert.equal(player.parsePlayerProgress({ type: "PLAYER_EVENT", data }, context), null);
  assert.equal(player.parsePlayerProgress("bad json", context), null); assert.equal(player.parsePlayerProgress({ type: "OTHER", data: {} }, context), null);
});
test("resume is sent only using the verified VidLink startAt parameter", () => {
  const result = new URL(player.withResume("https://vidlink.pro/movie/42?color=ED574B", 120.9));
  assert.equal(result.searchParams.get("startAt"), "120"); assert.equal(result.searchParams.get("color"), "ED574B");
  for (const src of ["https://player.videasy.net/movie/42", "https://moviesapi.to/movie/42", "https://vidlink.pro.attacker.test/movie/42"]) assert.equal(player.withResume(src, 120), src);
});
test("recommendations rank matching genres, exclude history/list, and deduplicate", () => {
  const candidates = [{ ...movie }, { id: "other", title: "Lainnya", type: "movie", genre_names: ["Comedy"], popularity: 1000 }, { id: "match", title: "Cocok", type: "movie", genre_names: ["Action"], popularity: 1 }, { id: "saved", type: "movie", genre_names: ["Action"] }, { id: "match", title: "Cocok", type: "movie", genre_names: ["Action"], popularity: 1 }];
  const result = recommendations.recommend(candidates, [{ ...movie, progress: 30 }], [{ ...movie, id: "saved" }]);
  assert.equal(result[0].id, "match"); assert.equal(result.length, 2); assert.equal(candidates.length, 5);
});
test("recommendations need a preference seed and support older history without genre metadata", () => {
  const candidates = [movie, { ...movie, id: "second" }];
  assert.equal(recommendations.recommend(candidates, [], []).length, 0);
  assert.equal(recommendations.recommend(candidates, [{ id: movie.id, type: "movie", progress: 0 }], [], 1)[0].id, "second");
});
