export function subtitleRequest(tmdbId: number | string, type: string, season?: string, episode?: string) {
  const id = String(tmdbId);
  const positive = (value: string) => /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647;
  if (!positive(id) || !["movie", "tv"].includes(type)) throw new Error("ID atau tipe subtitle tidak valid.");
  if (type === "tv" && (!season || !episode || !positive(season) || !positive(episode))) throw new Error("Subtitle serial memerlukan season dan episode yang valid.");
  const folder = type === "tv" ? `tv/${id}` : "movie";
  const prefix = type === "tv" ? `s${season}e${episode}` : id;
  return { id, type: type as "movie" | "tv", season: type === "tv" ? season : undefined, episode: type === "tv" ? episode : undefined, folder, prefix, basePath: `${folder}/${prefix}` };
}

export function subtitleLabel(language?: string) {
  return language === "id" ? "Indonesia" : language === "en" ? "Inggris" : "Subtitle";
}

/** Reject HTML/error responses and malformed timings instead of publishing an empty WEBVTT file. */
export function toWebVtt(input: string): string {
  if (typeof input !== "string" || input.length > 2 * 1024 * 1024 || input.includes("\0")) throw new Error("Isi subtitle tidak valid atau terlalu besar.");
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const cues: string[] = [];
  const time = (parts: string[]) => Number(parts[0]) * 3600000 + Number(parts[1]) * 60000 + Number(parts[2]) * 1000 + Number(parts[3]);
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split("\n");
    const index = lines.findIndex(line => line.includes("-->"));
    if (index < 0) continue;
    const match = lines[index].match(/^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})\s+-->\s+(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})\s*$/);
    const text = lines.slice(index + 1).join("\n").trim();
    if (!match || !text || time(match.slice(5, 9)) <= time(match.slice(1, 5))) continue;
    cues.push(`${lines[index].trim().replace(/,/g, ".")}\n${text}`);
  }
  if (!cues.length) throw new Error("Tidak ada cue subtitle yang valid.");
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}
