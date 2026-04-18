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
    // However, for this demo we'll await to give feedback to the Admin UI
    let result;
    if (task === 'scrape') {
      result = await scraper.runDiscovery(pages || 2);
    } else if (task === 'trending') {
      result = await scraper.runTrendingDiscovery();
    } else if (task === 'validate') {
      result = await scraper.validateLinks();
    } else if (task === 'sync') {
      result = await scraper.syncAllMetadata();
    } else {
      return NextResponse.json({ error: 'Invalid task' }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
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
  // Fire and forget for Cron
  scraper.runDiscovery(1).catch(console.error);
  
  return NextResponse.json({ status: 'Scraper triggered in background' });
}
