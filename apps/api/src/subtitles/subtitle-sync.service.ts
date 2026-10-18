import { Injectable } from "@nestjs/common";
import AdmZip from "adm-zip";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type SubtitleType = "movie" | "tv";
type SubtitleRequest = { id: string; type: SubtitleType; season?: string; episode?: string; relativeBase: string };
type SubtitleResult = { status: "created" | "cached" | "error"; language?: "id" | "en"; reason?: string };

function subtitleRequest(tmdbId: number, type: SubtitleType, season?: number, episode?: number): SubtitleRequest {
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) throw new Error("Invalid TMDB ID.");
  if (type === "tv" && (!Number.isSafeInteger(season) || !season || !Number.isSafeInteger(episode) || !episode)) throw new Error("TV subtitles need a valid season and episode.");
  return {
    id: String(tmdbId), type, season: type === "tv" ? String(season) : undefined, episode: type === "tv" ? String(episode) : undefined,
    relativeBase: type === "movie" ? `movie/${tmdbId}` : `tv/${tmdbId}/s${season}e${episode}`,
  };
}

function toWebVtt(input: string): string {
  if (typeof input !== "string" || input.length > 2 * 1024 * 1024 || input.includes("\0")) throw new Error("Subtitle content is invalid or too large.");
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const cues: string[] = [];
  const time = (parts: string[]) => Number(parts[0]) * 3600000 + Number(parts[1]) * 60000 + Number(parts[2]) * 1000 + Number(parts[3]);
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split("\n");
    const index = lines.findIndex((line) => line.includes("-->"));
    if (index < 0) continue;
    const match = lines[index].match(/^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})\s+-->\s+(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})\s*$/);
    const text = lines.slice(index + 1).join("\n").trim();
    if (!match || !text || time(match.slice(5, 9)) <= time(match.slice(1, 5))) continue;
    cues.push(`${lines[index].trim().replace(/,/g, ".")}\n${text}`);
  }
  if (!cues.length) throw new Error("No valid subtitle cues were found.");
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

@Injectable()
export class SubtitleSyncService {
  private readonly openSubtitlesKey = process.env.OPENSUBTITLES_API_KEY;
  private readonly subdlKey = process.env.SUBDL_API_KEY;

  private async storageRoot() {
    const candidates = [
      path.resolve(__dirname, "../../storage/subtitles"),
      path.resolve(__dirname, "../../../storage/subtitles"),
      path.resolve(__dirname, "../../../../storage/subtitles"),
    ];
    for (const candidate of candidates) {
      try { await access(candidate); return candidate; } catch { /* Resolve source vs compiled output. */ }
    }
    throw new Error("Subtitle storage is unavailable.");
  }

  private async request(url: string, init: RequestInit = {}, timeout = 8000) {
    return fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  }

  private async getOpenSubtitles(request: SubtitleRequest, language: "id" | "en") {
    if (!this.openSubtitlesKey) throw new Error("OpenSubtitles API key is not configured.");
    const params = new URLSearchParams({ [request.type === "tv" ? "parent_tmdb_id" : "tmdb_id"]: request.id, languages: language, order_by: "download_count", order_direction: "desc" });
    if (request.type === "tv") { params.set("season_number", request.season!); params.set("episode_number", request.episode!); }
    const headers = { "Api-Key": this.openSubtitlesKey, "Content-Type": "application/json", "User-Agent": "NETIX/1.0" };
    const search = await this.request(`https://api.opensubtitles.com/api/v1/subtitles?${params}`, { headers });
    if (!search.ok) throw new Error(`OpenSubtitles search failed (${search.status}).`);
    const results = await search.json() as { data?: { attributes?: { language?: string; files?: { file_id: number }[] } }[] };
    const match = results.data?.find((entry) => entry.attributes?.language === language);
    const fileId = match?.attributes?.files?.[0]?.file_id;
    if (!fileId) throw new Error(`No ${language} subtitle found on OpenSubtitles.`);
    const download = await this.request("https://api.opensubtitles.com/api/v1/download", { method: "POST", headers, body: JSON.stringify({ file_id: fileId }) });
    if (!download.ok) throw new Error(`OpenSubtitles download request failed (${download.status}).`);
    const data = await download.json() as { link?: string };
    if (!data.link) throw new Error("OpenSubtitles returned no download link.");
    const target = new URL(data.link);
    if (target.protocol !== "https:" || target.username || target.password || !["opensubtitles.com", "opensubtitles.org"].some((host) => target.hostname === host || target.hostname.endsWith(`.${host}`))) throw new Error("Unexpected OpenSubtitles download host.");
    const file = await this.request(target.toString(), { redirect: "error" });
    if (!file.ok) throw new Error("Could not fetch the OpenSubtitles file.");
    const text = await file.text();
    toWebVtt(text);
    return text;
  }

  private async getSubdl(request: SubtitleRequest, language: "id" | "en") {
    if (!this.subdlKey) throw new Error("SubDL API key is not configured.");
    const params = new URLSearchParams({ api_key: this.subdlKey, tmdb_id: request.id, languages: language.toUpperCase(), type: request.type });
    if (request.type === "tv") { params.set("season_number", request.season!); params.set("episode_number", request.episode!); }
    const response = await this.request(`https://api.subdl.com/api/v1/subtitles?${params}`);
    if (!response.ok) throw new Error(`SubDL search failed (${response.status}).`);
    const data = await response.json() as { status?: boolean; subtitles?: { language?: string; full_season?: boolean; episode?: number; episode_from?: number; episode_end?: number; url?: string }[] };
    const subtitle = data.subtitles?.find((item) => item.language?.toUpperCase() === language.toUpperCase() && (request.type === "movie" || !item.full_season && [item.episode, item.episode_from, item.episode_end].every((value) => !value || Number(value) === Number(request.episode))));
    if (!data.status || !subtitle?.url?.startsWith("/")) throw new Error(`No matching ${language} subtitle found on SubDL.`);
    const downloadUrl = new URL(subtitle.url, "https://dl.subdl.com");
    if (downloadUrl.origin !== "https://dl.subdl.com" || !/^\/(?:sub|subtitle)\/[A-Za-z0-9_.-]+\.zip$/.test(downloadUrl.pathname)) throw new Error("Invalid SubDL download path.");
    const archiveResponse = await this.request(downloadUrl.toString(), { redirect: "error" });
    if (!archiveResponse.ok) throw new Error("Could not download the SubDL archive.");
    const bytes = Buffer.from(await archiveResponse.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) throw new Error("Subtitle archive is too large.");
    const archive = new AdmZip(bytes);
    const entries = archive.getEntries();
    if (entries.length > 200) throw new Error("Subtitle archive contains too many files.");
    for (const entry of entries) {
      if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith(".srt") && entry.header.size <= 2 * 1024 * 1024) {
        const text = archive.readAsText(entry);
        try { toWebVtt(text); return text; } catch { /* Try another SRT in the archive. */ }
      }
    }
    throw new Error("No valid SRT subtitle was found in the SubDL archive.");
  }

  async sync(tmdbId: number, type: SubtitleType, season?: number, episode?: number): Promise<SubtitleResult> {
    let request: SubtitleRequest;
    try { request = subtitleRequest(tmdbId, type, season, episode); }
    catch (error) { return { status: "error", reason: error instanceof Error ? error.message : "Invalid subtitle request." }; }
    const root = await this.storageRoot();
    const directory = path.resolve(root, request.relativeBase);
    if (!directory.startsWith(`${root}${path.sep}`)) return { status: "error", reason: "Invalid storage path." };
    const idPath = `${directory}_id.vtt`;
    const enPath = `${directory}_en.vtt`;
    let fallback: "id" | "en" | undefined;
    try { await readFile(idPath); return { status: "cached", language: "id" }; } catch { /* Search and cache Indonesian. */ }
    try { await readFile(enPath); fallback = "en"; } catch { /* No English fallback cached yet. */ }

    let text: string | undefined;
    let language: "id" | "en" = "id";
    try { text = await this.getOpenSubtitles(request, "id"); }
    catch {
      try { text = await this.getSubdl(request, "id"); }
      catch {
        if (fallback) return { status: "cached", language: fallback };
        language = "en";
        try { text = await this.getOpenSubtitles(request, "en"); }
        catch { try { text = await this.getSubdl(request, "en"); } catch { return { status: "error", reason: "No Indonesian or English subtitles were found." }; } }
      }
    }
    try {
      const vtt = toWebVtt(text!);
      await mkdir(path.dirname(`${directory}_${language}.vtt`), { recursive: true });
      const target = `${directory}_${language}.vtt`;
      const temporary = `${target}.${process.pid}.partial`;
      await writeFile(temporary, vtt, { flag: "w" });
      await rename(temporary, target);
      return { status: "created", language };
    } catch (error) {
      return { status: "error", reason: error instanceof Error ? error.message : "Could not save subtitle." };
    }
  }
}
