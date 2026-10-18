import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../src/lib/cdnm.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {}, URL };
runInNewContext(source, context);
const { cdnmEmbedUrl } = context.exports;

test("CDNM movie and TV embeds use the documented TMDB route and episode params", () => {
  assert.equal(cdnmEmbedUrl(299534, "movie"), "https://share.cdnm.ink/embed/tmdb/299534");
  assert.equal(cdnmEmbedUrl(1399, "tv", 2, 3), "https://share.cdnm.ink/embed/tmdb/1399?season=2&episode=3");
  assert.equal(cdnmEmbedUrl(1399, "tv", 0, 1), "https://share.cdnm.ink/embed/tmdb/1399?season=0&episode=1");
});

test("CDNM embeds reject invalid identity and episode coordinates", () => {
  for (const args of [[0, "movie"], [NaN, "movie"], [42, "invalid"], [42, "tv", -1, 1], [42, "tv", 1, 0], [42, "tv", 1.5, 1]]) assert.throws(() => cdnmEmbedUrl(...args));
});
