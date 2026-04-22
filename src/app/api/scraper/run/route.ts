import { NextResponse } from 'next/server';
import { ScraperService } from '@/services/ScraperService';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    // 1. Auth Check (only authenticated admins can trigger manually)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Also allow secret key for Cron Jobs
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.SCRAPER_SECRET;
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!user && !isCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task, pages } = await req.json();
    const scraper = ScraperService.getInstance();
    
    // Run in background (don't await for the UI, but return success that it started)
    // This prevents Vercel/browser timeouts for long-running scraper jobs.
    if (task === 'scrape') {
      scraper.runDiscovery(pages || 2).catch(console.error);
    } else if (task === 'trending') {
      scraper.runTrendingDiscovery().catch(console.error);
    } else if (task === 'validate') {
      scraper.validateLinks().catch(console.error);
    } else if (task === 'sync') {
      scraper.syncAllMetadata().catch(console.error);
    } else if (task === 'subtitles') {
      scraper.syncMissingSubtitles().catch(console.error);
    } else {
      return NextResponse.json({ error: 'Invalid task' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Task started in background' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// GET handler for simple Vercel Cron hits (can trigger a default 'scrape' task)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  
  if (secret !== process.env.SCRAPER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scraper = ScraperService.getInstance();
  // Fire and forget for Cron (Vercel will usually wait a bit, but we don't await the whole thing to stay under timeout if possible)
  scraper.runFullRoutine().catch(console.error);
  
  return NextResponse.json({ status: 'Full routine triggered in background' });
}
