# NETIX stack migration

## Target

- `apps/web`: React + Vite + TanStack Router/Query
- `apps/api`: NestJS + Better Auth + Drizzle
- PostgreSQL on Neon, configured only through server-side `DATABASE_URL`
- No object storage; existing TMDB/provider URLs remain external

## Safe rollout

The existing Next.js/Supabase app remains available as `npm run dev:legacy` for rollback. The new stack starts with `npm run dev:stack` (API on 3000, web on 5173). Do not remove Supabase or switch the default deployment until route parity, data transfer, and account migration are verified.

## Data/account migration gates

1. Capture a schema-only and data backup from the current Supabase project.
2. Reconcile every live table/column with the legacy migrations and scraper writes before generating/applying Neon migrations. The checked-in SQL is incomplete for tables already referenced by the app.
3. Copy data preserving UUIDs, foreign keys, timestamps, and settings; compare per-table counts and representative records.
4. Better Auth sessions are not compatible with Supabase sessions. Password hashes also need a verified compatibility strategy; otherwise users must reset passwords. Do not delete old auth users until sign-in has been validated.
5. Cut over reads/writes only after staging checks pass; keep Supabase intact until rollback window closes.

## Current implementation boundary

The Vite app now includes home, filtered/paginated catalog, search, trending, network lists/details, login, registration, profile/watchlist/history/settings, legal pages, a basic watch screen with local subtitle selection, and admin dashboard, approval, paginated catalog search/edit/delete, reports, audit, user roles, JSON settings, network classification, Google Drive link management, and a bounded TMDB scraper panel. Nest exposes the corresponding endpoints with Better Auth session checks; settings and user-role changes require super-admin. Site branding, maintenance mode, and registration access flags are read from the public site configuration; Better Auth signup is blocked when registrations are disabled. Player progress events are accepted only from trusted provider origins and saved to account watch history; playback resumes where the selected provider supports `startAt` (Vidlink), while MoviesAPI remains the default. Users can request account deletion from their profile; this removes their watchlist, history, profile, Better Auth account, and sessions. Subtitle files were exported locally (2,485 files, 199,182,297 bytes), are served from the Nest API, and are discoverable for approved content by movie or exact TV episode. The scraper supports batched discovery/trending/network discovery, metadata refresh, provider-link health checks, network reclassification, per-season TV episode synchronization, and Indonesian-first subtitle sync with OpenSubtitles/SubDL fallback, with admin-only logs/provider probes/stop endpoints and pending-by-default catalog imports. `workers/catalog-scheduler` provides an optional Cloudflare Cron Worker that invokes one persisted `scrape` or `trending` batch every six hours. Configure `API_BASE_URL` (the public Nest API origin) and `SCRAPER_SECRET` as Worker secrets; disable the GitHub Actions schedule when enabling Cloudflare scheduling to avoid duplicate triggers. The API itself must already be deployed and reachable; this Worker does not host Nest or access Neon directly.

### Deploying the Cloudflare catalog scheduler

After deploying the Nest API and setting `TMDB_API_KEY`, `DATABASE_URL`, and `SCRAPER_SECRET` in its server environment, run from the repository root:

```sh
npx wrangler@latest login
npx wrangler@latest secret put API_BASE_URL --config workers/catalog-scheduler/wrangler.toml
npx wrangler@latest secret put SCRAPER_SECRET --config workers/catalog-scheduler/wrangler.toml
npx wrangler@latest deploy --config workers/catalog-scheduler/wrangler.toml
```

Set `API_BASE_URL` to the origin of the deployed Nest API (not the Vite frontend). Once the Worker is deployed and verified, disable the GitHub Actions `schedule` trigger to prevent duplicate jobs; keep `workflow_dispatch` as a manual fallback. Rotate any scraper token previously committed in deployment configuration before setting the new `SCRAPER_SECRET` on both API and Worker.

Full feature parity is not reached: the legacy subtitle catalog/provider fallback, some player messages, and old platform-specific cache purge still need an explicit replacement review. The new Nest API does not cache catalog responses, so no equivalent purge endpoint exists yet. Scraper checkpoints are persisted in `scraper_logs.checkpoint`; scheduled requests can resume `scrape` or `trending`, and refresh existing entries' TMDB popularity/rating plus missing descriptive fields without changing approval status or curated titles. E2E passed in local browser against Neon for signup, login, authenticated profile, watchlist/history create-read-delete, self-deletion, public catalog/search/network/trending, watch-page metadata, and local VTT delivery. A disposable-account admin request correctly returned `403`; all temporary test accounts were removed. No authenticated super-admin workflow or scraper mutation was run. MoviesAPI's remote player requests returned `404` and `502` during the browser run, so third-party playback remains unverified. `npm run build`, `npm run build:legacy`, and all 87 repository script tests passed in this run. Scraper refresh, health, reclassification, episode-sync, and external subtitle-sync actions have build proof but were not run against the migrated catalog. Subtitle sync requires `OPENSUBTITLES_API_KEY` and/or `SUBDL_API_KEY`. Password reset email delivery remains unimplemented until an email provider is configured. `apps/api` domain schema was reconciled against the live Supabase REST schema before its additive migration. The root `.env` and `.env.example` are canonical; keep Neon credentials server-side.

The Drizzle schema reconciliations add the missing legacy columns/tables and align numeric catalog fields. `apps/api/scripts/migrate-supabase-data.mjs` imports legacy tables in an idempotent transaction, preserving IDs and timestamps; `npm run data:dry-run --workspace=@netix/api` previews row counts and `npm run data:import --workspace=@netix/api` runs the import. **The import completed and was verified:** 5,352 contents, 41,142 embed links, 6,510 seasons, 179,920 episodes, 163 scraper logs, 4 settings, 2 profiles, and 3 auth users. Foreign-key checks found zero orphan links, seasons, or episodes. User metadata from Supabase Auth is preserved separately in `legacy_auth_metadata`. Source data remains intact. Supabase does not expose password hashes through the Admin API, so existing users need password reset unless a separate supported hash migration is established. The `subtitles` export completed: 2,485 files (199,182,297 bytes) are stored under ignored local API storage and served by Nest. The export script can resume if run again. Neon does not provide object storage.
