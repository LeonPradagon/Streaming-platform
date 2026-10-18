// Local-only preparation. No web-server encoder, Drive credentials, or source-file overwrites.
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { constants } from "node:fs";
import { copyFile, lstat, mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
export const HELP = `Prepare a local video for Google Drive (FFmpeg + FFprobe required).
Usage: npm run video:prepare -- --input "D:\\Videos\\film.mkv" [--output "D:\\Videos\\film.netix.mp4"] [--crf 20] [--sample] [--dry-run]

--sample   Encode the first 90 seconds to a separate sample file. Review before a full encode.
--crf      H.264 quality, 18–22 (default 20). Lower = higher quality/larger file.
--dry-run  Inspect the source and print the plan without encoding or creating files.

Keeps resolution, frame timing, audio tracks, chapters and text subtitles.
AAC audio is copied; other audio is converted to AAC. Subtitle styling is not preserved.
HDR, interlaced video and bitmap subtitles require a deliberate workflow and are rejected.
Original files and existing outputs are never overwritten. A full encode is published only if smaller.
Set FFMPEG_PATH / FFPROBE_PATH when the executables are not on PATH.
Upload manually after review. No file is automatically sent to Google Drive.`;

export function parseOptions(args) {
  const options = { crf: 20, sample: false, dryRun: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--help" || flag === "-h") return { help: true };
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--sample") options.sample = true;
    else if (flag === "--dry-run") options.dryRun = true;
    else if (["--input", "--output", "--crf"].includes(flag)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value: ${flag}`);
      options[flag.slice(2)] = flag === "--crf" ? Number(value) : value;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  if (!options.input) throw new Error("A local source file is required: --input <path>");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(options.input)) throw new Error("Only local files are supported, not URLs or embed links.");
  if (!Number.isInteger(options.crf) || options.crf < 18 || options.crf > 22) throw new Error("CRF must be an integer from 18 to 22.");
  return options;
}

export function inspectSource(probe) {
  const streams = probe.streams || [];
  const videos = streams.filter(stream => stream.codec_type === "video" && !stream.disposition?.attached_pic);
  if (videos.length !== 1) throw new Error("Source must contain exactly one main video track.");
  const video = videos[0];
  if (["smpte2084", "arib-std-b67"].includes(video.color_transfer) || video.color_primaries === "bt2020") throw new Error("HDR/wide-gamut video requires explicit color handling. No automatic SDR conversion is performed.");
  if (video.field_order && !["progressive", "unknown"].includes(video.field_order)) throw new Error("Interlaced video requires an explicit deinterlacing workflow.");
  if (!(video.width > 0 && video.height > 0) || video.width % 2 || video.height % 2) throw new Error("H.264 preparation requires positive, even video dimensions.");
  if (video.side_data_list?.some(data => data.rotation)) throw new Error("Rotated video requires explicit orientation handling.");
  const duration = Number(probe.format?.duration || video.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Source duration is unavailable.");
  const audio = streams.filter(stream => stream.codec_type === "audio");
  const subtitles = streams.filter(stream => stream.codec_type === "subtitle");
  if (subtitles.some(stream => !["subrip", "ass", "ssa", "webvtt", "mov_text", "text"].includes(stream.codec_name))) throw new Error("Bitmap/unsupported subtitles cannot be safely copied to MP4. Use a deliberate burn-in or separate subtitle workflow.");
  return { video, audio, subtitles, duration };
}

export function buildEncodeArgs(input, output, source, options) {
  const args = ["-hide_banner", "-nostdin", "-n", "-i", input];
  if (options.sample) args.push("-t", "90");
  args.push("-map", `0:${source.video.index}`, "-map", "0:a?", "-map", "0:s?", "-map_metadata", "0", "-map_chapters", "0", "-c:v", "libx264", "-preset", "slow", "-crf", String(options.crf), "-pix_fmt", "yuv420p", "-fps_mode", "passthrough");
  source.audio.forEach((audio, index) => {
    args.push(`-c:a:${index}`, audio.codec_name === "aac" ? "copy" : "aac");
    if (audio.codec_name !== "aac") args.push(`-b:a:${index}`, audio.channels > 2 ? "384k" : "192k");
  });
  args.push("-c:s", "mov_text", "-movflags", "+faststart", output);
  return args;
}

async function probeFile(executable, path, signal) {
  try {
    const { stdout } = await exec(executable, ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], { signal, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    return JSON.parse(stdout);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error("FFprobe not found. Install FFmpeg with FFprobe or set FFPROBE_PATH.");
    throw error;
  }
}

async function encode(executable, args, signal) {
  await new Promise((resolve, reject) => {
    const process = spawn(executable, args, { shell: false, stdio: ["ignore", "ignore", "inherit"], signal, windowsHide: true });
    let failure;
    process.once("error", error => { failure = error; });
    process.once("close", code => {
      if (failure?.code === "ENOENT") reject(new Error("FFmpeg not found. Install it or set FFMPEG_PATH."));
      else if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Encoding stopped (exit ${code}). Original and existing output files are unchanged.`));
      else resolve();
    });
  });
}

export function validateEncoded(probe, source, sample) {
  const encoded = inspectSource(probe);
  const expected = sample ? Math.min(source.duration, 90) : source.duration;
  if (encoded.video.codec_name !== "h264" || encoded.video.width !== source.video.width || encoded.video.height !== source.video.height || Math.abs(encoded.duration - expected) > 2 || encoded.audio.length !== source.audio.length || encoded.subtitles.length !== source.subtitles.length) {
    throw new Error("Encoded file failed duration/resolution/track validation. It will not be published.");
  }
}

export async function prepareVideo(options, { signal, log = console.log, probe = probeFile, transcode = encode } = {}) {
  const input = await realpath(resolve(options.input));
  const original = await stat(input);
  if (!original.isFile()) throw new Error("Input must be a local file.");
  const output = resolve(options.output || join(dirname(input), `${basename(input, extname(input))}.netix${options.sample ? "-sample" : ""}.mp4`));
  if (extname(output).toLowerCase() !== ".mp4") throw new Error("Output must use the .mp4 extension.");
  try { await lstat(output); throw new Error("Output already exists. Choose another name; nothing will be overwritten."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await realpath(dirname(output));
  const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const source = inspectSource(await probe(ffprobe, input, signal));
  log(`Source: ${source.video.width}×${source.video.height}, ${Math.round(source.duration)} s, ${source.audio.length} audio / ${source.subtitles.length} text subtitle track(s).`);
  log("Lossy H.264 compression: quality is not mathematically identical. Review the sample; subtitle styling is not retained.");
  if (options.dryRun) {
    log(JSON.stringify({ executable: ffmpeg, args: buildEncodeArgs(input, output, source, options) }, null, 2));
    return { status: "dry-run", output };
  }
  signal?.throwIfAborted();
  const temporary = await mkdtemp(join(dirname(output), ".netix-encode-"));
  try {
    const candidate = join(temporary, "encoded.mp4");
    await transcode(ffmpeg, buildEncodeArgs(input, candidate, source, options), signal);
    validateEncoded(await probe(ffprobe, candidate, signal), source, options.sample);
    signal?.throwIfAborted();
    const size = (await stat(candidate)).size;
    if (!options.sample && size >= original.size) {
      log("No size improvement. Encoded candidate discarded; use the original or review different settings.");
      return { status: "not-smaller", originalBytes: original.size, encodedBytes: size };
    }
    // Exclusive publication also protects against an output appearing while FFmpeg was running.
    await copyFile(candidate, output, constants.COPYFILE_EXCL);
    log(`Saved: ${output}${options.sample ? " (sample only)" : ` (${(100 * (1 - size / original.size)).toFixed(1)}% smaller)`}. Review playback before uploading to Drive.`);
    return { status: "saved", output, originalBytes: original.size, encodedBytes: size };
  } finally {
    // This directory was created by this invocation and contains only its temporary candidate.
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log(HELP);
    else await prepareVideo(options, { signal: controller.signal });
  } catch (error) {
    console.error(error.name === "AbortError" ? "Canceled. Original files are unchanged." : error.message);
    process.exitCode = 1;
  } finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}
