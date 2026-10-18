// Local desktop OAuth and bounded-memory Drive uploads. No sharing/deletion operations.
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { open, readFile, rename, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const CHUNK_BYTES = 8 * 1024 * 1024;
const API = "https://www.googleapis.com/drive/v3";
const FILE_FIELDS = "id,name,size,md5Checksum,parents,appProperties,trashed,webViewLink,resourceKey";

export async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT" && fallback !== undefined) return fallback; throw error; }
}

export async function saveJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { flag: "wx", mode: 0o600 });
  await rename(temporary, path);
}

export function desktopClient(json) {
  const client = json?.installed;
  if (typeof client?.client_id !== "string" || !client.client_id.endsWith(".apps.googleusercontent.com") || typeof client.client_secret !== "string" || !client.client_secret) throw new Error("Use the Google OAuth client JSON for a Desktop app, not browser cookies or a service-account key.");
  return { client_id: client.client_id, client_secret: client.client_secret };
}

async function tokenRequest(parameters, signal, request = fetch) {
  const response = await request("https://oauth2.googleapis.com/token", { method: "POST", redirect: "error", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(parameters), signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]) });
  if (!response.ok) throw new Error(`Google OAuth HTTP ${response.status}. Check consent/client configuration; reauthorize if the token was revoked.`);
  const token = await response.json();
  if (typeof token.access_token !== "string" || !(Number(token.expires_in) > 0)) throw new Error("Google returned an invalid OAuth token.");
  return token;
}

export function oauthAuthorization(client, redirect, state, verifier) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [key, value] of Object.entries({ client_id: client.client_id, redirect_uri: redirect, response_type: "code", scope: DRIVE_SCOPE, access_type: "offline", prompt: "consent", state, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url") })) url.searchParams.set(key, value);
  return url.toString();
}

export async function authorizeDrive(client, tokenPath, { signal, log = console.log } = {}) {
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  let finish;
  let rejectCode;
  const code = new Promise((resolve, reject) => { finish = resolve; rejectCode = reject; });
  // Attach a handler immediately, including while the listener is starting.
  code.catch(() => {});
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname !== "/oauth/callback") { response.writeHead(404).end(); return; }
    if (url.searchParams.get("state") !== nonce) { response.writeHead(400).end("Invalid OAuth state."); return; }
    if (url.searchParams.has("error")) { response.writeHead(400).end("Google authorization was denied. Return to the terminal."); rejectCode(new Error("Google authorization was denied.")); return; }
    if (!url.searchParams.get("code")) { response.writeHead(400).end("Missing authorization code."); return; }
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("Authorization received. Return to the NETIX terminal. You may close this tab.");
    finish(url.searchParams.get("code"));
  });
  const stop = () => rejectCode(new Error("Authorization canceled."));
  const timeout = setTimeout(() => rejectCode(new Error("Authorization timed out after 5 minutes. Run --authorize again.")), 300000);
  signal?.addEventListener("abort", stop, { once: true });
  try {
    signal?.throwIfAborted();
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const redirect = `http://127.0.0.1:${server.address().port}/oauth/callback`;
    log("Google will request Drive-wide access for your existing folder. This worker never deletes files or changes sharing. Review the consent screen before approving.");
    log(`Open this URL in your browser on this computer:\n${oauthAuthorization(client, redirect, nonce, verifier)}`);
    const result = await tokenRequest({ ...client, grant_type: "authorization_code", redirect_uri: redirect, code: await code, code_verifier: verifier }, signal);
    if (!result.refresh_token) throw new Error("No refresh token returned. Revoke this app's previous consent and authorize again.");
    if (!(result.scope || "").split(" ").includes(DRIVE_SCOPE)) throw new Error("Drive scope was not granted. No token was stored.");
    await saveJson(tokenPath, { ...result, client_id: client.client_id, expires_at: Date.now() + Number(result.expires_in) * 1000 });
    log("Google authorization saved locally. No movie was downloaded or uploaded by this command.");
  } finally {
    clearTimeout(timeout); signal?.removeEventListener("abort", stop);
    server.closeAllConnections();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
}

export function googleUploadUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:" || !["www.googleapis.com", "content.googleapis.com"].includes(url.hostname) || url.port || url.username || url.password || url.hash || url.pathname !== "/upload/drive/v3/files") throw new Error("Unexpected Google resumable-upload URL. Credentials were not sent.");
  return url.toString();
}

export function uploadOffset(response, size) {
  const range = response.headers.get("range");
  if (!range) return 0;
  const match = range.match(/^bytes=0-(\d+)$/);
  const offset = match ? Number(match[1]) + 1 : NaN;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > size) throw new Error("Google returned an invalid upload offset.");
  return offset;
}

export class DriveClient {
  constructor(client, tokenPath, { request = fetch, signal } = {}) {
    this.client = client; this.tokenPath = tokenPath; this.request = request; this.signal = signal;
  }
  async accessToken(force = false) {
    this.token ||= await readJson(this.tokenPath);
    if (this.token.client_id !== this.client.client_id || !this.token.refresh_token) throw new Error("Token/client mismatch. Run --authorize with this Desktop client.");
    if (force || !this.token.access_token || !Number.isFinite(this.token.expires_at) || this.token.expires_at < Date.now() + 60000) {
      const fresh = await tokenRequest({ ...this.client, grant_type: "refresh_token", refresh_token: this.token.refresh_token }, this.signal, this.request);
      this.token = { ...this.token, ...fresh, expires_at: Date.now() + Number(fresh.expires_in) * 1000 };
      await saveJson(this.tokenPath, this.token);
    }
    return this.token.access_token;
  }
  async call(url, options = {}) {
    // Auth is restricted to exact Google API origins. Never forwards it to media hosts.
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !["www.googleapis.com", "content.googleapis.com"].includes(parsed.hostname) || parsed.port || parsed.username || parsed.password) throw new Error("Unexpected Google API origin.");
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.accessToken(attempt > 0);
      const response = await this.request(url, { ...options, redirect: "manual", headers: { ...options.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.any([AbortSignal.timeout(120000), ...(this.signal ? [this.signal] : [])]) });
      if (response.status !== 401 || attempt === 1) return response;
      await response.body?.cancel();
    }
  }
  async folder(folderId) {
    const response = await this.call(`${API}/files/${folderId}?supportsAllDrives=true&fields=id,mimeType,trashed,capabilities(canAddChildren)`);
    if (!response.ok) throw new Error(`Drive folder check HTTP ${response.status}. Confirm the OAuth account has editor access and available storage.`);
    const folder = await response.json();
    if (folder.trashed || folder.mimeType !== "application/vnd.google-apps.folder" || folder.capabilities?.canAddChildren !== true) throw new Error("Destination must be a writable, non-trashed Drive folder.");
    return folder;
  }
  async file(id) {
    const response = await this.call(`${API}/files/${id}?supportsAllDrives=true&fields=${FILE_FIELDS}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Drive file lookup HTTP ${response.status}.`);
    return response.json();
  }
  async generateId() {
    const response = await this.call(`${API}/files/generateIds?count=1&space=drive&type=files`);
    if (!response.ok) throw new Error(`Drive file-ID allocation HTTP ${response.status}.`);
    const id = (await response.json()).ids?.[0];
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new Error("Invalid generated Drive file ID.");
    return id;
  }
  validateFile(file, folderId, fingerprint, size, md5) {
    if (!file || file.trashed || file.appProperties?.netixJob !== fingerprint || !file.parents?.includes(folderId) || Number(file.size) !== size || file.md5Checksum !== md5) throw new Error("Drive file failed job identity, folder, size or checksum verification. No file was deleted or replaced.");
    return { fileId: file.id, name: file.name, bytes: size, url: `https://drive.google.com/file/d/${file.id}/view${file.resourceKey ? `?resourcekey=${encodeURIComponent(file.resourceKey)}` : ""}`, md5 };
  }
  async upload({ path, name, folderId, fingerprint, md5, checkpoint }, save, log = () => {}) {
    const source = await stat(path);
    const size = source.size;
    if (!source.isFile() || !size) throw new Error("Upload source is not a non-empty local file.");
    if (checkpoint.fileId) {
      const completed = await this.file(checkpoint.fileId);
      if (completed) return this.validateFile(completed, folderId, fingerprint, size, md5);
    } else {
      checkpoint.fileId = await this.generateId();
      await save(); // Stable ID prevents duplicate final files after a lost response or process crash.
    }
    let offset = 0;
    if (checkpoint.session) {
      const response = await this.call(googleUploadUrl(checkpoint.session), { method: "PUT", headers: { "Content-Length": "0", "Content-Range": `bytes */${size}` } });
      if (response.status === 200 || response.status === 201) return this.validateFile(await this.file(checkpoint.fileId), folderId, fingerprint, size, md5);
      if (response.status === 308) offset = uploadOffset(response, size);
      else if ([404, 410].includes(response.status)) { delete checkpoint.session; await save(); }
      else throw new Error(`Drive upload-status HTTP ${response.status}. Rerun to reconcile; no new file ID was allocated.`);
    }
    if (!checkpoint.session) {
      const completed = await this.file(checkpoint.fileId);
      if (completed) return this.validateFile(completed, folderId, fingerprint, size, md5);
      const response = await this.call(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=${FILE_FIELDS}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Upload-Content-Type": name.toLowerCase().endsWith(".mp4") ? "video/mp4" : "video/x-matroska", "X-Upload-Content-Length": String(size) }, body: JSON.stringify({ id: checkpoint.fileId, name, parents: [folderId], appProperties: { netixJob: fingerprint } }) });
      if (!response.ok) throw new Error(`Drive upload initiation HTTP ${response.status}. Rerun to check the stable file ID before creating another session.`);
      checkpoint.session = googleUploadUrl(response.headers.get("location"));
      await save();
    }
    const file = await open(path, "r");
    let reported = Math.floor(offset * 100 / size);
    try {
      while (offset < size) {
        this.signal?.throwIfAborted();
        const current = await file.stat();
        if (current.size !== size || current.mtimeMs !== source.mtimeMs) throw new Error("Local source changed during upload; stopped.");
        const bytes = Buffer.alloc(Math.min(CHUNK_BYTES, size - offset));
        let read = 0;
        while (read < bytes.length) {
          const result = await file.read(bytes, read, bytes.length - read, offset + read);
          if (!result.bytesRead) throw new Error("Local source ended unexpectedly.");
          read += result.bytesRead;
        }
        const response = await this.call(googleUploadUrl(checkpoint.session), { method: "PUT", headers: { "Content-Type": name.toLowerCase().endsWith(".mp4") ? "video/mp4" : "video/x-matroska", "Content-Length": String(bytes.length), "Content-Range": `bytes ${offset}-${offset + bytes.length - 1}/${size}` }, body: bytes });
        if (response.status === 200 || response.status === 201) return this.validateFile(await this.file(checkpoint.fileId), folderId, fingerprint, size, md5);
        if (response.status !== 308) throw new Error(`Drive upload chunk HTTP ${response.status}. Rerun to resume from Google's acknowledged offset.`);
        const next = uploadOffset(response, size);
        if (next <= offset || next > offset + bytes.length) throw new Error("Drive upload made no valid progress; stopped instead of retrying indefinitely.");
        offset = next;
        const percentage = Math.floor(offset * 100 / size);
        if (percentage > reported) { log(`upload ${percentage}%`); reported = percentage; }
      }
      // All bytes acknowledged, but finalization may have been interrupted.
      return this.validateFile(await this.file(checkpoint.fileId), folderId, fingerprint, size, md5);
    } finally { await file.close(); }
  }
}
