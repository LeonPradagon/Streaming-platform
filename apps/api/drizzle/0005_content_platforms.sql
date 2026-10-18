ALTER TABLE "contents" ADD COLUMN "platforms" text[] NOT NULL DEFAULT '{}'::text[];
UPDATE "contents" SET "platforms" = ARRAY["platform"]::text[] WHERE "platform" IS NOT NULL AND "platform" <> '';
