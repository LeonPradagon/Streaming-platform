-- Migration: Scraper Modernization & Logs
-- Run this in your Supabase SQL Editor

-- 1. Update contents table
ALTER TABLE contents ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS is_healthy BOOLEAN DEFAULT TRUE;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS cast_data JSONB; -- For storing actors

-- 2. Create scraper_logs table
CREATE TABLE IF NOT EXISTS scraper_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    items_count INTEGER DEFAULT 0,
    summary JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- 3. Create reports table for user feedback
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    issue_type TEXT NOT NULL, -- 'dead_link', 'wrong_metadata', 'other'
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE scraper_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policies: Admin only for logs
CREATE POLICY "Admins can view scraper logs" ON scraper_logs
    FOR SELECT USING (auth.jwt() ->> 'role' = 'authenticated'); -- Adjust based on your role logic

-- Policies: Anonymous can create reports, Admin can view
CREATE POLICY "Anyone can create reports" ON reports
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view reports" ON reports
    FOR SELECT USING (auth.jwt() ->> 'role' = 'authenticated');
