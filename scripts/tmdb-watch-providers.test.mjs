import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load({ apiKey = "test-key", fetch = async () => ({ ok: true, json: async () => ({ results: {} }) }) } = {}) {
  const source = ts.transpileModule(readFileSync(new URL("../src/lib/tmdb.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, process: { env: { TMDB_API_KEY: apiKey } }, fetch, console, URL };
  runInNewContext(source, context);
  return context.exports;
}

test("watch providers requests the selected title type and Indonesian availability without exposing the API key", async () => {
  let request;
  const api = load({ fetch: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ results: { ID: { link: "https://www.themoviedb.org/movie/42/watch", free: [{ provider_id: 1, provider_name: "Free Service", logo_path: "/free.png", display_priority: 1 }], ads: [{ provider_id: 2, provider_name: "Ad Service", logo_path: "/ads.png", display_priority: 2 }] }, US: { link: "https://example.test" } } }) }; } });
  const result = await api.fetchTMDBWatchProviders(42, "movie", "ID");
  assert.equal(request.url, "https://api.themoviedb.org/3/movie/42/watch/providers?api_key=test-key");
  assert.equal(request.options.next.revalidate, 21600);
  assert.deepEqual(result.free.map(provider => provider.provider_name), ["Free Service"]);
  assert.deepEqual(result.ads.map(provider => provider.provider_name), ["Ad Service"]);
  assert.equal(result.link, "https://www.themoviedb.org/movie/42/watch");
});

test("watch providers supports TV IDs and returns no availability for an unlisted region", async () => {
  const api = load({ fetch: async () => ({
    ok: true,
    json: async () => ({ results: { US: { link: "https://example.test" } } }),
  }) });
  assert.equal(await api.fetchTMDBWatchProviders(1399, "tv", "ID"), null);
});

test("watch provider lookup skips invalid IDs/regions and safely handles missing keys or API errors", async () => {
  let calls = 0;
  const fetch = async () => { calls++; return { ok: false, json: async () => ({}) }; };
  const api = load({ fetch });
  for (const [id, type, region] of [[0, "movie", "ID"], [42.5, "movie", "ID"], [42, "movie", "id"], [42, "movie", "USA"]]) assert.equal(await api.fetchTMDBWatchProviders(id, type, region), null);
  assert.equal(calls, 0);
  assert.equal(await load({ apiKey: "", fetch }).fetchTMDBWatchProviders(42, "movie"), null);
  assert.equal(calls, 0);
  assert.equal(await api.fetchTMDBWatchProviders(42, "movie"), null);
  assert.equal(calls, 1);
});

test("watch provider outbound links must use official TMDB or JustWatch HTTPS domains", async () => {
  const api = load({ fetch: async () => ({ ok: true, json: async () => ({ results: { ID: { link: "https://example.test/watch" } } }) }) });
  assert.equal(await api.fetchTMDBWatchProviders(42, "movie", "ID"), null);
});
