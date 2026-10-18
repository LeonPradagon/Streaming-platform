import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../src/lib/vidapi.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {}, URL };
runInNewContext(source, context);
const { vidapiRuEmbedUrl, vidapiXyzEmbedUrl, addVidApiRuSubtitle } = context.exports;

test("VidAPI embed builders create documented TMDB movie and TV paths", () => {
  assert.equal(vidapiRuEmbedUrl(299534, "movie"), "https://vaplayer.ru/embed/movie/299534?primaryColor=%23ED574B&autoplay=1&ds_lang=id");
  assert.equal(vidapiRuEmbedUrl(1399, "tv", 2, 3), "https://vaplayer.ru/embed/tv/1399/2/3?primaryColor=%23ED574B&autoplay=1&ds_lang=id");
  assert.equal(vidapiXyzEmbedUrl(299534, "movie"), "https://vidapi.xyz/embed/movie/299534");
  assert.equal(vidapiXyzEmbedUrl(1399, "tv", 2, 3), "https://vidapi.xyz/embed/tv/1399/2/3");
});

test("VidAPI embed builders reject invalid IDs, types, and episode numbers", () => {
  for (const builder of [vidapiRuEmbedUrl, vidapiXyzEmbedUrl]) {
    for (const args of [[0, "movie"], [42.5, "movie"], [42, "invalid"], [42, "tv", -1, 1], [42, "tv", 1, 0]]) assert.throws(() => builder(...args));
  }
});

test("VidAPI.ru subtitle uses HTTPS only and emits documented Indonesian subtitle parameters", () => {
  const base = vidapiRuEmbedUrl(42, "movie");
  const result = new URL(addVidApiRuSubtitle(base, "https://subs.example.test/movie.vtt", "id"));
  assert.equal(result.searchParams.get("sub_url"), "https://subs.example.test/movie.vtt");
  assert.equal(result.searchParams.get("sub_label"), "Indonesia");
  assert.equal(result.searchParams.get("sub_lang"), "id");
  assert.equal(result.searchParams.get("sub_default"), "true");
  assert.equal(result.searchParams.has("ds_lang"), false);
  for (const unsafe of ["http://subs.example.test/movie.vtt", "javascript:alert(1)", "https://user:pass@subs.example.test/movie.vtt", "bad-url"]) {
    assert.equal(addVidApiRuSubtitle(base, unsafe), base);
  }
  assert.equal(addVidApiRuSubtitle("https://vidapi.xyz/embed/movie/42", "https://subs.example.test/movie.vtt"), "https://vidapi.xyz/embed/movie/42");
});
