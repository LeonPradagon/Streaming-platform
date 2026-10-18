import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const context = { exports: {}, URL, console, require: name => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; } };
  runInNewContext(source, context); return context.exports;
}
const videasy = load("src/lib/videasy.ts");
const progress = load("src/lib/player-progress.ts");
const vidapi = load("src/lib/vidapi.ts");
const links = [
  { id: "videasy", provider: "Videasy", url: "https://player.videasy.net/movie/42" },
  { id: "moviesapi", provider: "MoviesAPI", url: "https://moviesapi.to/movie/42" },
  { id: "vidlink", provider: "VidLink", url: "https://vidlink.pro/movie/42" },
  { id: "drive", provider: "Google Drive", url: "https://drive.google.com/file/d/abcdefghijklmnop/preview?resourcekey=0-key" },
];

test("current Videasy URLs follow movie/TV docs and legacy URLs remain explicit alternatives", () => {
  assert.equal(videasy.videasyEmbedUrl(299534, "movie"), "https://videasy.xyz/embed/movie/299534");
  assert.equal(videasy.videasyEmbedUrl(1399, "tv", 2, 3), "https://videasy.xyz/embed/tv/1399/2/3");
  assert.equal(videasy.videasyEmbedUrl(1399, "tv", 0, 1), "https://videasy.xyz/embed/tv/1399/0/1");
  assert.equal(videasy.videasyEmbedUrl(1399, "tv", 2, 3, true), "https://player.videasy.net/tv/1399/2/3");
  for (const args of [[0, "movie"], [NaN, "movie"], [42, "other"], [42, "tv", -1, 1], [42, "tv", 1, 0], [42, "tv", 1.5, 1]]) assert.throws(() => videasy.videasyEmbedUrl(...args));
});

test("provider recognition uses exact HTTPS origins, not substrings or credentials", () => {
  assert.equal(videasy.videasyVariant("https://videasy.xyz/embed/movie/42"), "current");
  assert.equal(videasy.videasyVariant("https://player.videasy.net/movie/42"), "legacy");
  for (const url of ["http://videasy.xyz/embed/movie/42", "https://videasy.xyz.evil.org/embed/movie/42", "https://user:pass@videasy.xyz/embed/movie/42", "https://videasy.xyz:8443/embed/movie/42", "https://evil.org/?next=videasy.xyz", "not a URL"]) assert.equal(videasy.videasyVariant(url), null);
});

test("old stored links upgrade on read without mutating DB rows or shifting fallback indices", () => {
  const before = JSON.stringify(links);
  const result = videasy.upgradeVideasyLinks(links, 42, "movie");
  assert.equal(result[0].url, "https://videasy.xyz/embed/movie/42");
  for (const index of [1, 2, 3]) assert.equal(result[index], links[index]);
  assert.equal(result.length, 4);
  assert.equal(JSON.stringify(links), before);
  const existingLegacy = { id: "legacy", provider: "Videasy Legacy", url: "https://player.videasy.net/movie/42" };
  assert.equal(videasy.upgradeVideasyLinks([...links, existingLegacy], 42, "movie")[4].url, "https://videasy.xyz/embed/movie/42");
  const disabled = videasy.upgradeVideasyLinks(links.slice(1), 42, "movie");
  assert.equal(disabled.length, 3); assert.equal(disabled.some(link => link.provider.includes("Videasy")), false);
});

test("XYZ receives only its documented theme/autoplay parameters, not unsupported subtitle/resume guesses", () => {
  const url = new URL(videasy.styleCurrentVideasy("https://videasy.xyz/embed/movie/42?color=old&sub=private&subtitle_url=private&startAt=120"));
  assert.equal(url.searchParams.get("primarycolor"), "ED574B"); assert.equal(url.searchParams.get("autoplay"), "true");
  for (const name of ["secondarycolor", "iconcolor", "fontcolor"]) assert.equal(url.searchParams.get(name), "ffffff");
  for (const name of ["color", "sub", "subtitle_url", "startAt"]) assert.equal(url.searchParams.has(name), false);
  const legacy = "https://player.videasy.net/movie/42?color=blue";
  assert.equal(videasy.styleCurrentVideasy(legacy), legacy);
});

test("documented TIME_UPDATE is accepted only from the current frame and exact trusted origin", () => {
  const frame = {};
  assert.equal(progress.isTrustedPlayerEvent({ source: frame, origin: "https://videasy.xyz" }, frame, "https://videasy.xyz/embed/movie/42"), true);
  assert.equal(progress.isTrustedPlayerEvent({ source: {}, origin: "https://videasy.xyz" }, frame, "https://videasy.xyz/embed/movie/42"), false);
  assert.equal(progress.isTrustedPlayerEvent({ source: frame, origin: "https://videasy.xyz.evil.org" }, frame, "https://videasy.xyz/embed/movie/42"), false);
  const parsed = progress.parsePlayerProgress({ type: "TIME_UPDATE", currentTime: 120, duration: 1000 }, { tmdbId: 42, mediaType: "movie" });
  assert.equal(parsed.position, 120); assert.equal(parsed.duration, 1000);
  for (const data of [{ currentTime: -1, duration: 1000 }, { currentTime: "120", duration: 1000 }, { currentTime: 120, duration: 0 }, { currentTime: 120, duration: 1000, tmdbId: 43 }, { currentTime: 120, duration: 1000, season: 2, episode: 4 }]) assert.equal(progress.parsePlayerProgress({ type: "TIME_UPDATE", ...data }, { tmdbId: 42, mediaType: "tv", season: 2, episode: 3 }), null);
  assert.equal(progress.supportsResume("https://videasy.xyz/embed/movie/42"), false);
  assert.equal(progress.withResume("https://videasy.xyz/embed/movie/42", 120), "https://videasy.xyz/embed/movie/42");
});

const jsx = (type, props) => ({ type, props });
function nodes(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}
test("current Videasy stays embedded in NETIX and explains browser cookie requirements", () => {
  const component = load("src/components/VideoPlayer.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useState: initial => [initial === null ? 120 : initial, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, useCallback: callback => callback },
    "next/link": "Link", "lucide-react": {}, "framer-motion": { motion: {}, AnimatePresence: "AnimatePresence" },
    "@/lib/watch-history": {}, "@/lib/player-progress": progress,
    "@/lib/drive-video": { isDriveVideoUrl: () => false },
    "@/lib/subtitle-format": { subtitleLabel: language => language === "id" ? "Indonesia" : "Inggris" },
    "@/lib/videasy": videasy,
    "@/lib/vidapi": vidapi,
  });
  const render = src => component.default({ src, title: "Test", externalSubtitle: "https://storage.example.org/sub.vtt", externalSubtitleLanguage: "en", item: { id: "movie" } });
  const currentTree = render("https://videasy.xyz/embed/movie/42");
  const iframe = nodes(currentTree, "iframe")[0];
  assert.ok(iframe);
  const current = new URL(iframe.props.src);
  assert.equal(current.searchParams.get("autoplay"), "true"); assert.equal(current.searchParams.get("primarycolor"), "ED574B");
  for (const name of ["color", "sub", "sub_url", "subtitle_url", "subtitle", "startAt"]) assert.equal(current.searchParams.has(name), false);
  const legacy = new URL(nodes(render("https://player.videasy.net/movie/42"), "iframe")[0].props.src);
  assert.equal(legacy.searchParams.get("color"), "ED574B"); assert.equal(legacy.searchParams.get("autoplay"), "1");
  const vidlink = new URL(nodes(render("https://vidlink.pro/movie/42"), "iframe")[0].props.src);
  assert.equal(vidlink.searchParams.get("startAt"), "120"); assert.equal(vidlink.searchParams.get("sub_label"), "Inggris");
  const vidapiRu = new URL(nodes(render(vidapi.vidapiRuEmbedUrl(42, "movie")), "iframe")[0].props.src);
  assert.equal(vidapiRu.searchParams.get("primaryColor"), "#ED574B");
  assert.equal(vidapiRu.searchParams.get("autoplay"), "1");
  assert.equal(vidapiRu.searchParams.get("sub_url"), "https://storage.example.org/sub.vtt");
  assert.equal(vidapiRu.searchParams.get("sub_label"), "EN");
  assert.equal(vidapiRu.searchParams.get("sub_default"), "true");
});
