import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const context = { exports: {}, URL, console, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  } };
  runInNewContext(source, context);
  return context.exports;
}
const drive = load("src/lib/drive-video.ts");
const videasy = load("src/lib/videasy.ts");
const fileId = "abcdefghijklmnop_123456789";
const preview = `https://drive.google.com/file/d/${fileId}/preview`;
const contentId = "11111111-2222-3333-4444-555555555555";

test("Drive file links and IDs normalize to a preview; resource keys survive", () => {
  for (const input of [fileId, ` ${fileId} `, preview, preview.replace("preview", "view") + "?usp=sharing", `https://drive.google.com/open?id=${fileId}`, `https://drive.google.com/uc?export=download&id=${fileId}`]) assert.equal(drive.toDrivePreviewUrl(input), preview);
  const result = drive.toDrivePreviewUrl(`${preview}?resourcekey=0-key_123&authuser=1&usp=sharing`);
  assert.equal(result, `${preview}?resourcekey=0-key_123`);
  assert.equal(drive.driveViewUrl(result), `${preview.replace("preview", "view")}?resourcekey=0-key_123`);
});
test("folder URLs, deceptive origins, credentials and malformed file IDs are rejected", () => {
  for (const input of ["https://drive.google.com/drive/folders/1CUMaEPS5S7VyRe65jRPzOOa8QlRdbPuq?usp=sharing", "https://evil.test/file/d/abcdefghijklmnop/view", `https://drive.google.com.evil.test/file/d/${fileId}/view`, `http://drive.google.com/file/d/${fileId}/view`, `https://drive.google.com:8443/file/d/${fileId}/view`, `https://user:password@drive.google.com/file/d/${fileId}/view`, `https://drive.google.com/file/d/${fileId}/edit`, `${preview}?resourcekey=bad%20key`, "short", "javascript:alert(1)", null]) assert.throws(() => drive.toDrivePreviewUrl(input));
  assert.equal(drive.isDriveVideoUrl(preview), true);
  assert.equal(drive.isDriveVideoUrl(preview.replace("preview", "view")), false);
});

function database(responses) {
  const calls = [];
  return { calls, client: {
    auth: { getUser: async () => ({ data: { user: responses.user === undefined ? { id: "admin" } : responses.user } }) },
    from(table) {
      const call = { table, operation: "select", filters: [] }; calls.push(call);
      const query = {
        select: () => query,
        eq: (column, value) => { call.filters.push([column, value]); return query; },
        insert: value => { call.operation = "insert"; call.value = value; return query; },
        update: value => { call.operation = "update"; call.value = value; return query; },
        delete: () => { call.operation = "delete"; return query; },
        limit: () => query, order: () => query, contains: () => query, neq: () => query,
        single: () => Promise.resolve(result()),
        then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
      };
      function result() {
        if (table === "profiles") return { data: { role: responses.role || "super_admin" }, error: responses.profileError || null };
        if (table === "contents") return { data: responses.content === undefined ? { id: contentId, title: "Test movie", type: "movie", tmdb_id: 42, genre_names: [] } : responses.content, error: null };
        if (table === "embed_links" && call.operation === "select") return { data: responses.links || [], error: responses.lookupError || null };
        if (table === "embed_links") return { data: responses.written === undefined ? [{ id: "drive-link" }] : responses.written, error: responses.writeError || null };
        return { data: [], error: null };
      }
      return query;
    },
  } };
}
function action(responses = {}) {
  const db = database(responses);
  const invalidations = [];
  const audits = [];
  const { saveDriveVideo } = load("src/app/admin/catalog/drive-actions.ts", {
    "@/lib/supabase/server": { createClient: async () => db.client },
    "@/lib/drive-video": drive,
    "@/lib/audit": { logAudit: async (...args) => audits.push(args) },
    "next/cache": { revalidatePath: path => invalidations.push(path) },
  });
  return { ...db, saveDriveVideo, invalidations, audits };
}
const input = { contentId, url: preview.replace("preview", "view"), rightsConfirmed: true };
const writes = calls => calls.filter(call => call.operation !== "select");

test("new Drive links use existing storage without touching other providers", async () => {
  const state = action();
  assert.equal((await state.saveDriveVideo(input)).success, true);
  const written = writes(state.calls);
  assert.equal(written.length, 1); assert.equal(written[0].operation, "insert");
  assert.equal(written[0].value.provider, "Google Drive"); assert.equal(written[0].value.url, preview);
  assert.deepEqual(state.invalidations, ["/admin/catalog", `/admin/catalog/${contentId}/drive`, `/watch/${contentId}`]);
  assert.equal(state.audits[0][0], "SAVE_DRIVE_VIDEO");
});
test("existing Drive links are updated and removal affects only this content/provider", async () => {
  for (const remove of [false, true]) {
    const state = action({ links: [{ id: "drive-link" }], role: "moderator" });
    assert.equal((await state.saveDriveVideo({ ...input, remove, rightsConfirmed: !remove })).success, true);
    const write = writes(state.calls)[0];
    assert.equal(write.operation, remove ? "delete" : "update");
    assert.ok(write.filters.some(([field, value]) => field === "content_id" && value === contentId));
    assert.ok(write.filters.some(([field, value]) => field === "provider" && value === "Google Drive"));
  }
});
test("actions deny guests, non-admins, missing content, serials and unconfirmed rights", async () => {
  for (const scenario of [{ user: null }, { role: "user" }, { profileError: { message: "offline" } }, { content: null }, { content: { id: contentId, type: "tv" } }]) {
    const state = action(scenario);
    assert.equal((await state.saveDriveVideo(input)).success, false);
    assert.equal(writes(state.calls).length, 0);
  }
  for (const overrides of [{ rightsConfirmed: false }, { rightsConfirmed: "true" }, { url: "https://drive.google.com/drive/folders/abcdefghijklmnop" }, { contentId: "invalid" }, { remove: "false" }]) {
    const state = action(); assert.equal((await state.saveDriveVideo({ ...input, ...overrides })).success, false); assert.equal(writes(state.calls).length, 0);
  }
});
test("lookup, RLS write failures, zero-row writes and duplicate entries never report success", async () => {
  for (const scenario of [{ lookupError: { message: "denied" } }, { writeError: { message: "denied" } }, { written: [] }, { links: [{ id: "a" }, { id: "b" }] }]) {
    const state = action(scenario); assert.equal((await state.saveDriveVideo(input)).success, false); assert.equal(state.invalidations.length, 0); assert.equal(state.audits.length, 0);
  }
  const state = action({ links: [{ id: "drive-link" }], written: [] });
  assert.equal((await state.saveDriveVideo({ ...input, remove: true })).success, false);
});

const jsx = (type, props) => ({ type, props });
function nodes(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}
async function watch(links, { type = "movie", server } = {}) {
  const db = database({ content: { id: contentId, title: "Test", type, tmdb_id: 42, genre_names: [] }, links });
  const component = load("src/app/watch/[id]/page.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx }, "@/lib/supabase": { supabase: db.client }, "@/lib/drive-video": drive,
     "@/lib/videasy": videasy,
     "@/lib/cdnm": { cdnmEmbedUrl: (id, type, season, episode) => `https://share.cdnm.ink/embed/tmdb/${id}${type === "tv" ? `?season=${season}&episode=${episode}` : ""}` },
     "@/lib/vidapi": {
       vidapiRuEmbedUrl: (id, type, season, episode) => `https://vaplayer.ru/embed/${type}/${id}${type === "tv" ? `/${season}/${episode}` : ""}?primaryColor=%23ED574B&autoplay=1&ds_lang=id`,
       vidapiXyzEmbedUrl: (id, type, season, episode) => `https://vidapi.xyz/embed/${type}/${id}${type === "tv" ? `/${season}/${episode}` : ""}`,
      },
      "@/lib/superembed": { superEmbedUrl: (id, type, season, episode) => `https://multiembed.mov/?video_id=${id}&tmdb=1${type === "tv" ? `&s=${season}&e=${episode}` : ""}` },
     "@/lib/tmdb": { fetchTMDBMetadata: async () => null, getTMDBImageUrl: () => "", fetchTMDBTVSeasonDetails: async () => null },
    "@/services/SubtitleService": { SubtitleService: { fetchAndUploadSubtitle: async () => ({ url: "" }) } },
    "next/link": "Link", "lucide-react": {}, "@/components/VideoPlayer": "VideoPlayer", "@/components/WatchActions": "WatchActions", "@/components/SeasonSelector": "SeasonSelector", "@/components/ContentRow": "ContentRow",
  });
  return component.default({ params: Promise.resolve({ id: contentId }), searchParams: Promise.resolve({ s: server, ss: "2", e: "3" }) });
}
const providers = [
  { id: "vidlink", provider: "VidLink", url: "https://vidlink.pro/movie/42" },
  { id: "moviesapi", provider: "MoviesAPI", url: "https://moviesapi.to/movie/42" },
  { id: "videasy", provider: "Videasy", url: "https://player.videasy.net/movie/42" },
  { id: "videasy-legacy", provider: "Videasy Legacy", url: "https://player.videasy.net/movie/42" },
];
test("watch page defaults to MoviesAPI and offers safe stored and TMDB providers", async () => {
  const tree = await watch([...providers, { id: "drive", provider: "Google Drive", url: `${preview}?resourcekey=0-key` }]);
  assert.equal(nodes(tree, "VideoPlayer")[0].props.src, "https://moviesapi.to/movie/42");
  const options = nodes(tree, "Link").filter(node => node.props.className === "server-option");
  assert.deepEqual(options.map(node => node.props.children), ["MoviesAPI", "Google Drive", "SuperEmbed", "VidAPI.xyz"]);
  for (const server of ["0", "2", "3"]) {
    const legacy = await watch([...providers, { id: "drive", provider: "Google Drive", url: preview }], { server });
    assert.ok(!nodes(legacy, "VideoPlayer")[0].props.src.includes("drive.google.com"));
  }
  const explicitDrive = await watch([...providers, { id: "drive", provider: "Google Drive", url: `${preview}?resourcekey=0-key` }], { server: "1" });
  assert.equal(nodes(explicitDrive, "VideoPlayer")[0].props.src, `${preview}?resourcekey=0-key`);
  const explicitSuperEmbed = await watch(providers, { server: "1" });
  assert.equal(nodes(explicitSuperEmbed, "VideoPlayer")[0].props.src, "https://multiembed.mov/?video_id=42&tmdb=1");
  const explicitVidApiXyz = await watch(providers, { server: "2" });
  assert.equal(nodes(explicitVidApiXyz, "VideoPlayer")[0].props.src, "https://vidapi.xyz/embed/movie/42");
  assert.equal(nodes(explicitSuperEmbed, "Link").filter(node => node.props.className === "server-option").length, 3);
});
test("Drive never becomes a serial episode or an arbitrary/malformed embed", async () => {
  const tree = await watch([...providers, { id: "drive", provider: "Google Drive", url: preview }], { type: "tv" });
  assert.equal(nodes(tree, "VideoPlayer")[0].props.src, "https://moviesapi.to/tv/42-2-3");
  assert.equal(nodes(tree, "Link").filter(node => node.props.className === "server-option").length, 3);
  for (const url of ["https://evil.test/video", "https://drive.google.com/drive/folders/abcdefghijklmnop"]) {
    const tree = await watch([...providers, { id: "bad", provider: "Google Drive", url }]);
      assert.equal(nodes(tree, "VideoPlayer")[0].props.src, "https://moviesapi.to/movie/42");
  }
});

test("Drive player preserves its URL without provider parameters, progress claims or popup blocking", () => {
  const effects = [];
  const component = load("src/components/VideoPlayer.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useState: initial => [initial === null ? 120 : initial, () => {}], useRef: () => ({ current: null }), useEffect: effect => effects.push(effect), useCallback: callback => callback },
    "next/link": "Link", "lucide-react": {}, "framer-motion": { motion: {}, AnimatePresence: "AnimatePresence" },
    "@/lib/watch-history": {}, "@/lib/player-progress": { supportsResume: () => false, withResume: () => { throw new Error("Drive must not receive provider resume parameters"); } },
    "@/lib/drive-video": drive,
    "@/lib/subtitle-format": { subtitleLabel: language => language === 'id' ? 'Indonesia' : 'Subtitle' },
     "@/lib/videasy": videasy,
     "@/lib/vidapi": { addVidApiRuSubtitle: input => input },
  });
  // A resource key can contain a provider name; it must not trigger substring-based URL decoration.
  const src = `${preview}?resourcekey=0-vidlink-videasy`;
  const tree = component.default({ src, title: "Test", item: { id: contentId } });
  assert.equal(nodes(tree, "iframe")[0].props.src, src);
  assert.equal(nodes(tree, "div").some(node => node.props.className === "resume-notice"), false);
  assert.doesNotThrow(() => effects[2]()); // Ad-block effect returns before touching window on Drive.
});
