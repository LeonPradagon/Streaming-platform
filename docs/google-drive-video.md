# Google Drive video preparation

This integration adds a movie-only Google Drive server to the existing catalog. It does not download movies from other embeds, upload to Google, encode on the web server, or bypass Drive permissions. Use only source files you own or are authorized to store and stream.

A separate **local batch worker** now supports direct file downloads and Google Drive API uploads; see `docs/drive-batch.md`. It requires one-time Desktop OAuth and accessible local/direct video sources, keeps originals/checkpoints, and does not bypass provider verification. The web integration and preparation tool themselves still do not upload files automatically.

## Prepare once, play many times

1. Install FFmpeg **and FFprobe** from a trusted build linked at <https://ffmpeg.org/download.html>. Add the `bin` directory to PATH, or set `FFMPEG_PATH` and `FFPROBE_PATH` to the full executable paths. This repository does not install executables automatically.
2. Prepare a 90-second sample first:

   ```powershell
   npm run video:prepare -- --input "D:\Videos\film.mkv" --sample
   ```

3. Compare the sample with the original: detail, motion, audio languages and subtitles. If suitable, prepare the whole video:

   ```powershell
   npm run video:prepare -- --input "D:\Videos\film.mkv" --crf 20
   ```

   Optional `--output "D:\Videos\film-upload.mp4"` sets a different destination. `--dry-run` uses FFprobe to inspect the input and prints the argument list without creating or encoding a file. `--help` works without FFmpeg installed.

The default is MP4/H.264, CRF 20, preset slow, SDR 8-bit 4:2:0. CRF 18–22 is supported; lower values usually increase quality and size. Resolution and frame timing are not intentionally changed. AAC audio is copied; other audio is converted to AAC (192 kb/s up to stereo, 384 kb/s for multichannel). All audio and text-subtitle tracks are mapped; MP4 text subtitles lose ASS/SSA styling. Chapters and stream metadata are retained where the container supports them. Extra attachments are not carried into MP4. The first 90 seconds may not represent the hardest scene; inspect the full output as well.

HDR/wide-gamut, interlaced, rotated video, odd dimensions, multiple main video tracks, and bitmap/unsupported subtitles are rejected rather than silently changing them. These need explicit color, deinterlacing, rotation, subtitle burn-in, or container decisions. HandBrake or Shutter Encoder can help configure such cases, but still require visual review.

Source and existing destination files are never overwritten. The encoder uses a temporary directory beside the destination; interrupted or failed candidates are cleaned up. Successful candidates are checked for video codec, duration, dimensions, and audio/subtitle track counts. **These checks do not prove visual quality.** A full candidate is published only if smaller than its source; a sample is not compared against the size of the full source. Sufficient temporary disk space is required. A forced OS/process crash can leave a `.netix-encode-*` directory for manual inspection/removal.

Compression is lossy, not restoration or enhancement. Already-compressed video may not become smaller. Keep the original. Encoding again for every viewer is neither needed nor provided.

## Upload and link a movie

1. Upload the reviewed file to [your Drive folder](https://drive.google.com/drive/folders/1CUMaEPS5S7VyRe65jRPzOOa8QlRdbPuq).
2. Wait for Drive video processing. Give the intended viewers access. For private sharing, viewers may need to log into Google; third-party-cookie restrictions can prevent embedded playback. Public-link sharing is easier but does not restrict access to your three viewers—anyone with the link can access it.
3. Copy the **file** link (`https://drive.google.com/file/d/FILE_ID/view`), not the folder link.
4. In **Admin → Katalog**, use the hard-drive button beside the movie. Paste its file link, confirm authorization, and save.
5. Open the NETIX watch page with a viewer account. Google Drive is selected by default when linked; existing Videasy/MoviesAPI/VidLink server indices remain unchanged and remain available as fallbacks.

Only the existing `embed_links` table is used; no new migration, service-role key, or Google OAuth secret is required. New server actions independently validate the user's `super_admin`/`moderator` role, movie type, and file URL. Drive resource keys are preserved; arbitrary URL parameters are not stored. Replacing/removing the Drive entry does not modify other providers. Removing the entry does not delete any file in Drive. Existing database RLS must permit the authorized admin to write; the app does not bypass RLS.

Drive manages its own preview transcoding and traffic limits. The app cannot guarantee identical upload/preview quality, successful playback, native multi-audio/subtitle availability, or automatic timestamp resume. NETIX's external subtitle injection and provider progress tracking do not apply to Drive. A direct “Buka video di Google Drive” link is available when embed permissions/cookies fail. Series are intentionally excluded until each episode can be mapped explicitly; a single movie file must not be reused for every episode.

## Alternatives

- **FFmpeg:** best fit for a repeatable local script; used here.
- **HandBrake:** simpler graphical controls and queue; convenient for manual conversion.
- **Shutter Encoder:** graphical FFmpeg-based workflow, more controls, including subtitle handling.

H.265/AV1 may improve compression efficiency for some material but cost more encoding time and are not the default because of device/container compatibility and Drive's own preview processing. No automatic AI upscaling, HLS variants, folder mirroring, or public deployment is included. The optional batch upload worker is described separately above.

## Verification

```powershell
node --test scripts/drive-video.test.mjs scripts/prepare-video.test.mjs
npm run video:prepare -- --help
npm run build
```

Tests cover URL validation, admin authorization and provider-only changes, encoder arguments, file-preservation behavior, failures, and candidate validation. Real encoding requires the installed binaries; real Drive playback requires a processed, shared video and an authorized viewer. Neither should be inferred from mocked tests.

Implementation verification passed: production build, focused ESLint/TypeScript, 42 existing viewer browser checks, and the new admin route's signed-out redirect to `/login`. No real-account save, real Drive playback, or actual encoding was performed: FFmpeg/FFprobe were not available on PATH, and no source video was supplied locally. No database records, Drive files, or permissions were changed by the verification.
