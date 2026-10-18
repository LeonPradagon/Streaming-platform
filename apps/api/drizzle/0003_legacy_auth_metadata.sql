CREATE TABLE "legacy_auth_metadata" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "payload" jsonb NOT NULL,
  "source_created_at" timestamp with time zone,
  "source_updated_at" timestamp with time zone
);
