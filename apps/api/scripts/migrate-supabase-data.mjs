import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });
const { Pool } = pg;
const sourceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sourceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const targetUrl = process.env.DATABASE_URL;
if (!sourceUrl || !sourceKey || !targetUrl) throw new Error("Supabase source and Neon DATABASE_URL must be configured in local env files.");

const execute = process.argv.includes("--execute");
const supabase = createClient(sourceUrl, sourceKey, { auth: { persistSession: false } });
const pool = new Pool({ connectionString: targetUrl, max: 4 });
const tables = ["profiles", "contents", "settings", "embed_links", "seasons", "episodes", "reports", "scraper_logs", "watchlist", "watch_history", "audit_logs"];
const batchSize = 250;

async function fetchAll(table) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(offset, offset + 999);
    if (error) throw new Error(`Source read failed for ${table}: ${error.code ?? error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function importRows(client, table, rows, conflictColumn) {
  if (rows.length === 0) return;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quotedColumns = columns.map((column) => `"${column}"`).join(",");
  const updateColumns = columns.filter((column) => column !== conflictColumn);
  const updates = updateColumns.map((column) => `"${column}" = EXCLUDED."${column}"`).join(",");
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    await client.query(
      `INSERT INTO "${table}" (${quotedColumns}) SELECT ${quotedColumns} FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb) ON CONFLICT ("${conflictColumn}") DO ${updates ? `UPDATE SET ${updates}` : "NOTHING"}`,
      [JSON.stringify(batch)],
    );
  }
}

try {
  const sourceRows = new Map();
  for (const table of tables) sourceRows.set(table, await fetchAll(table));
  const authResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authResult.error) throw new Error(`Auth users read failed: ${authResult.error.message}`);
  const users = authResult.data.users;
  const profileRows = sourceRows.get("profiles");
  const profilesById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const mappedUsers = users.map((user) => {
    const profile = profilesById.get(user.id);
    return {
      id: user.id,
      name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email || "NETIX user",
      email: user.email,
      emailVerified: Boolean(user.email_confirmed_at),
      image: user.user_metadata?.avatar_url ?? null,
      role: profile?.role ?? "user",
      createdAt: user.created_at,
      updatedAt: user.updated_at ?? user.created_at,
    };
  });
  const authMetadata = users.map((user) => ({
    user_id: user.id,
    payload: {
      aud: user.aud,
      role: user.role,
      phone: user.phone,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      identities: user.identities,
      is_anonymous: user.is_anonymous,
    },
    source_created_at: user.created_at,
    source_updated_at: user.updated_at,
  }));

  const sourceCounts = Object.fromEntries([...sourceRows].map(([table, rows]) => [table, rows.length]));
  sourceCounts.auth_users = mappedUsers.length;
  sourceCounts.auth_metadata = authMetadata.length;
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", sourceCounts }, null, 2));
  if (!execute) {
    console.log("No data written. Run again with --execute to import; existing source rows remain untouched.");
    process.exitCode = 0;
  } else {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await importRows(client, "user", mappedUsers, "id");
      await importRows(client, "legacy_auth_metadata", authMetadata, "user_id");
      for (const table of tables) await importRows(client, table, sourceRows.get(table), table === "settings" ? "key" : "id");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const verification = {};
    for (const table of [...tables, "user", "legacy_auth_metadata"]) {
      const { rows } = await pool.query(`SELECT count(*)::int AS count FROM "${table}"`);
      verification[table] = rows[0].count;
    }
    console.log(JSON.stringify({ verification }, null, 2));
  }
} finally {
  await pool.end();
}
