import { NextResponse } from 'next/server';
import { ScraperService } from '@/services/ScraperService';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // Fetch scraper config for secret validation
    const { data: sData } = await supabase.from('settings').select('value').eq('key', 'scraper_config').single();
    const scraperConfig = sData?.value || {};
    
    // 1. Auth Check (only authenticated admins can trigger manually)
    const { data: { user } } = await supabase.auth.getUser();
    
    // Also allow secret key for Cron Jobs
    const authHeader = req.headers.get('authorization');
    const cronSecret = scraperConfig.scraper_secret || process.env.SCRAPER_SECRET;
    const isCron = cronSecret && (authHeader === `Bearer ${cronSecret}`);

    if (!user && !isCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task, pages } = await req.json();
    const scraper = ScraperService.getInstance();
    const intensity = pages || scraperConfig.discovery_pages || 3;
    
    if (task === 'scrape') {
      scraper.runDiscovery(intensity).catch(console.error);
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

// GET handler for simple Vercel Cron hits (triggers full routine)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  
  const supabase = await createClient();
  const { data: sData } = await supabase.from('settings').select('value').eq('key', 'scraper_config').single();
  const scraperConfig = sData?.value || {};

  const validSecret = scraperConfig.scraper_secret || process.env.SCRAPER_SECRET;
  
  if (!validSecret || secret !== validSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if automation is enabled in DB
  if (scraperConfig.auto_scrape_enabled === false) {
    return NextResponse.json({ error: 'Automation is disabled in settings' }, { status: 403 });
  }

  const scraper = ScraperService.getInstance();
  const intensity = scraperConfig.discovery_pages || 5;
  
  // Full routine: Trending + Discovery (with intensity from settings)
  scraper.runFullRoutine(intensity).catch(console.error);
  
  return NextResponse.json({ status: 'Full routine triggered in background', intensity });
}
