# NETIX viewer redesign

The approved mobile-first design is integrated into the Next.js application, not served as the separate HTML prototype.

## Scope

- Home, browse/grid/list/filter, search, trending, network collections, watch/player, recommendations, profile/history/watchlist/settings, login, registration, legal pages, and loading states.
- Shared charcoal/coral tokens and Plus Jakarta Sans in `src/app/viewer.css`. Viewer styles are scoped separately from administration; existing admin theme settings remain intact.
- `ContentRow` owns consistent cards, heading-level centered SVG arrows, boundary states, and mouse dragging through `src/lib/useShelf.ts`. Touch scrolling and ordinary poster/keyboard clicks remain native.
- Existing Supabase queries, authentication actions, scraper, subtitle service, and player providers remain in use. No database schema or dependency changes. Optional `backdrop_path` on stored items supports landscape continue-watching cards; older stored items still render.
- Existing local changes to search, watch, backend, configuration, and admin files were retained. No commit, push, or deployment.

## Verification

```powershell
npm run build
node --test scripts/use-shelf.test.mjs
node --test scripts/viewer-improvements.test.mjs
node scripts/viewer-smoke.mjs
```

The browser check requires a running application (`npm run dev`) and Chrome or Edge. Set `VIEWER_URL` or `CHROME_BIN` to override their locations. It opens an isolated signed-out browser profile, not the user's browser account. Synthetic history/watchlist fixtures stay in that isolated profile; no accounts are created.

Verification passed: production build, eight shelf regression tests, and 39 browser checks. Home tested at 390/768/1024/1280/1920 px; viewer/account/legal routes tested at 390/1280 px. Checks cover uniform posters, centered arrows, overflow, trusted mouse drag and click suppression, ordinary poster navigation, filters preserving sort/view, profile tabs and legacy watchlist URLs, guest watchlist add/remove, and series episode/server navigation. Screenshots and results are written beneath `%LOCALAPPDATA%\Temp\opencode\netix-viewer-*`.

## Browsing and playback improvements

- Header autocomplete searches approved catalog titles after two characters, debounces for 300 ms, cancels stale requests, and supports keyboard selection and dismissal. It uses a bounded 24-entry, 60-second in-memory search cache. Enter without a selection opens the full catalog search. Full search retains available catalog results if external TMDB suggestions fail.
- History now records seconds, duration, and season/episode-specific positions locally. Merely revisiting a title no longer erases progress. Same-page listeners and other tabs update when history changes. Existing cloud progress writes remain in place, but this release does not restore progress across devices.
- Continue-watching links retain the last episode. Resume uses VidLink's documented `startAt` parameter only. Other providers are not assumed to support seeking; a saved-position notice offers VidLink when available. Provider-owned saved progress/cookies can take precedence over `startAt`, so the app cannot guarantee seeking inside every embed.
- Playback messages must originate from the active iframe and its exact allowed origin. Invalid times, mismatched titles, and mismatched episodes are ignored. Both documented VidLink event formats and the existing flat message format are supported; local saves are throttled and flushed on pause, seek, page exit, and unmount.
- Recommendations rank matching genres/types from recent history and watchlist, excluding already watched or saved titles. They reuse the homepage's approved catalog data; no AI service or additional catalog request is introduced.
- Homepage data streams behind a skeleton instead of delaying the whole page. Unused cast payloads are no longer fetched for shelves. Settings reads are deduplicated within each server request, and poster links no longer eagerly prefetch expensive watch pages/subtitle work. No cross-user settings cache is introduced.

Current verification: production build, **22 regression tests and 42 browser checks**. Additional browser checks cover keyboard autocomplete, recommendation exclusions, and simulated valid/invalid provider progress followed by a restored VidLink resume URL. Simulated provider messages verify the application's integration contract, not real third-party playback or successful seeking.

Google Drive movie playback and a local FFmpeg preparation script are now implemented; see `docs/google-drive-video.md`. Uploading remains manual. No movie is downloaded from an existing embed, and no Drive file or database record was changed during verification. Import requires authorized video source files; embed URLs are not treated as downloadable media files.

Catalog/subtitle maintenance has subsequently been implemented and an authorized bounded live batch has updated catalog metadata and subtitle storage; see `docs/catalog-subtitles.md` for exact counts and limitations. Indonesian cache upgrades, per-episode lookup, pagination, honest language status, and role-checked maintenance endpoints are covered. This did not download or upload any movie file to Drive.

External-provider playback and real-account login/signup were not certified by these checks. Their existing integrations remain unchanged. Build reports the existing Next.js middleware-convention and Node deprecation warnings.
