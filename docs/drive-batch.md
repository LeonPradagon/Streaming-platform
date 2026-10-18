# Automatic local Google Drive queue

The worker processes multiple local videos or direct HTTPS file URLs sequentially, saves checkpoints, resumes supported downloads/uploads, and exports Drive file links with their TMDB IDs. This bypasses the browser tool's 5 MiB transfer limit by using the Drive API directly; it does **not** bypass a source website's protections.

## Current status

- The example targets the supplied folder and **Avengers: Endgame (2019), TMDB 299534**.
- Videasy's player exposes a **Download** button pointing to `https://ddl.cinextream.cc/movie/299534`. That page lists 1080p MKV options of 7.85 GB and 37.78 GB. Its download link is not an official studio release; availability does not establish redistribution permission.
- The smaller file's live source check returned **HTTP 403 / Cloudflare verification**. The worker reports this as blocked. No full movie was downloaded, uploaded, or published by this implementation.
- No Google Desktop OAuth client JSON is currently configured. The signed-in Drive browser does not supply API authorization to this worker. Real-account Drive uploads/resumes remain unverified until OAuth is configured.
- Queue automation is implemented, not a universal TMDB-to-download converter. Each job needs an accessible direct file URL or a local file. It does not decrypt provider responses, extract player/HLS internals, import thousands of catalog IDs, copy browser cookies, solve CAPTCHA, or bypass DRM/access controls.

## One-time Google setup

1. In your own [Google Cloud console](https://console.cloud.google.com/), choose/create a project and enable **Google Drive API**. This worker does not create projects, enable billing, or alter Cloud configuration automatically.
2. Configure the Google Auth Platform consent screen. If the app is in **Testing**, add the Google account you will authorize as a test user. Drive-wide scopes are restricted; an unverified personal/test application can be subject to Google warnings and limits. Do not approve an application you do not control.
3. Create an **OAuth client ID → Desktop app**, then download its JSON to a private location, for example `D:\Keys\google-drive-desktop.json`. Web-client JSON, Drive sharing links, service-account keys and browser login are not substitutes.
4. Add the following **path**, not the JSON contents, to `.env.local`:

   ```dotenv
   GOOGLE_DRIVE_CLIENT_JSON="D:/Keys/google-drive-desktop.json"
   ```

5. Run locally:

   ```powershell
   npm run drive:batch -- --authorize
   ```

   Open the printed Google authorization URL in a browser **on the same computer as the worker**. OAuth uses a temporary loopback callback, random state, and PKCE; no password should be pasted into chat or the terminal. If the browser and terminal run on separate machines, open the URL on the worker machine rather than assuming localhost is shared.

The worker requests `https://www.googleapis.com/auth/drive`, which grants Drive-wide access. This is broader than `drive.file` because the requested shared folder already exists and has not been selected through this app's Google Picker. Review the Google consent screen explicitly. The implemented operations only verify the folder, allocate file IDs, read their upload status, and create files inside the supplied folder. **No delete or sharing/permission operation is implemented.** You can revoke access in your Google account's third-party connections.

OAuth refresh credentials are saved in `.netix-drive/google-token.json` and reused. **Once** means no authorization per film; Google can still revoke/expire tokens. External apps in Testing commonly have refresh tokens that expire after seven days for these scopes, requiring reauthorization. Quota limits or organization policy can also block access.

## Prepare the queue

Copy `drive-batch.example.json` to `drive-batch.local.json`, then add the sources you want processed:

```json
{
  "version": 1,
  "folderId": "1CUMaEPS5S7VyRe65jRPzOOa8QlRdbPuq",
  "jobs": [
    {
      "id": "movie-299534",
      "tmdbId": 299534,
      "name": "Avengers.Endgame.2019.mp4",
      "path": "D:/Videos/Avengers.Endgame.2019.mp4"
    },
    {
      "id": "another-movie",
      "name": "Another.Movie.mp4",
      "url": "https://YOUR-AUTHORIZED-SOURCE.example/video.mp4"
    }
  ]
}
```

`id` is a stable unique queue ID. Each job has exactly one `path` or `url`; relative paths resolve beside the manifest. Names must end in `.mp4` or `.mkv`. The source container must match the extension. `tmdbId` is optional movie-mapping metadata, **not** a download endpoint. Do not use one movie file as a TV series/episode mapping. Keep authorization/rights checks separate from technical file accessibility.

The example's provider URL is retained only to reproduce the known blocked source. Changing its extension to `.mp4` does not convert MKV. There is no automatic encoding: for playback-compatible MP4 use the existing `npm run video:prepare` tool on a sample, review it, then prepare the full file before adding its output to this queue. FFmpeg/FFprobe installation remains required for encoding.

## Preview, check, run

```powershell
# No network/media/Google writes or credential reads.
npm run drive:batch -- --manifest drive-batch.local.json

# Request bytes 0–1023 and stop after the header/container check.
# No full movie download or Drive upload; does not need Google OAuth.
npm run drive:batch -- --manifest drive-batch.local.json --check-sources

# Process all jobs sequentially, with real downloads/uploads.
npm run drive:batch -- --manifest drive-batch.local.json --apply
```

Default limits: **500 jobs**, **20 GiB per file**, **100 GiB of new job bytes per invocation**. The per-run budget conservatively reserves each attempted file's full size, including resumed jobs; failed reservations are not refunded within that run. Completed/verified jobs do not consume it on rerun. Raise limits deliberately when necessary:

```powershell
npm run drive:batch -- --manifest drive-batch.local.json --apply --max-gib 40 --max-total-gib 200
```

Maximum supported limits are 100 GiB per file and 1,000 GiB per run. These are guards, not free storage: check your Google quota and local free disk first. Downloads stay on disk and therefore accumulate. The worker checks local free space before each new/resumed download; Drive can still reject uploads for quota. A 7.85 GB film consumes roughly that much Drive storage, so hundreds of films require substantial storage. The computer must remain on and connected while running.

## Resume and inspect

Use the **same manifest and workdir** to resume:

```powershell
npm run drive:batch -- --manifest drive-batch.local.json --apply
```

- Downloads are written beneath `.netix-drive/downloads/` with `.part` suffixes until complete. Resume requires an exact HTTP range and an unchanged strong ETag or Last-Modified value. Ignored ranges/source changes stop without appending mixed versions. A partial file with no stable validator is retained, but cannot be safely resumed; use a **new job ID** to redownload instead of overwriting it.
- Uploads use **8 MiB** chunks and Google's acknowledged offset. A generated Drive file ID is persisted before upload begins. After a lost final response, the worker checks that same ID and verifies job identity, destination folder, byte count and MD5 instead of blindly creating a duplicate.
- MD5 is used for transfer integrity, not authenticity or malware detection. Container-signature checks do not prove codecs, visual quality, full playability, correct subtitles, or rights.
- Completed jobs are verified and skipped. Changing source/name/folder for an existing ID is refused; use a new ID for a deliberate new file. Keep the workdir: deleting checkpoint state defeats duplicate prevention.
- `.netix-drive/results.json` lists completed/skipped/blocked/failed jobs and successful Drive links with optional TMDB IDs. A per-job source/upload failure does not prevent later jobs from being attempted. Invalid global configuration, a conflicting checkpoint identity, cancellation or failure to save state stops the run. Overall exit status is nonzero if any job failed or was blocked.
- Ctrl+C retains originals, downloaded partials and any Drive file already finalized. A forced crash may leave `worker.lock`; verify no worker process is active **before** manually removing only that lock. Never run two workers against one workdir, or authorize a different account while a worker is running.

Tokens, resumable-session URLs and source links with signed query strings are secrets. Default files are excluded from Git and JSON writes request owner-only permissions; Windows ACLs still depend on the directory. Do not share `.netix-drive`, commit credential JSON, or publish a custom workdir. Custom workdirs/manifest/credential paths need their own ignore rules. Logs redact source/session URLs from failures and show hostnames only during preview.

## NETIX playback

The worker deliberately **does not change catalog approvals, Supabase records or Drive sharing**. Successful links are exported to `results.json`; save each through the existing **Admin → Katalog → Drive** action after confirming the matching movie. Automatic catalog attachment is not implemented in this slice. Wait for Drive processing and grant intended viewers access yourself. MKV preview support, subtitle availability, exact quality and playback traffic remain Google/provider dependent.

## Verification

```powershell
node --test scripts/drive-batch.test.mjs
npx eslint scripts/drive-batch.mjs scripts/lib/google-drive-upload.mjs scripts/drive-batch.test.mjs
npm run drive:batch -- --help
```

Regression tests use temporary video-shaped fixtures and mocked Google requests, including transfers larger than the browser limit, checksum/folder rejection, resume offsets, lost final responses, bounded jobs, blocked sources, original preservation, OAuth PKCE/state, and credential-origin guards. These prove local worker mechanics, not a real-account Google upload or successful Endgame download. The real source check is reported separately above.

Verification: **19 worker tests / 71 total focused regression tests passed**, focused ESLint passed, and the existing production build passed. Default preview made no network/media/Google changes; the live source-only check for TMDB 299534 returned 403. No real OAuth consent, movie upload, sharing change, catalog write, or deployment was performed by this slice.
