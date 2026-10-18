import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, stat, access, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseOptions, validateManifest, directUrl, publicAddress, publicFetch, fileSignature, probeSource, mediaDigest, downloadVideo, runBatch, main } from "./drive-batch.mjs";
import { CHUNK_BYTES, DRIVE_SCOPE, desktopClient, oauthAuthorization, googleUploadUrl, uploadOffset, DriveClient, saveJson } from "./lib/google-drive-upload.mjs";

const FOLDER = "1CUMaEPS5S7VyRe65jRPzOOa8QlRdbPuq";
const FILE_ID = "test_generated_file_id_12345";
const SESSION = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=secret-session";
const CLIENT = { client_id: "example.apps.googleusercontent.com", client_secret: "fake-client-secret" };
const PUBLIC = async () => [{ address: "93.184.216.34" }];
const video = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(100)]);
const job = { id: "movie-42", tmdbId: 42, name: "Movie.mp4", url: "https://cdn.example.org/movie.mp4" };
const manifest = jobs => ({ version: 1, folderId: FOLDER, jobs });
const noLog = () => {};

async function temporary(t) {
  const dir = await mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Temp", "opencode") : tmpdir(), "netix-drive-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("CLI is preview-first, capped, and rejects contradictory/unbounded flags", () => {
  assert.equal(parseOptions(["--manifest", "queue.json"]).apply, undefined);
  assert.equal(parseOptions(["--manifest", "queue.json"]).maxGiB, 20);
  assert.equal(parseOptions(["--authorize", "--credentials", "desktop.json"]).authorize, true);
  for (const args of [[], ["--manifest"], ["--manifest", "q", "--max-gib", "101"], ["--manifest", "q", "--max-gib", "0"], ["--manifest", "q", "--max-total-gib", "1001"], ["--manifest", "q", "--apply", "--authorize"], ["--manifest", "q", "--apply", "--check-sources"], ["--manifest", "q", "--wat"], ["--manifest", "q", "--apply", "--apply"]]) assert.throws(() => parseOptions(args));
});

test("manifest preserves movie identity and validates sources, filenames and unique queue IDs", () => {
  const parsed = validateManifest(manifest([job, { id: "local", name: "Local.mkv", path: "videos/local.mkv" }]), process.cwd());
  assert.equal(parsed.jobs[0].tmdbId, 42); assert.equal(parsed.jobs[1].path, resolve("videos/local.mkv"));
  for (const change of [{ id: "../x" }, { id: "__proto__" }, { id: "NUL" }, { name: "../../x.mp4" }, { name: "file:stream.mp4" }, { name: "x.exe" }, { path: "local.mp4" }, { tmdbId: -1 }, { url: undefined }]) assert.throws(() => validateManifest(manifest([{ ...job, ...change }]), process.cwd()));
  assert.throws(() => validateManifest(manifest([job, job]), process.cwd()));
  assert.throws(() => validateManifest(manifest(Array.from({ length: 501 }, (_, id) => ({ ...job, id: `job-${id}` }))), process.cwd()));
});

test("direct sources and redirects reject private destinations and credential-bearing URLs", async () => {
  for (const url of ["file:///C:/movie.mp4", "http://cdn.example.org/a.mp4", "https://user:pass@cdn.example.org/a.mp4", "https://127.0.0.1/a.mp4", "https://localhost/a.mp4", "https://cdn.example.org:9999/a.mp4"]) assert.throws(() => directUrl(url));
  for (const address of ["127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "169.254.169.254", "100.64.1.1", "::1", "fc00::1", "::ffff:127.0.0.1", "2001:db8::1"]) assert.equal(publicAddress(address), false);
  assert.equal(publicAddress("93.184.216.34"), true); assert.equal(publicAddress("2606:4700:4700::1111"), true);
  let calls = 0;
  await assert.rejects(publicFetch(job.url, {}, { resolveHost: async () => [{ address: "10.1.2.3" }], request: async () => { calls++; } }), /non-public/); assert.equal(calls, 0);
  await assert.rejects(publicFetch(job.url, {}, { resolveHost: PUBLIC, request: async () => new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } }) }), /public HTTPS/);
});

test("source probes request a small range and distinguish video bytes from challenges", async () => {
  let range;
  const deps = { resolveHost: PUBLIC, request: async (_, options) => { range = options.headers.Range; return new Response(video, { status: 206, headers: { "content-type": "video/mp4", "content-range": `bytes 0-${video.length - 1}/${video.length}` } }); } };
  assert.equal((await probeSource(job, 1000, deps)).bytes, video.length); assert.equal(range, "bytes=0-1023");
  await assert.rejects(probeSource(job, 1000, { resolveHost: PUBLIC, request: async () => new Response("Just a moment", { status: 403, headers: { "content-type": "text/html" } }) }), /blocked: source HTTP 403/);
  await assert.rejects(probeSource(job, 1000, { resolveHost: PUBLIC, request: async () => new Response("<html>challenge</html>", { headers: { "content-type": "video/mp4", "content-length": "22" } }) }), /expected MP4/);
  await assert.rejects(probeSource(job, 20, deps), /exceeds/);
  assert.equal(fileSignature(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), "Movie.mkv"), true);
});

test("interrupted downloads retain bytes and resume only with exact range and unchanged validator", async t => {
  const dir = await temporary(t); const path = join(dir, "movie.mp4"); const checkpoint = {};
  let pulls = 0; let saves = 0;
  const request = async () => new Response(new ReadableStream({ pull(controller) { if (!pulls++) controller.enqueue(video.subarray(0, 24)); else controller.error(new Error("Disconnected")); } }), { headers: { "content-type": "video/mp4", "content-length": String(video.length), etag: '"stable"' } });
  await assert.rejects(downloadVideo(job, path, checkpoint, async () => saves++, { maxBytes: 1000, resolveHost: PUBLIC, request }), /Disconnected/);
  assert.equal((await stat(`${path}.part`)).size, 24); assert.equal(checkpoint.total, video.length); assert.equal(saves, 1);
  let options;
  await downloadVideo(job, path, checkpoint, async () => {}, { maxBytes: 1000, resolveHost: PUBLIC, request: async (_, input) => { options = input; return new Response(video.subarray(24), { status: 206, headers: { "content-type": "video/mp4", "content-range": `bytes 24-${video.length - 1}/${video.length}`, etag: '"stable"' } }); } });
  assert.equal(options.headers.Range, "bytes=24-"); assert.equal(options.headers["If-Range"], '"stable"');
  assert.deepEqual(await readFile(path), video); await assert.rejects(access(`${path}.part`));
});

test("ignored ranges and changed sources do not corrupt or overwrite partial files", async t => {
  const dir = await temporary(t); const path = join(dir, "movie.mp4"); await writeFile(`${path}.part`, video.subarray(0, 24));
  const checkpoint = { total: video.length, validator: '"stable"' };
  await assert.rejects(downloadVideo(job, path, checkpoint, async () => {}, { maxBytes: 1000, resolveHost: PUBLIC, request: async () => new Response(video, { headers: { "content-type": "video/mp4", "content-length": String(video.length), etag: '"stable"' } }) }), /exact resume range/);
  await assert.rejects(downloadVideo(job, path, checkpoint, async () => {}, { maxBytes: 1000, resolveHost: PUBLIC, request: async () => new Response(video.subarray(24), { status: 206, headers: { "content-type": "video/mp4", "content-range": `bytes 24-${video.length - 1}/${video.length}`, etag: '"changed"' } }) }), /Source changed/);
  assert.deepEqual(await readFile(`${path}.part`), video.subarray(0, 24));
  await assert.rejects(downloadVideo(job, path, {}, async () => {}, { maxBytes: 1000 }), /no stable validator/);
  await writeFile(path, "user-owned existing file");
  await assert.rejects(downloadVideo(job, path, checkpoint, async () => {}, { maxBytes: 1000 }), /Nothing was overwritten/);
  assert.equal(await readFile(path, "utf8"), "user-owned existing file");
});

test("complete partial downloads are published without redownloading, with container checks", async t => {
  const dir = await temporary(t); const path = join(dir, "movie.mp4"); await writeFile(`${path}.part`, video);
  await downloadVideo(job, path, { total: video.length, validator: '"stable"' }, async () => {}, { maxBytes: 1000, request: async () => assert.fail("Must not redownload") });
  assert.deepEqual(await readFile(path), video);
  assert.equal((await mediaDigest(path, job.name, 1000)).md5, createHash("md5").update(video).digest("hex"));
});

test("OAuth requires desktop client JSON, uses state + PKCE and asks for the existing-folder Drive scope", () => {
  assert.deepEqual(desktopClient({ installed: CLIENT }), CLIENT);
  assert.throws(() => desktopClient({ web: CLIENT })); assert.throws(() => desktopClient({ installed: { client_id: "not-google", client_secret: "x" } }));
  const url = new URL(oauthAuthorization(CLIENT, "http://127.0.0.1:1234/oauth/callback", "nonce", "verifier"));
  assert.equal(url.origin, "https://accounts.google.com"); assert.equal(url.searchParams.get("state"), "nonce"); assert.equal(url.searchParams.get("code_challenge_method"), "S256"); assert.equal(url.searchParams.get("scope"), DRIVE_SCOPE); assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.has("client_secret"), false); assert.equal(url.searchParams.has("code_verifier"), false);
});

test("resumable-session validation prevents OAuth leakage; acknowledged offsets are strictly validated", () => {
  assert.equal(googleUploadUrl(SESSION), SESSION);
  for (const url of ["https://www.googleapis.com.evil.org/upload/drive/v3/files", "https://evil.org/upload/drive/v3/files", "http://www.googleapis.com/upload/drive/v3/files", "https://user:pass@www.googleapis.com/upload/drive/v3/files", "https://www.googleapis.com/other"]) assert.throws(() => googleUploadUrl(url));
  assert.equal(uploadOffset(new Response(null, { status: 308, headers: { range: "bytes=0-99" } }), 100), 100);
  for (const range of ["bytes=5-99", "bytes=0-101", "not a range"]) assert.throws(() => uploadOffset(new Response(null, { status: 308, headers: { range } }), 100));
});

async function driveMock(t, { loseFinalResponse = false, expireSession = false, noProgress = false } = {}) {
  const dir = await temporary(t); const tokenPath = join(dir, "google-token.json");
  await saveJson(tokenPath, { client_id: CLIENT.client_id, access_token: "fake-access", refresh_token: "fake-refresh", expires_at: Date.now() + 3600000 });
  const calls = []; let stored = null; let metadata; let received = 0; let lost = false;
  const file = { id: FILE_ID, name: job.name, size: String(CHUNK_BYTES + 16), md5Checksum: "md5", parents: [FOLDER], appProperties: { netixJob: "fingerprint" } };
  const request = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, "manual"); assert.equal(options.headers.Authorization, "Bearer fake-access");
    if (url.includes("/files/generateIds?")) return Response.json({ ids: [FILE_ID] });
    if (url.includes(`/files/${FILE_ID}?`)) return stored ? Response.json(stored) : new Response(null, { status: 404 });
    if (options.method === "POST") { metadata = JSON.parse(options.body); return new Response(null, { headers: { location: SESSION } }); }
    if (options.headers["Content-Range"]?.startsWith("bytes */")) return expireSession ? new Response(null, { status: 404 }) : new Response(null, { status: 308, headers: received ? { range: `bytes=0-${received - 1}` } : {} });
    if (options.method === "PUT") {
      if (noProgress) return new Response(null, { status: 308 });
      assert.equal(options.body.length, Number(options.headers["Content-Length"]));
      received += options.body.length;
      if (received >= Number(file.size)) {
        stored = { ...file, ...metadata };
        if (loseFinalResponse && !lost) { lost = true; throw new Error("Connection lost after Google stored final bytes"); }
        return Response.json(stored);
      }
      return new Response(null, { status: 308, headers: { range: `bytes=0-${received - 1}` } });
    }
    throw new Error("Unexpected Google request");
  };
  const drive = new DriveClient(CLIENT, tokenPath, { request });
  const path = join(dir, "video.mp4"); await writeFile(path, Buffer.alloc(CHUNK_BYTES + 16));
  return { drive, calls, path, file, get received() { return received; } };
}

test("large Drive uploads use 8 MiB chunks, stable generated ID, unchanged sharing and final checksum verification", async t => {
  const fake = await driveMock(t); const checkpoint = {}; let saves = 0;
  const result = await fake.drive.upload({ path: fake.path, name: job.name, folderId: FOLDER, fingerprint: "fingerprint", md5: "md5", checkpoint }, async () => saves++);
  assert.equal(result.fileId, FILE_ID); assert.equal(saves, 2);
  const puts = fake.calls.filter(call => call.options.method === "PUT");
  assert.equal(puts[0].options.body.length, CHUNK_BYTES); assert.equal(puts[1].options.body.length, 16);
  assert.equal(puts[0].options.headers["Content-Range"], `bytes 0-${CHUNK_BYTES - 1}/${CHUNK_BYTES + 16}`);
  assert.equal(puts[1].options.headers["Content-Range"], `bytes ${CHUNK_BYTES}-${CHUNK_BYTES + 15}/${CHUNK_BYTES + 16}`);
  const metadata = JSON.parse(fake.calls.find(call => call.options.method === "POST").options.body);
  assert.equal(metadata.id, FILE_ID); assert.deepEqual(metadata.parents, [FOLDER]); assert.equal(metadata.appProperties.netixJob, "fingerprint");
  assert.equal(fake.calls.some(call => /permissions/.test(call.url) || call.options.method === "DELETE"), false);
});

test("lost final responses reconcile via the same file ID, avoiding duplicate uploads", async t => {
  const fake = await driveMock(t, { loseFinalResponse: true }); const checkpoint = {};
  const input = { path: fake.path, name: job.name, folderId: FOLDER, fingerprint: "fingerprint", md5: "md5", checkpoint };
  await assert.rejects(fake.drive.upload(input, async () => {}), /Connection lost/);
  assert.equal((await fake.drive.upload(input, async () => {})).fileId, FILE_ID);
  assert.equal(fake.calls.filter(call => call.options.method === "POST").length, 1);
  assert.equal(fake.calls.filter(call => call.url.includes("generateIds")).length, 1);
});

test("expired resumable sessions reuse the same file ID; nonprogress stops without an infinite loop", async t => {
  const fake = await driveMock(t, { expireSession: true });
  const checkpoint = { fileId: FILE_ID, session: SESSION };
  assert.equal((await fake.drive.upload({ path: fake.path, name: job.name, folderId: FOLDER, fingerprint: "fingerprint", md5: "md5", checkpoint }, async () => {})).fileId, FILE_ID);
  assert.equal(fake.calls.some(call => call.url.includes("generateIds")), false);
  const stuck = await driveMock(t, { noProgress: true });
  await assert.rejects(stuck.drive.upload({ path: stuck.path, name: job.name, folderId: FOLDER, fingerprint: "fingerprint", md5: "md5", checkpoint: {} }, async () => {}), /no valid progress/);
});

test("resumed uploads query Google and send only unacknowledged bytes", async t => {
  const fake = await driveMock(t);
  let checkpoint = { fileId: FILE_ID, session: SESSION };
  let offsetQuery = false; let finalPut = false;
  fake.drive.request = async (url, options) => {
    if (url.includes(`/files/${FILE_ID}?`)) return finalPut ? Response.json(fake.file) : new Response(null, { status: 404 });
    if (options.headers["Content-Range"]?.startsWith("bytes */")) { offsetQuery = true; return new Response(null, { status: 308, headers: { range: `bytes=0-${CHUNK_BYTES - 1}` } }); }
    assert.equal(options.headers["Content-Range"], `bytes ${CHUNK_BYTES}-${CHUNK_BYTES + 15}/${CHUNK_BYTES + 16}`); assert.equal(options.body.length, 16); finalPut = true; return Response.json(fake.file);
  };
  await fake.drive.upload({ path: fake.path, name: job.name, folderId: FOLDER, fingerprint: "fingerprint", md5: "md5", checkpoint }, async () => {});
  assert.equal(offsetQuery, true); assert.equal(finalPut, true);
});

test("Drive validation rejects foreign, wrong-folder, trashed and mismatched files", async t => {
  const fake = await driveMock(t);
  for (const overrides of [{ md5Checksum: "bad" }, { size: "1" }, { parents: ["other"] }, { appProperties: {} }, { trashed: true }]) assert.throws(() => fake.drive.validateFile({ ...fake.file, ...overrides }, FOLDER, "fingerprint", Number(fake.file.size), "md5"), /verification/);
});

test("OAuth refresh occurs once after 401 and credentials never follow redirects to other origins", async t => {
  const dir = await temporary(t); const tokenPath = join(dir, "token.json");
  await saveJson(tokenPath, { client_id: CLIENT.client_id, access_token: "old", refresh_token: "refresh", expires_at: Date.now() + 3600000 });
  let apiCalls = 0; let refreshes = 0;
  const drive = new DriveClient(CLIENT, tokenPath, { request: async (url, options) => {
    if (url === "https://oauth2.googleapis.com/token") { refreshes++; assert.equal(options.redirect, "error"); return Response.json({ access_token: "new", expires_in: 3600 }); }
    apiCalls++; assert.equal(options.redirect, "manual"); return new Response(null, { status: apiCalls === 1 ? 401 : 302, headers: apiCalls === 2 ? { location: "https://evil.org" } : {} });
  } });
  assert.equal((await drive.call("https://www.googleapis.com/drive/v3/files")).status, 302); assert.equal(apiCalls, 2); assert.equal(refreshes, 1);
  await assert.rejects(drive.call("https://evil.org"), /origin/); assert.equal(apiCalls, 2);
});

function queueDrive() {
  const files = new Map(); let uploads = 0;
  return {
    files, get uploads() { return uploads; },
    folder: async () => ({}), file: async id => files.get(id),
    validateFile(file, folderId, fingerprint, bytes, md5) { assert.equal(file.fingerprint, fingerprint); assert.equal(file.bytes, bytes); assert.equal(file.md5, md5); return file; },
    async upload({ path, fingerprint, md5 }) { uploads++; const file = { fileId: FILE_ID, fingerprint, bytes: (await stat(path)).size, md5, url: `https://drive.google.com/file/d/${FILE_ID}/view` }; files.set(FILE_ID, file); return file; },
  };
}

test("batch continues after blocked sources, persists results, retains originals and skips verified completed jobs", async t => {
  const dir = await temporary(t); const localPath = join(dir, "original.mp4"); await writeFile(localPath, video);
  const local = { id: "local", name: "Local.mp4", path: localPath, tmdbId: 42 };
  const drive = queueDrive(); const workdir = join(dir, "worker");
  const options = { maxBytes: 1000, log: noLog, download: async () => { throw new Error("blocked: source HTTP 403"); } };
  const results = await runBatch(manifest([job, local]), workdir, drive, options);
  assert.deepEqual(results.map(item => item.status), ["blocked", "completed"]); assert.equal(drive.uploads, 1);
  assert.equal((await runBatch(manifest([local]), workdir, drive, options))[0].status, "skipped"); assert.equal(drive.uploads, 1);
  assert.deepEqual(await readFile(localPath), video); await assert.rejects(access(join(workdir, "worker.lock")));
  const state = JSON.parse(await readFile(join(workdir, "state.json"), "utf8"));
  assert.equal(state.jobs[job.id].status, "blocked"); assert.equal(state.jobs.local.status, "completed");
  await assert.rejects(runBatch(manifest([{ ...local, name: "Changed.mp4" }]), workdir, drive, options), /source changed/);
});

test("batch checks Drive access before any download and never starts concurrent workers in the same directory", async t => {
  const dir = await temporary(t); let downloads = 0;
  await assert.rejects(runBatch(manifest([job]), dir, { folder: async () => { throw new Error("No folder access"); } }, { maxBytes: 1000, download: async () => downloads++ }), /No folder access/);
  assert.equal(downloads, 0); await assert.rejects(access(join(dir, "worker.lock")));
  await writeFile(join(dir, "worker.lock"), "another worker");
  await assert.rejects(runBatch(manifest([job]), dir, queueDrive(), { maxBytes: 1000 }), /locked/);
  assert.equal(await readFile(join(dir, "worker.lock"), "utf8"), "another worker");
});

test("default preview does not create worker files, fetch movie sources or require OAuth credentials", async t => {
  const dir = await temporary(t); const path = join(dir, "manifest.json"); const workdir = join(dir, "worker");
  await writeFile(path, JSON.stringify(manifest([job]))); const logs = [];
  await main({ manifest: path, workdir, maxGiB: 20 }, { log: line => logs.push(line) });
  assert.ok(logs.some(line => line.startsWith("Preview only"))); await assert.rejects(access(workdir));
});

test("batch byte budgets stop new downloads before writing large bodies", async t => {
  const dir = await temporary(t); let downloaded = false;
  const results = await runBatch(manifest([job]), dir, queueDrive(), { maxBytes: 1000, maxTotalBytes: 20, log: noLog, download: async (_, __, ___, ____, options) => { options.beforeDownload(video.length); downloaded = true; } });
  assert.equal(results[0].status, "failed"); assert.match(results[0].error, /budget exceeded/); assert.equal(downloaded, false);
});
