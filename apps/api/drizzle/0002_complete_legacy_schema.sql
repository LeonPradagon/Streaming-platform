ALTER TABLE "contents" ALTER COLUMN "vote_average" TYPE numeric USING NULLIF("vote_average", '')::numeric;
--> statement-breakpoint
ALTER TABLE "contents" ALTER COLUMN "popularity" TYPE numeric USING NULLIF("popularity", '')::numeric;
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "title" text;
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "overview" text;
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "poster_path" text;
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "air_date" date;
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "episode_count" integer;
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();
--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "title" text;
--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "overview" text;
--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "still_path" text;
--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "updated_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "full_name" text,
  "role" text DEFAULT 'user' NOT NULL,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "preferences" jsonb
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "content_id" uuid NOT NULL REFERENCES "contents"("id") ON DELETE cascade,
  "created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "watch_history" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "content_id" uuid NOT NULL REFERENCES "contents"("id") ON DELETE cascade,
  "progress_time" integer,
  "duration" integer,
  "updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" text,
  "action" text NOT NULL,
  "target_id" text,
  "target_type" text,
  "details" jsonb,
  "created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scraper_logs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "task_name" text NOT NULL,
  "status" text NOT NULL,
  "items_count" integer DEFAULT 0,
  "summary" jsonb,
  "error_message" text,
  "created_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "progress" jsonb
);
