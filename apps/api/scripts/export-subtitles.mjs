import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env.local") });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase storage credentials are missing from .env.local.");
const client = createClient(url, key, { auth: { persistSession: false } });
const destination = path.join(root, "apps", "api", "storage", "subtitles");
const files = [];

async function listFiles(prefix = "") {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from("subtitles").list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`Could not list subtitle objects: ${error.message}`);
    for (const entry of data ?? []) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) await listFiles(objectPath);
      else files.push({ path: objectPath, size: Number(entry.metadata?.size ?? 0) });
    }
    if ((data ?? []).length < 1000) return;
  }
}

function localPath(objectPath) {
  const target = path.resolve(destination, objectPath);
  if (!target.startsWith(`${destination}${path.sep}`)) throw new Error("Unsafe storage path rejected.");
  return target;
}

await listFiles();
await mkdir(destination, { recursive: true });
let copied = 0;
let skipped = 0;
let next = 0;
const workers = Array.from({ length: 5 }, async () => {
  while (next < files.length) {
    const file = files[next++];
    const target = localPath(file.path);
    try {
      if ((await stat(target)).size === file.size) { skipped++; continue; }
    } catch { /* New or incomplete local copy. */ }
    const { data, error } = await client.storage.from("subtitles").download(file.path);
    if (error || !data) throw new Error(`Subtitle download failed for ${file.path}: ${error?.message ?? "no data"}`);
    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.length !== file.size) throw new Error(`Size mismatch for ${file.path}: expected ${file.size}, received ${buffer.length}`);
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.partial`;
    await writeFile(temporary, buffer);
    await rename(temporary, target);
    copied++;
    if ((copied + skipped) % 250 === 0) console.log(`Subtitle files checked: ${copied + skipped}/${files.length}`);
  }
});
await Promise.all(workers);
const result = { bucket: "subtitles", sourceFiles: files.length, copied, skipped, bytes: files.reduce((sum, file) => sum + file.size, 0) };
await writeFile(path.join(destination, ".migration-manifest.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
