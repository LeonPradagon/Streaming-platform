// Bounded local maintenance using the existing authenticated scraper API.
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function parseOptions(args) {
  const options = { apply: false, metadataLimit: 200, subtitleLimit: 20 };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--help") return { help: true };
    if (flag === "--apply") options.apply = true;
    else if (["--metadata-limit", "--subtitle-limit"].includes(flag)) {
      const number = Number(args[++index]);
      const maximum = flag === "--metadata-limit" ? 500 : 100;
      if (!Number.isInteger(number) || number < 0 || number > maximum) throw new Error(`${flag} must be 0–${maximum}`);
      options[flag === "--metadata-limit" ? "metadataLimit" : "subtitleLimit"] = number;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  return options;
}

export async function runTask(base, secret, task, initialState, log = console.log) {
  let state = initialState;
  const summary = { items_processed: 0, items_added: 0, items_failed: 0, items_skipped: 0, subtitle_id: 0, subtitle_en: 0, subtitle_missing: 0, errors: [] };
  for (let request = 0; request < 200; request++) {
    const response = await fetch(`${base}/api/scraper/run`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify({ task, state }), signal: AbortSignal.timeout(90000) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(`${task}: ${data.error || `HTTP ${response.status}`}`);
    for (const key of Object.keys(summary).filter(key => key !== "errors")) summary[key] += data.summary?.[key] || 0;
    summary.errors.push(...(data.summary?.errors || []).slice(0, Math.max(0, 20 - summary.errors.length)));
    log(`${task}: ${summary.items_processed}/${data.total}, applied ${summary.items_added}, cached/skipped ${summary.items_skipped}, unavailable/errors ${summary.items_failed}`);
    if (!data.hasMore) return summary;
    if (!data.nextState || (data.summary?.items_processed || 0) === 0) throw new Error(`${task}: no progress; stopped instead of looping`);
    state = data.nextState;
  }
  throw new Error(`${task}: batch request limit reached; stopped`);
}

async function main(options) {
  dotenv.config({ path: ".env.local", quiet: true });
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TMDB_API_KEY"]) if (!process.env[name]) throw new Error(`${name} is not configured`);
  const base = process.env.NETIX_URL || "http://127.0.0.1:3000";
  const url = new URL(base);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("NETIX_URL must target a local server; the maintenance secret is never sent to a third-party host.");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const configResult = await client.from("settings").select("value").eq("key", "scraper_config").maybeSingle();
  if (configResult.error) throw new Error("Scraper configuration cannot be read");
  const secret = configResult.data?.value?.scraper_secret || process.env.SCRAPER_SECRET;
  if (!secret) throw new Error("Configure SCRAPER_SECRET before running maintenance");
  const missing = await client.from("contents").select("id,tmdb_id,title,type,status,overview,poster_path,backdrop_path").eq("status", "approved").or("overview.is.null,overview.eq.,poster_path.is.null,poster_path.eq.,backdrop_path.is.null,backdrop_path.eq.").order("popularity", { ascending: false }).limit(options.metadataLimit);
  const popular = await client.from("contents").select("id,tmdb_id,title,type,status").eq("status", "approved").order("popularity", { ascending: false }).limit(options.subtitleLimit);
  if (missing.error || popular.error) throw new Error("Maintenance targets cannot be read");
  const discovery = new URL("https://api.themoviedb.org/3/trending/all/week"); discovery.searchParams.set("api_key", process.env.TMDB_API_KEY);
  const response = await fetch(discovery, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`TMDB trending failed: HTTP ${response.status}`);
  const trending = (await response.json()).results?.filter(item => ["movie", "tv"].includes(item.media_type) && !item.adult) || [];
  const counts = async () => {
    const result = await client.from("contents").select("id", { head: true, count: "exact" });
    if (result.error) throw new Error("Catalog count unavailable");
    return result.count;
  };
  const before = await counts();
  const temp = join(process.env.LOCALAPPDATA || process.cwd(), "Temp", "opencode");
  await mkdir(temp, { recursive: true });
  const output = await mkdtemp(join(temp, "netix-maintenance-"));
  const plan = { before, apply: options.apply, trendingCandidates: trending.length, metadataTargets: missing.data || [], subtitleTargets: popular.data || [], autoApprove: configResult.data?.value?.auto_approve === true };
  await writeFile(join(output, "before.json"), JSON.stringify(plan, null, 2));
  console.log(JSON.stringify({ output, before, apply: options.apply, trendingCandidates: trending.length, metadataTargets: plan.metadataTargets.length, subtitleTargets: plan.subtitleTargets.length, autoApprove: plan.autoApprove }, null, 2));
  if (!options.apply) { console.log("Preview only. Add --apply to run this bounded batch. No records or subtitle files changed."); return; }
  const running = await client.from("scraper_logs").select("id").eq("status", "running").limit(1);
  if (running.error || running.data?.length) throw new Error("A scraper job is running or its state cannot be checked. It will not be stopped automatically.");
  const report = {};
  try {
    if (trending.length) report.trending = await runTask(url.origin, secret, "trending", { items: trending });
    if (plan.metadataTargets.length) report.metadata = await runTask(url.origin, secret, "sync", { contents: plan.metadataTargets, fillMissingOnly: true });
    if (plan.subtitleTargets.length) report.subtitles = await runTask(url.origin, secret, "subtitles", { contents: plan.subtitleTargets });
    report.after = await counts();
  } catch (error) { report.error = error.message; throw error; }
  finally { await writeFile(join(output, "results.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ output, ...report }, null, 2)); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log("npm run catalog:refresh -- [--apply] [--metadata-limit 200] [--subtitle-limit 20]\nPreview by default. Imports one trending page, fills only missing metadata, and checks a bounded popular subtitle batch. TV targets use their latest known aired episode. Preserves approvals, existing metadata, videos and Drive files.");
    else await main(options);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
