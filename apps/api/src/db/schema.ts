import { sql } from "drizzle-orm";
import { boolean, date, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Better Auth tables. Keep role server-controlled; never accept it from signup input.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const legacyAuthMetadata = pgTable("legacy_auth_metadata", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

// Domain tables follow the legacy Supabase identifiers so imports can preserve IDs.
export const contents = pgTable("contents", {
  id: uuid("id").defaultRandom().primaryKey(),
  tmdbId: integer("tmdb_id").notNull().unique(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  overview: text("overview"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  releaseDate: text("release_date"),
  voteAverage: numeric("vote_average"),
  popularity: numeric("popularity"),
  platform: text("platform"),
  platforms: text("platforms").array().notNull().default(sql`'{}'::text[]`),
  isHealthy: boolean("is_healthy").default(true),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  castData: jsonb("cast_data"),
  quality: text("quality"),
  tvStatus: text("tv_status"),
  trailerKey: text("trailer_key"),
  genreNames: jsonb("genre_names"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const embedLinks = pgTable("embed_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentId: uuid("content_id").references(() => contents.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  url: text("url").notNull(),
  quality: text("quality").default("HD"),
  language: text("language").default("Indo Sub"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const seasons = pgTable("seasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentId: uuid("content_id").references(() => contents.id, { onDelete: "cascade" }),
  seasonNumber: integer("season_number").notNull(),
  title: text("title"),
  overview: text("overview"),
  posterPath: text("poster_path"),
  airDate: date("air_date", { mode: "string" }),
  episodeCount: integer("episode_count"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const episodes = pgTable("episodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  seasonId: uuid("season_id").references(() => seasons.id, { onDelete: "cascade" }),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title"),
  overview: text("overview"),
  stillPath: text("still_path"),
  airDate: date("air_date", { mode: "string" }),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  preferences: jsonb("preferences"),
});

export const watchlist = pgTable("watchlist", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  contentId: uuid("content_id").notNull().references(() => contents.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const watchHistory = pgTable("watch_history", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  contentId: uuid("content_id").notNull().references(() => contents.id, { onDelete: "cascade" }),
  progressTime: integer("progress_time"),
  duration: integer("duration"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey(),
  userId: text("user_id"),
  action: text("action").notNull(),
  targetId: text("target_id"),
  targetType: text("target_type"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const scraperLogs = pgTable("scraper_logs", {
  id: uuid("id").primaryKey(),
  taskName: text("task_name").notNull(),
  status: text("status").notNull(),
  itemsCount: integer("items_count").default(0),
  summary: jsonb("summary"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  progress: jsonb("progress"),
  checkpoint: jsonb("checkpoint"),
});

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentId: uuid("content_id").references(() => contents.id, { onDelete: "cascade" }),
  issueType: text("issue_type").notNull(),
  details: text("details"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
