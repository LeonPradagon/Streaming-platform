import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { parseOptions, inspectSource, buildEncodeArgs, validateEncoded, prepareVideo } from "./prepare-video.mjs";

const probe = {
  format: { duration: "120" },
  streams: [
    { index: 0, codec_type: "video", codec_name: "h264", width: 1920, height: 1080, field_order: "progressive" },
    { index: 1, codec_type: "audio", codec_name: "aac", channels: 2 },
    { index: 2, codec_type: "audio", codec_name: "ac3", channels: 6 },
    { index: 3, codec_type: "subtitle", codec_name: "subrip" },
  ],
};
test("options limit quality and reject URLs, duplicates and invalid flags", () => {
  assert.equal(parseOptions(["--help"]).help, true);
  assert.equal(parseOptions(["--input", "film.mkv"]).crf, 20);
  assert.equal(parseOptions(["--input", "film.mkv", "--sample"]).sample, true);
  for (const args of [[], ["--input"], ["--input", "https://example.test/film.mp4"], ["--input", "a", "--crf", "0"], ["--input", "a", "--crf", "20.5"], ["--input", "a", "--input", "b"], ["--input", "a", "--wat"]]) assert.throws(() => parseOptions(args));
});
test("arguments preserve resolution/timing and map audio/subtitles without shell interpolation", () => {
  const source = inspectSource(probe);
  const args = buildEncodeArgs("D:\\Videos\\a & b.mkv", "out.mp4", source, { crf: 20, sample: false });
  assert.ok(args.includes("-n")); assert.equal(args[args.indexOf("-i") + 1], "D:\\Videos\\a & b.mkv");
  assert.equal(args[args.indexOf("-crf") + 1], "20"); assert.equal(args[args.indexOf("-c:a:0") + 1], "copy");
  assert.equal(args[args.indexOf("-c:a:1") + 1], "aac"); assert.equal(args[args.indexOf("-b:a:1") + 1], "384k");
  for (const value of ["0:a?", "0:s?", "libx264", "slow", "passthrough", "mov_text", "+faststart"]) assert.ok(args.includes(value));
  for (const value of ["-vf", "-s", "-r", "-y"]) assert.ok(!args.includes(value));
  const sample = buildEncodeArgs("in.mkv", "out.mp4", source, { crf: 18, sample: true });
  assert.equal(sample[sample.indexOf("-t") + 1], "90");
});
test("HDR, interlace, bitmap subtitles, invalid duration and dimensions are rejected", () => {
  const variants = [
    { color_transfer: "smpte2084" }, { color_transfer: "arib-std-b67" }, { color_primaries: "bt2020" },
    { field_order: "tt" }, { width: 1919 }, { width: 0 }, { side_data_list: [{ rotation: 90 }] },
  ];
  for (const video of variants) assert.throws(() => inspectSource({ ...probe, streams: [{ ...probe.streams[0], ...video }] }));
  assert.throws(() => inspectSource({ ...probe, streams: [...probe.streams, { codec_type: "subtitle", codec_name: "hdmv_pgs_subtitle" }] }));
  assert.throws(() => inspectSource({ ...probe, streams: [probe.streams[0], probe.streams[0]] }));
  assert.throws(() => inspectSource({ ...probe, format: { duration: "NaN" } }));
});
test("output validation catches truncation, codec changes, resize and missing tracks", () => {
  const source = inspectSource(probe);
  validateEncoded(probe, source, false);
  validateEncoded({ ...probe, format: { duration: "90" } }, source, true);
  assert.throws(() => validateEncoded({ ...probe, format: { duration: "50" } }, source, false));
  assert.throws(() => validateEncoded({ ...probe, streams: probe.streams.slice(0, -1) }, source, false));
  for (const update of [{ width: 1280 }, { codec_name: "hevc" }]) assert.throws(() => validateEncoded({ ...probe, streams: [{ ...probe.streams[0], ...update }, ...probe.streams.slice(1)] }, source, false));
});

// Encoder stubs exercise real filesystem safety without claiming real media encoding.
test("filesystem workflow preserves originals/outputs and discards unsafe candidates", async () => {
  const tempRoot = join(process.env.LOCALAPPDATA || process.cwd(), "Temp", "opencode");
  await mkdir(tempRoot, { recursive: true });
  const directory = await mkdtemp(join(tempRoot, "netix-encoder-test-"));
  try {
    const original = join(directory, "film & source.mkv");
    const output = join(directory, "film.mp4");
    await writeFile(original, Buffer.alloc(100, "o"));
    let encodedBytes = 50; let badDuration = false; let fail = false; let race = false; let sample = false;
    const options = parseOptions(["--input", original, "--output", output]);
    const run = overrides => prepareVideo({ ...options, ...overrides }, {
      log: () => {},
      probe: async (_executable, path) => ({ ...probe, format: { duration: path.endsWith("encoded.mp4") ? badDuration ? "20" : sample ? "90" : "120" : "120" } }),
      transcode: async (_executable, args) => {
        if (fail) throw new Error("Encoding stopped (exit 9)");
        await writeFile(args.at(-1), Buffer.alloc(encodedBytes, "e"));
        if (race) await writeFile(output, "existing");
      },
    });
    assert.equal((await run({ dryRun: true })).status, "dry-run");
    assert.deepEqual(await readdir(directory), ["film & source.mkv"]);
    assert.equal((await run()).status, "saved"); assert.equal((await readFile(output)).length, 50);
    await assert.rejects(run(), /already exists/); assert.equal((await readFile(original)).length, 100);
    await rm(output);
    encodedBytes = 200;
    assert.equal((await run()).status, "not-smaller"); assert.ok(!(await readdir(directory)).includes("film.mp4"));
    encodedBytes = 50;
    fail = true; await assert.rejects(run(), /exit 9/); fail = false;
    badDuration = true; await assert.rejects(run(), /validation/); badDuration = false;
    race = true; await assert.rejects(run(), /EEXIST/); race = false;
    assert.equal(await readFile(output, "utf8"), "existing"); await rm(output);
    sample = true; encodedBytes = 200;
    assert.equal((await run({ sample: true })).status, "saved");
    await rm(output);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(prepareVideo(options, { signal: controller.signal, log: () => {}, probe: async () => probe, transcode: async () => { throw new Error("Canceled encodes must never start"); } }), { name: "AbortError" });
    assert.equal((await readFile(original)).toString(), "o".repeat(100));
    assert.ok(!(await readdir(directory)).some(name => name.startsWith(".netix-encode-")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
