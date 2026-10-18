import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db } from "../db/database";
import * as schema from "../db/schema";
import { profiles, watchHistory, watchlist } from "../db/schema";

const trustedOrigins = (process.env.CORS_ORIGIN ?? process.env.URL ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: "NETIX",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  trustedOrigins,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (account) => {
        await db.transaction(async (tx) => {
          await tx.delete(watchHistory).where(eq(watchHistory.userId, account.id));
          await tx.delete(watchlist).where(eq(watchlist.userId, account.id));
          await tx.delete(profiles).where(eq(profiles.id, account.id));
        });
      },
    },
  },
});
