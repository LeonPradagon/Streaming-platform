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
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    
    const supabase = await createClient();
    const { data: sData, error: sError } = await supabase.from('settings').select('value').eq('key', 'scraper_config').single();
    
    if (sError && sError.code !== 'PGRST116') {
      console.error('[Scraper API] Database error fetching config:', sError);
    }

    const scraperConfig = sData?.value || {};
    const validSecret = scraperConfig.scraper_secret || process.env.SCRAPER_SECRET;
    
    if (!validSecret) {
      console.error('[Scraper API] No secret configured in DB or Env.');
      return NextResponse.json({ error: 'Server configuration error: SCRAPER_SECRET is not set' }, { status: 500 });
    }

    if (secret !== validSecret) {
      console.warn('[Scraper API] Unauthorized access attempt with invalid secret.');
      return NextResponse.json({ error: 'Unauthorized: Invalid secret' }, { status: 401 });
    }

    // Check if automation is enabled in DB
    if (scraperConfig.auto_scrape_enabled === false) {
      console.warn('[Scraper API] Automation hit but it is disabled in settings.');
      return NextResponse.json({ error: 'Forbidden: Automation is disabled in settings' }, { status: 403 });
    }

    const scraper = ScraperService.getInstance();
    const intensity = scraperConfig.discovery_pages || 5;
    
    // Full routine: Trending + Discovery (with intensity from settings)
    console.log(`[Scraper API] Triggering full routine via CRON (Intensity: ${intensity})`);
    scraper.runFullRoutine(intensity).catch(err => {
      console.error('[Scraper API] Background routine error:', err);
    });
    
    return NextResponse.json({ 
      status: 'Full routine triggered in background', 
      intensity,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[Scraper API] GET Handler Exception:', err);
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}
