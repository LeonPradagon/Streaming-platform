import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required by the API.");

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
  ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
