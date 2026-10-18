// Local queue: direct file downloads -> resumable Google Drive uploads.
import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createReadStream } from "node:fs";
import { open, lstat, stat, statfs, mkdir, link, unlink, realpath } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { authorizeDrive, desktopClient, DriveClient, readJson, saveJson } from "./lib/google-drive-upload.mjs";

export const HELP = `Local batch downloads and Google Drive uploads (Node >=20).
npm run drive:batch -- --manifest drive-batch.example.json
npm run drive:batch -- --manifest drive-batch.example.json --check-sources
npm run drive:batch -- --authorize --credentials "D:\\Keys\\google-drive-desktop.json"
npm run drive:batch -- --manifest drive-batch.example.json --apply

Preview by default. --check-sources probes only the first 1 KiB, no OAuth required.
Set GOOGLE_DRIVE_CLIENT_JSON in .env.local or pass --credentials.
--workdir <path> defaults to .netix-drive (private tokens/checkpoints/downloads).
--max-gib <number> caps EACH file; default 20, maximum 100.
--max-total-gib <number> caps new job bytes per run; default 100, maximum 1000.
Only direct HTTPS MP4/MKV files or local videos. TMDB IDs are metadata, not file sources.
No CAPTCHA/DRM bypass, cookies, HLS extraction, transcoding, deletion or sharing changes.
Interrupted downloads need stable ETag/Last-Modified for safe resume.
Uploads use 8 MiB chunks, a stable Drive file ID and checksum verification.
Completed files remain local. Rerun the same manifest/workdir to skip completed jobs.`;

export function parseOptions(args) {
  const options = { workdir: ".netix-drive", maxGiB: 20, maxTotalGiB: 100 };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (["--help", "-h"].includes(flag)) return { help: true };
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (["--apply", "--check-sources", "--authorize"].includes(flag)) options[{ "--apply": "apply", "--check-sources": "checkSources", "--authorize": "authorize" }[flag]] = true;
    else if (["--manifest", "--credentials", "--workdir", "--max-gib", "--max-total-gib"].includes(flag)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value: ${flag}`);
      const key = { "--max-gib": "maxGiB", "--max-total-gib": "maxTotalGiB" }[flag] || flag.slice(2);
      options[key] = flag.endsWith("-gib") ? Number(value) : value;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  if (!Number.isFinite(options.maxGiB) || options.maxGiB <= 0 || options.maxGiB > 100) throw new Error("--max-gib must be greater than 0 and at most 100.");
  if (!Number.isFinite(options.maxTotalGiB) || options.maxTotalGiB <= 0 || options.maxTotalGiB > 1000) throw new Error("--max-total-gib must be greater than 0 and at most 1000.");
  if ([options.apply, options.checkSources, options.authorize].filter(Boolean).length > 1) throw new Error("Choose only one of --apply, --check-sources or --authorize.");
  if (!options.authorize && !options.manifest) throw new Error("Provide --manifest <json>, or use --authorize first.");
  return options;
}

export function directUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || !url.hostname.includes(".") || isIP(url.hostname.replace(/^\[|\]$/g, "")) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)) throw new Error("Source must be a public HTTPS file URL without credentials or custom ports.");
  return url.toString();
}

export function validateManifest(json, directory) {
  if (json?.version !== 1 || typeof json.folderId !== "string" || !/^[A-Za-z0-9_-]{10,200}$/.test(json.folderId) || !Array.isArray(json.jobs) || !json.jobs.length || json.jobs.length > 500) throw new Error("Manifest requires version 1, a Drive folder ID and 1–500 jobs.");
  const seen = new Set();
  const jobs = json.jobs.map(job => {
    if (!job || typeof job.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(job.id) || ["__proto__", "constructor", "prototype"].includes(job.id) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(job.id) || seen.has(job.id)) throw new Error("Job IDs must be unique safe names (1–80 letters, digits, underscores or hyphens).");
    seen.add(job.id);
    if (Boolean(job.url) === Boolean(job.path)) throw new Error(`${job.id}: choose exactly one source: url or path.`);
    if (typeof job.name !== "string" || basename(job.name) !== job.name || /[<>:"/\\|?*\x00-\x1f]/.test(job.name) || !/\.(mp4|mkv)$/i.test(job.name) || job.name.length > 180) throw new Error(`${job.id}: name must be a safe MP4/MKV filename.`);
    if (job.tmdbId !== undefined && (!Number.isSafeInteger(job.tmdbId) || job.tmdbId <= 0)) throw new Error(`${job.id}: tmdbId must be a positive integer.`);
    if (job.path && (typeof job.path !== "string" || /^[a-z]+:\/\//i.test(job.path))) throw new Error(`${job.id}: path must be a local file path.`);
    return { id: job.id, name: job.name, ...(job.tmdbId ? { tmdbId: job.tmdbId } : {}), ...(job.url ? { url: directUrl(job.url) } : { path: resolve(directory, job.path) }) };
  });
  return { version: 1, folderId: json.folderId, jobs };
}

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && [0, 168].includes(b) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19, 51].includes(b) || a === 203 && b === 0);
  }
  // Only globally routable IPv6; exclude documentation and mapped/private addresses.
  return isIP(address) === 6 && /^[23]/.test(address) && !address.toLowerCase().startsWith("2001:db8:");
}

export async function publicFetch(input, options, { request = fetch, resolveHost = lookup } = {}) {
  let url = directUrl(input);
  for (let redirect = 0; redirect <= 5; redirect++) {
    const addresses = await resolveHost(new URL(url).hostname, { all: true });
    if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error("Source resolves to a non-public address; request blocked.");
    const response = await request(url, { ...options, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const next = response.headers.get("location");
    await response.body?.cancel();
    if (!next) throw new Error("Download redirect is missing its destination.");
    url = directUrl(new URL(next, url).toString());
  }
  throw new Error("Too many download redirects.");
}

export function fileSignature(bytes, name) {
  return name.toLowerCase().endsWith(".mp4") ? bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp" : bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
}

function mediaResponse(response) {
  if ([401, 403].includes(response.status)) throw new Error(`blocked: source HTTP ${response.status}; complete required authorization/verification or choose another direct source. No bypass is attempted.`);
  if (![200, 206].includes(response.status)) throw new Error(`Source HTTP ${response.status}.`);
  if (/html|json|javascript|text\//i.test(response.headers.get("content-type") || "")) throw new Error("blocked: source returned a webpage/challenge, not a video file.");
  if (response.headers.get("content-encoding") && response.headers.get("content-encoding") !== "identity") throw new Error("Encoded download body cannot be safely resumed as file bytes.");
}

export async function probeSource(job, maxBytes, dependencies = {}) {
  if (job.path) {
    const file = await open(await realpath(job.path), "r");
    try {
      const info = await file.stat();
      const bytes = Buffer.alloc(16); await file.read(bytes, 0, 16, 0);
      if (!info.isFile() || !info.size || info.size > maxBytes || !fileSignature(bytes, job.name)) throw new Error("Local video failed size/container checks.");
      return { bytes: info.size, source: "local" };
    } finally { await file.close(); }
  }
  const response = await publicFetch(job.url, { headers: { Range: "bytes=0-1023", "Accept-Encoding": "identity" }, signal: dependencies.signal ? AbortSignal.any([dependencies.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) }, dependencies);
  try {
    mediaResponse(response);
    const range = response.headers.get("content-range")?.match(/^bytes 0-\d+\/(\d+)$/);
    const size = response.status === 206 ? Number(range?.[1]) : Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes) throw new Error("Source size is unknown or exceeds --max-gib.");
    const reader = response.body.getReader();
    let head = Buffer.alloc(0);
    try { while (head.length < 16) { const { value, done } = await reader.read(); if (done) break; head = Buffer.concat([head, Buffer.from(value).subarray(0, 16 - head.length)]); } }
    finally { await reader.cancel(); }
    if (!fileSignature(head, job.name)) throw new Error("blocked: downloaded bytes are not the expected MP4/MKV container.");
    return { bytes: size, source: "https", resumable: response.status === 206 };
  } catch (error) { if (!response.body?.locked) await response.body?.cancel(); throw error; }
}

export async function mediaDigest(path, name, maxBytes) {
  const before = await stat(path);
  if (!before.isFile() || !before.size || before.size > maxBytes) throw new Error("Local file is empty or exceeds --max-gib.");
  const hash = createHash("md5");
  let head = Buffer.alloc(0);
  for await (const bytes of createReadStream(path)) { if (head.length < 16) head = Buffer.concat([head, bytes.subarray(0, 16 - head.length)]); hash.update(bytes); }
  const after = await stat(path);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error("Local video changed while computing its checksum.");
  if (!fileSignature(head, name)) throw new Error("Local file is not the expected MP4/MKV container.");
  return { bytes: before.size, md5: hash.digest("hex"), mtimeMs: before.mtimeMs };
}

async function exists(path) {
  try { const info = await lstat(path); if (info.isSymbolicLink() || !info.isFile()) throw new Error("Worker media path must be a regular file, not a symbolic link or directory."); return info; }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export async function downloadVideo(job, destination, checkpoint, save, { signal, maxBytes, beforeDownload = () => {}, log = () => {}, ...dependencies } = {}) {
  if (await exists(destination)) {
    if (!checkpoint.total || (await stat(destination)).size !== checkpoint.total) throw new Error("An unexpected destination already exists. Nothing was overwritten.");
    return destination;
  }
  const partial = `${destination}.part`;
  const offset = (await exists(partial))?.size || 0;
  if (offset && !checkpoint.validator) throw new Error("Partial download has no stable validator. It cannot be safely resumed; preserve it and use a new job ID to restart.");
  if (checkpoint.total && offset === checkpoint.total) {
    await mediaDigest(partial, job.name, maxBytes);
    await link(partial, destination); await unlink(partial); return destination;
  }
  const controller = new AbortController();
  let timeout;
  const heartbeat = () => { clearTimeout(timeout); timeout = setTimeout(() => controller.abort(), 60000); };
  heartbeat();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const headers = { "Accept-Encoding": "identity", ...(offset ? { Range: `bytes=${offset}-`, "If-Range": checkpoint.validator } : {}) };
  let response;
  let file;
  try {
    signal?.throwIfAborted();
    response = await publicFetch(job.url, { headers, signal: controller.signal }, dependencies);
    mediaResponse(response);
    const range = response.headers.get("content-range")?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    const total = response.status === 206 ? Number(range?.[3]) : Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(total) || total <= 0 || total > maxBytes) throw new Error("Download size is unknown or exceeds --max-gib.");
    if (offset && (response.status !== 206 || Number(range?.[1]) !== offset || total !== checkpoint.total)) throw new Error("Source did not honor the exact resume range. Partial file preserved; no append performed.");
    if (!offset && response.status === 206 && Number(range?.[1]) !== 0) throw new Error("Source started at an unexpected byte offset.");
    const etag = response.headers.get("etag");
    const validator = etag && !etag.startsWith("W/") ? etag : response.headers.get("last-modified");
    if (offset && validator !== checkpoint.validator) throw new Error("Source changed since the partial download. No mixed file was appended.");
    const disk = await statfs(dirname(destination));
    if (disk.bavail * disk.bsize < total - offset + 16 * 1024 * 1024) throw new Error("Insufficient local disk space for this download.");
    await beforeDownload(total);
    checkpoint.total = total; checkpoint.validator = validator;
    await save();
    file = await open(partial, offset || await exists(partial) ? "r+" : "wx", 0o600);
    let written = offset;
    let reportAt = offset + 64 * 1024 * 1024;
    for await (const chunk of response.body) {
      heartbeat(); signal?.throwIfAborted();
      if (written + chunk.length > total) throw new Error("Source body exceeds its declared file size.");
      let position = 0;
      while (position < chunk.length) { const result = await file.write(chunk, position, chunk.length - position, written + position); if (!result.bytesWritten) throw new Error("Disk write made no progress."); position += result.bytesWritten; }
      written += chunk.length;
      if (written >= reportAt) { log(`download ${Math.floor(written * 100 / total)}%`); reportAt = written + 64 * 1024 * 1024; }
    }
    if (written !== total) throw new Error("Download ended early. Partial bytes retained for resume.");
    await file.sync(); await file.close(); file = null;
    await mediaDigest(partial, job.name, maxBytes);
    if (await exists(destination)) throw new Error("Destination appeared during download; it was not overwritten.");
    // Exclusive hard-link publication cannot overwrite an output that appeared concurrently.
    await link(partial, destination); await unlink(partial);
    return destination;
  } finally {
    clearTimeout(timeout); signal?.removeEventListener("abort", abort);
    if (file) await file.close();
    if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
  }
}

export function jobFingerprint(folderId, job) {
  return createHash("sha256").update(JSON.stringify([folderId, job.id, job.name, job.url || job.path, job.tmdbId || null])).digest("hex");
}

export async function runBatch(manifest, workdir, drive, { maxBytes, maxTotalBytes = 100 * 1024 ** 3, signal, log = console.log, download = downloadVideo, digest = mediaDigest } = {}) {
  await mkdir(workdir, { recursive: true });
  const lockPath = join(workdir, "worker.lock");
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") throw new Error("This workdir is locked by another run. After a crash, verify no worker is running before removing worker.lock."); throw error; }
  const statePath = join(workdir, "state.json");
  const reportPath = join(workdir, "results.json");
  const report = [];
  let reservedBytes = 0;
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
    const state = await readJson(statePath, { version: 1, jobs: {} });
    if (state.version !== 1 || !state.jobs || typeof state.jobs !== "object" || Array.isArray(state.jobs)) throw new Error("Unrecognized checkpoint format; existing state was not replaced.");
    const save = () => saveJson(statePath, state);
    await drive.folder(manifest.folderId); // Fail before downloading anything when Drive setup is invalid.
    const downloads = join(workdir, "downloads"); await mkdir(downloads, { recursive: true });
    for (const job of manifest.jobs) {
      signal?.throwIfAborted();
      const fingerprint = jobFingerprint(manifest.folderId, job);
      const record = Object.hasOwn(state.jobs, job.id) ? state.jobs[job.id] : undefined;
      if (record && record.fingerprint !== fingerprint) throw new Error(`${job.id}: destination/source changed for this job ID. Use a new ID/workdir; prior state was preserved.`);
      const entry = record || (state.jobs[job.id] = { fingerprint, download: {}, upload: {} });
      const progress = message => log(`${job.id}: ${message}`);
      let reserved = false;
      const reserve = bytes => {
        if (reserved) return;
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > maxBytes) throw new Error("Video exceeds the per-file byte limit.");
        if (reservedBytes + bytes > maxTotalBytes) throw new Error("Batch byte budget exceeded. Raise --max-total-gib deliberately or rerun; completed files are retained.");
        reservedBytes += bytes; reserved = true;
      };
      try {
        if (entry.result) {
          const file = await drive.file(entry.result.fileId);
          const verified = drive.validateFile(file, manifest.folderId, fingerprint, entry.result.bytes, entry.result.md5);
          report.push({ id: job.id, tmdbId: job.tmdbId, status: "skipped", ...verified }); progress("already uploaded; verified and skipped"); continue;
        }
        entry.status = "running"; delete entry.error; await save();
        if (job.path) reserve((await stat(job.path)).size);
        const path = job.path ? await realpath(job.path) : await download(job, join(downloads, `${job.id}${extname(job.name).toLowerCase()}`), entry.download, save, { signal, maxBytes, beforeDownload: reserve, log: progress });
        const check = await digest(path, job.name, maxBytes);
        reserve(check.bytes);
        if (entry.md5 && entry.md5 !== check.md5) throw new Error("Source checksum changed after an earlier upload attempt. Use a new job ID.");
        entry.md5 = check.md5; await save();
        const result = await drive.upload({ path, name: job.name, folderId: manifest.folderId, fingerprint, md5: check.md5, checkpoint: entry.upload }, save, progress);
        entry.result = result; entry.status = "completed"; delete entry.upload.session; await save();
        report.push({ id: job.id, tmdbId: job.tmdbId, status: "completed", ...result }); progress(`uploaded: ${result.url}`);
      } catch (error) {
        // Do not print exception text containing source tokens or resumable-session secrets.
        const safe = String(error.message || "Operation failed").replace(/https?:\/\/\S+/g, "[redacted URL]");
        entry.status = safe.startsWith("blocked:") ? "blocked" : "failed"; entry.error = safe; await save();
        report.push({ id: job.id, tmdbId: job.tmdbId, status: entry.status, error: safe }); progress(safe);
        if (signal?.aborted) throw error;
      } finally { await saveJson(reportPath, { folderId: manifest.folderId, jobs: report }); }
    }
    return report;
  } finally { await lock.close(); await unlink(lockPath); }
}

export async function main(options, { signal, log = console.log } = {}) {
  dotenv.config({ path: ".env.local", quiet: true });
  const workdir = resolve(options.workdir);
  const tokenPath = join(workdir, "google-token.json");
  const credentials = options.credentials || process.env.GOOGLE_DRIVE_CLIENT_JSON;
  const maxBytes = Math.floor(options.maxGiB * 1024 ** 3);
  if (options.authorize) {
    if (!credentials) throw new Error("Provide --credentials <Desktop OAuth JSON> or GOOGLE_DRIVE_CLIENT_JSON. Browser login alone does not authorize Drive API uploads.");
    await authorizeDrive(desktopClient(await readJson(resolve(credentials))), tokenPath, { signal, log }); return;
  }
  const manifest = validateManifest(await readJson(resolve(options.manifest)), dirname(resolve(options.manifest)));
  log(JSON.stringify({ mode: options.apply ? "apply" : options.checkSources ? "check-sources" : "preview", folderId: manifest.folderId, jobs: manifest.jobs.map(job => ({ id: job.id, name: job.name, tmdbId: job.tmdbId, source: job.path ? "local" : new URL(job.url).hostname })), perFileLimitGiB: options.maxGiB, perRunLimitGiB: options.maxTotalGiB || 100, workdir }, null, 2));
  if (options.checkSources) {
    let failures = 0;
    for (const job of manifest.jobs) {
      signal?.throwIfAborted();
      try { log(JSON.stringify({ id: job.id, status: "accessible", ...await probeSource(job, maxBytes, { signal }) })); }
      catch (error) { failures++; log(JSON.stringify({ id: job.id, status: "blocked-or-unavailable", error: String(error.message).replace(/https?:\/\/\S+/g, "[redacted URL]") })); }
    }
    if (failures) throw new Error(`${failures} source(s) blocked or unavailable. No full movie was downloaded and no Drive file was created.`);
    return;
  }
  if (!options.apply) { log("Preview only. No sources fetched, credentials read, videos downloaded or Drive files created. Use --check-sources before --apply."); return; }
  if (!credentials) throw new Error("Configure GOOGLE_DRIVE_CLIENT_JSON and run --authorize once before --apply.");
  const drive = new DriveClient(desktopClient(await readJson(resolve(credentials))), tokenPath, { signal });
  const results = await runBatch(manifest, workdir, drive, { maxBytes, maxTotalBytes: (options.maxTotalGiB || 100) * 1024 ** 3, signal, log });
  const counts = Object.fromEntries(["completed", "skipped", "blocked", "failed"].map(status => [status, results.filter(job => job.status === status).length]));
  log(JSON.stringify({ ...counts, results: join(workdir, "results.json") }, null, 2));
  if (counts.blocked || counts.failed) throw new Error("Batch ended with blocked/failed jobs. Completed jobs are preserved; rerun after addressing source/access errors.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try { const options = parseOptions(process.argv.slice(2)); if (options.help) console.log(HELP); else await main(options, { signal: controller.signal }); }
  catch (error) { console.error(controller.signal.aborted ? "Canceled. Local files and uploaded files are retained; rerun to resume." : String(error.message).replace(/https?:\/\/\S+/g, "[redacted URL]")); process.exitCode = 1; }
  finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}
