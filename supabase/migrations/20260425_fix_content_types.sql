-- Migration: Fix content type CHECK constraint
-- The old constraint only allowed ('anime', 'drakor') which blocked 
-- all movies and most TV content from being saved by the scraper.

-- 1. Drop the old restrictive constraint
ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_type_check;

-- 2. Add new constraint that supports all TMDB-derived content types
ALTER TABLE contents ADD CONSTRAINT contents_type_check 
  CHECK (type IN ('movie', 'tv', 'anime', 'drakor', 'drachin', 'donghua', 'variety', 'drathai', 'drajep'));
