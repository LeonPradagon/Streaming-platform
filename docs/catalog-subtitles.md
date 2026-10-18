# Catalog and subtitle maintenance

## Scope

Use the existing TMDB/Supabase catalog and existing embed providers. No movie-file download, DRM bypass, provider replacement, Google credential collection, or Drive upload is performed by catalog maintenance. A TMDB record and a reachable iframe do not prove playable video, subtitles, or redistribution rights.

Initial inspection found 5,339 approved entries, no pending entries, 53 missing posters, 72 missing synopses, 167 missing backdrops, and 179,920 stored episode records. Counts overlap: a title can lack several fields. The configured approval behavior is preserved; new discovery candidates remain pending when `auto_approve` is false.

## Local bounded batch

```powershell
# Inspect and save a plan without changing catalog/subtitle data.
npm run catalog:refresh

# Start a local app first. NETIX_URL defaults to http://127.0.0.1:3000.
$env:NETIX_URL = 'http://127.0.0.1:3001'
npm run catalog:refresh -- --apply --metadata-limit 500 --subtitle-limit 20
```

Requires existing server-side TMDB, Supabase service-role, and scraper credentials in `.env.local`. Credentials are never printed or included in snapshots. The CLI only sends its scraper secret to a loopback app URL. Default preview mode reads configuration, targets, and a single trending page, and writes only a local plan beneath `%LOCALAPPDATA%\Temp\opencode\netix-maintenance-*`. Apply mode adds catalog and subtitle writes through the authenticated scraper API.

The sequence imports one trending page, fills only missing synopsis/poster/backdrop fields, then checks a bounded batch of popular titles for subtitles. Limits cap metadata work at 500 and subtitle work at 100 per invocation; the default subtitle batch is 20. Subtitle providers have quota limits, and not all titles have Indonesian subtitles. Metadata completion preserves existing text/artwork, title, cast, type, approval, and provider links. Empty or failed TMDB responses never clear existing values or report successful writes. `before.json` contains the selected fields' original values; `results.json` contains applied/skipped/unavailable counts. This is a scoped snapshot, not a complete database backup or automatic rollback.

The CLI does not stop other scraper jobs, blindly retry timed-out writes, enable automation, or mass-approve discoveries. Inspect a failed job before resuming it. Open **Admin → Katalog** to review pending discoveries before publication.

## Subtitle behavior

- Indonesian remains the preferred language. A cached English or legacy file no longer prevents an Indonesian search; it is retained as fallback if the search fails. Files without an explicit language suffix are marked unknown, not automatically Indonesian.
- TV searches pass the show ID plus season and episode. OpenSubtitles uses `parent_tmdb_id` for TV searches. Storage paths are per episode, e.g. `tv/42/s2e3_id.vtt`.
- Batch maintenance chooses each series' latest **known aired episode** in the local episode table. Explicit episode targets are also supported. Other episodes are requested when their watch pages are opened. This batch does not claim all 179,920 episodes are subtitled.
- The admin subtitle job paginates approved catalog rows rather than silently stopping at the database's default row limit. The full-catalog job can take substantial time and quota; use a bounded CLI batch for initial work.
- Cached available subtitles count as skipped/cached, not failed downloads. New downloads and actual language counts are separate.
- SRT-to-VTT conversion rejects empty/error/HTML-only responses and malformed cue times. Download hosts and ZIP paths are restricted; oversized archives/entries and season packs are rejected rather than guessed as a single episode.
- Concurrent requests for the same subtitle coalesce. A bounded 256-entry process-local cache retains successful/fallback results for 10 minutes and failures for 5 minutes. Provider fetches have 8-second timeouts and a 25-second shared lookup budget. These are per-process safeguards, not a distributed rate limit; a newly uploaded manual subtitle may take up to the cache TTL to appear.
- The public subtitle API validates identity and only operates on approved catalog entries of the correct media type. It does not accept arbitrary filesystem paths or unapproved TMDB IDs.
- Watch pages show the actual external subtitle language, unavailable status, and a subtitle-file link. English is not labeled Indonesian. A provider may supply its own captions even if NETIX cannot find an external file. Injection, caption selection, and timing compatibility still depend on the third-party player and the exact video release.
- Drive preview does not receive NETIX subtitle injection or provider-specific playback parameters.

## Maintenance endpoint access

Scraper run, stop, health, and automation routes validate the authenticated profile's `super_admin`/`moderator` role; a normal signed-in viewer cannot trigger privileged maintenance. Run/automation endpoints also support the existing configured cron secret. Empty secrets and development mode do not grant access. Existing GET-secret cron callers remain compatible; use Bearer authorization for new callers to avoid placing credentials in URLs. Automation stays disabled if configured that way. Stop/health require an admin session, not a cron token.

POST jobs validate task/state before creating logs, and only resume a running log for the same task. Catalog CRUD/approval server actions and the service-role metadata-sync action also independently require an admin profile. The provider-migration endpoint now requires an admin session; no migration was run. Secret-bearing query strings are omitted from scraper retry logs. These gates do not replace Supabase RLS or constitute an audit of all unrelated admin/backend features; no schema or policy migration was executed.

## Verification and limitations

```powershell
node --test scripts/catalog-subtitles.test.mjs scripts/drive-video.test.mjs scripts/prepare-video.test.mjs scripts/viewer-improvements.test.mjs scripts/use-shelf.test.mjs
npx tsc --noEmit --incremental false
npm run build
```

Tests cover language upgrades/cache coalescing, episode identities, VTT validation, cached-vs-failed accounting, pagination beyond 1,000 rows, preservation of curated metadata, mutation failure reporting, authorization, and bounded CLI operation. Real provider playback, correctly synchronized captions on every release, and Google upload access are separate checks.

The supplied Drive folder opened successfully, but this browser session displayed “Login untuk menambahkan file ke folder ini.” Folder sharing alone did not establish a signed-in upload session. No Google password is requested; sign in directly in the browser. Populating Drive also requires authorized video source files. Existing embed URLs are not treated as downloadable files, and no movie file was downloaded or uploaded by this work.

## Executed batch

The authorized batch checked 20 trending candidates, all **215** approved titles with missing synopsis/artwork, and 20 popular subtitle targets. Catalog size changed from **5,339 to 5,352**, with auto-approval left disabled. Trending reported 15 successful create/update operations, not 15 new records; the net increase was 13. Metadata completion updated 23 records, skipped 185 whose missing fields were still unavailable, and retained seven records whose TMDB lookup returned 404. No records were deleted.

Subtitle maintenance reported 13 new files and seven cached/skipped targets: **17 Indonesian, two English**, and one series skipped without a known aired episode. These counts concern this bounded batch, not the entire catalog or every episode. Provider movie files were not downloaded. A live subtitle API check returned an Indonesian VTT with valid cues; invalid identity/episode requests returned 400 and an unknown approved-catalog lookup returned 404. Live signed-out checks returned 401 for run, stop, health and automation. Anonymous scraper-configuration reads were also denied by the current database policy.

The original selected metadata and the batch report are stored at `%LOCALAPPDATA%\Temp\opencode\netix-maintenance-wsczYn\before.json` and `results.json`. A post-run comparison verified all 215 records: existing title/type/approval and non-empty selected metadata were unchanged, with exactly 23 records receiving missing values. Real-account caption selection and release synchronization remain provider-dependent and unverified end-to-end; the code changes have not been deployed.

Final verification passed: production build, **52 regression tests**, 42 existing viewer browser checks, focused ESLint for the new backend/subtitle code, and a live signed-out 401 check for provider migration. The current development preview runs at `http://127.0.0.1:3001`; no existing process on port 3000 was terminated.
