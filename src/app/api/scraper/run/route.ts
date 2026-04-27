import { NextResponse } from 'next/server';
import { ScraperService } from '@/services/ScraperService';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Increase max duration for Vercel (ignored by standard Netlify but kept for compatibility)
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // Fetch scraper config for secret validation
    const { data: sData } = await supabase.from('settings').select('value').eq('key', 'scraper_config').single();
    const scraperConfig = sData?.value || {};
    
    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    const authHeader = req.headers.get('authorization');
    const cronSecret = scraperConfig.scraper_secret || process.env.SCRAPER_SECRET;
    const isCron = cronSecret && (authHeader === `Bearer ${cronSecret}`);

    if (!user && !isCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task, state = {} } = await req.json();
    const scraper = ScraperService.getInstance();
    const intensity = scraperConfig.discovery_pages || 3;

    let logId = state.logId;
    if (!logId) {
       // Start of task: create a new log
       logId = await scraper.createLog(task);
       if (!logId) {
          return NextResponse.json({ error: 'Task already running' }, { status: 400 });
       }
    }

    let result: any;

    if (task === 'scrape') {
      result = await scraper.runDiscoveryChunk(intensity, state);
    } else if (task === 'trending') {
      result = await scraper.runTrendingChunk(state);
    } else if (task === 'validate') {
      result = await scraper.runHealthCheckChunk(state);
    } else if (task === 'sync') {
      result = await scraper.runSyncMetadataChunk(state);
    } else if (task === 'subtitles') {
      result = await scraper.runSyncSubtitlesChunk(state);
    } else {
      return NextResponse.json({ error: 'Invalid task' }, { status: 400 });
    }

    // Accumulate summary to show total in the log
    const accumulatedProcessed = (state.accumulatedProcessed || 0) + (result.summary?.items_processed || 0);
    const accumulatedAdded = (state.accumulatedAdded || 0) + (result.summary?.items_added || 0);
    const accumulatedFailed = (state.accumulatedFailed || 0) + (result.summary?.items_failed || 0);

    const fullSummary = {
        items_processed: accumulatedProcessed,
        items_added: accumulatedAdded,
        items_failed: accumulatedFailed,
        errors: result.summary?.errors || []
    };

    if (logId) {
        if (result.hasMore) {
            await scraper.updateLogProgress(logId, accumulatedProcessed, result.total || accumulatedProcessed, 'Memproses batch...');
        } else {
            await scraper.updateLog(logId, 'success', fullSummary);
        }
    }

    // Embed logId and accumulators into nextState so the client passes them back
    if (result.hasMore) {
        result.nextState = {
            ...result.nextState,
            logId,
            accumulatedProcessed,
            accumulatedAdded,
            accumulatedFailed
        };
    }

    return NextResponse.json({ success: true, ...result, logId });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// GET handler for Cron hits (triggers one chunk per hit)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    const task = searchParams.get('task') || 'scrape'; // Default to scrape if not specified
    
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
    const intensity = scraperConfig.discovery_pages || 3;
    
    // 1. Fetch persistent cron state (unique per task to avoid collision)
    const stateKey = `cron_state_${task}`;
    const { data: cronStateData } = await supabase.from('settings').select('value').eq('key', stateKey).single();
    let cronState = cronStateData?.value || {};

    let logId = cronState.logId;
    if (!logId) {
       // Search for an existing 'running' log for this specific automated task
       // This handles cases where the cronState in 'settings' was lost but the task is still active in 'scraper_logs'
       const taskName = `Automated ${task.toUpperCase()} (CRON)`;
       const { data: existingLog } = await supabase
         .from('scraper_logs')
         .select('id')
         .eq('task_name', taskName)
         .eq('status', 'running')
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle();

       if (existingLog) {
         console.log(`[Scraper API] Found orphaned running task ${existingLog.id}, resuming...`);
         logId = existingLog.id;
       } else {
         // Start of a brand new automated task
         logId = await scraper.createLog(taskName);
         if (!logId) {
            return NextResponse.json({ error: 'Another task is already running' }, { status: 400 });
         }
       }
       cronState.logId = logId;
    }

    // 2. Execute ONE chunk based on task type
    console.log(`[Scraper API] Executing CRON ${task} chunk`);
    let result: any;
    if (task === 'scrape') {
      result = await scraper.runDiscoveryChunk(intensity, cronState);
    } else if (task === 'trending') {
      result = await scraper.runTrendingChunk(cronState);
    } else if (task === 'validate') {
      result = await scraper.runHealthCheckChunk(cronState);
    } else if (task === 'sync') {
      result = await scraper.runSyncMetadataChunk(cronState);
    } else if (task === 'subtitles') {
      result = await scraper.runSyncSubtitlesChunk(cronState);
    } else {
      return NextResponse.json({ error: 'Invalid task' }, { status: 400 });
    }

    // 3. Accumulate summary
    const accumulatedProcessed = (cronState.accumulatedProcessed || 0) + (result.summary?.items_processed || 0);
    const accumulatedAdded = (cronState.accumulatedAdded || 0) + (result.summary?.items_added || 0);
    const accumulatedFailed = (cronState.accumulatedFailed || 0) + (result.summary?.items_failed || 0);

    const fullSummary = {
        items_processed: accumulatedProcessed,
        items_added: accumulatedAdded,
        items_failed: accumulatedFailed,
        errors: result.summary?.errors || []
    };

    if (logId) {
        if (result.hasMore) {
            await scraper.updateLogProgress(logId, accumulatedProcessed, result.total || accumulatedProcessed, 'CRON processing chunk...');
        } else {
            await scraper.updateLog(logId, 'success', fullSummary);
        }
    }

    // 4. Save state for next CRON ping
    if (result.hasMore) {
        const nextStateToSave = {
            ...result.nextState,
            logId,
            accumulatedProcessed,
            accumulatedAdded,
            accumulatedFailed
        };
        await supabase.from('settings').upsert({ key: stateKey, value: nextStateToSave }, { onConflict: 'key' });
    } else {
        // Task completely finished, wipe the state so it starts fresh next time
        await supabase.from('settings').delete().eq('key', stateKey);
    }

    return NextResponse.json({ 
        success: true, 
        message: result.hasMore ? 'Chunk processed successfully. Awaiting next CRON hit.' : 'Automated scraping cycle completely finished.',
        items_processed_this_chunk: result.summary?.items_processed || 0
    });

  } catch (err: any) {
    console.error('[Scraper API] GET Handler Exception:', err);
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}
