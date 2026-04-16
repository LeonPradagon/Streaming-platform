-- Create Tables for Movie Streaming Platform

-- 1. Table for Basic Metadata & Approval Status
CREATE TABLE IF NOT EXISTS contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tmdb_id INTEGER UNIQUE NOT NULL,
    title TEXT NOT NULL,
    type TEXT CHECK (type IN ('anime', 'drakor')) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table for Embed Links
CREATE TABLE IF NOT EXISTS embed_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    url TEXT NOT NULL,
    quality TEXT DEFAULT 'HD',
    language TEXT DEFAULT 'Indo Sub',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security (RLS)
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_links ENABLE ROW LEVEL SECURITY;

-- 3a. Read Access (Public for approved content)
CREATE POLICY "Public approved content access" ON contents
    FOR SELECT TO public
    USING (status = 'approved');

CREATE POLICY "Public embed links access" ON embed_links
    FOR SELECT TO public
    USING (EXISTS (
        SELECT 1 FROM contents WHERE contents.id = embed_links.content_id AND contents.status = 'approved'
    ));

-- 3b. Admin Access (Authenticated users can do everything)
CREATE POLICY "Admin full access contents" ON contents
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admin full access embed_links" ON embed_links
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Indices
CREATE INDEX IF NOT EXISTS idx_contents_tmdb_id ON contents(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_contents_status ON contents(status);
CREATE INDEX IF NOT EXISTS idx_embed_links_content_id ON embed_links(content_id);
