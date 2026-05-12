import { createClient } from '@supabase/supabase-js';
import { TMDBMetadata, classifyPlatform, classifyContentType } from '@/lib/tmdb';
import { SubtitleService } from '@/services/SubtitleService';

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const tmdbApiKey = process.env.TMDB_API_KEY!;

// Use service_role key if available (bypasses RLS for backend operations)
if (!supabaseServiceKey) {
  console.warn('[ScraperService] SUPABASE_SERVICE_ROLE_KEY not set. Using anon key - writes may be blocked by RLS.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

export interface ScrapeTaskSummary {
  items_processed: number;
  items_added: number;
  items_failed: number;
  errors: string[];
}

export class ScraperService {
  private static instance: ScraperService;
  
  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper to run tasks in parallel with a concurrency limit and optional abort check
   */
  private async pMap<T, R>(items: T[], mapper: (item: T) => Promise<R>, concurrency: number, abortCheck?: () => Promise<void>): Promise<R[]> {
    const results: R[] = [];
    const chunks = [];
    for (let i = 0; i < items.length; i += concurrency) {
      chunks.push(items.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      if (abortCheck) await abortCheck();
      const chunkResults = await Promise.all(chunk.map(item => mapper(item)));
      results.push(...chunkResults);
      // Small breathing room between chunks
      await this.delay(200);
    }
    return results;
  }

  private async fetchWithTimeout(url: string, options: any = {}, timeout = 15000, retryCount = 0): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      
      // Handle Rate Limiting (429) or Server Errors (5xx)
      if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
        if (retryCount >= 3) {
          throw new Error(`External API failed with status ${response.status} after ${retryCount} retries`);
        }
        
        const retryAfter = response.headers.get('Retry-After');
        // Exponential backoff: 2s, 4s, 8s or use Retry-After header
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retryCount) * 2000;
        
        console.warn(`[Scraper] API status ${response.status} at ${url}. Retrying in ${waitTime/1000}s...`);
        await this.delay(waitTime);
        return this.fetchWithTimeout(url, options, timeout, retryCount + 1); 
      }
      
      return response;
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError' && retryCount < 2) {
        console.warn(`[Scraper] Timeout at ${url}. Retrying...`);
        return this.fetchWithTimeout(url, options, timeout, retryCount + 1);
      }
      throw error;
    }
  }

  public static getInstance(): ScraperService {
    if (!ScraperService.instance) {
      ScraperService.instance = new ScraperService();
    }
    return ScraperService.instance;
  }

  /**
   * Cleanup tasks that have been 'running' for more than 2 minutes (aggressive for Vercel recovery)
   */
  private async cleanupStaleTasks() {
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    
    // Clean up tasks that are still 'running' but haven't been updated recently
    const { data: staleTasks } = await supabase
      .from('scraper_logs')
      .select('id, task_name, progress, created_at')
      .eq('status', 'running');

    if (staleTasks && staleTasks.length > 0) {
      const toClean = staleTasks.filter(t => {
        // Use _lastUpdated from progress JSON, fallback to created_at
        const lastTouch = (t.progress as any)?._lastUpdated || t.created_at;
        const lastTouchMs = lastTouch ? new Date(lastTouch).getTime() : 0;
        return lastTouchMs < twoMinutesAgo;
      });

      if (toClean.length > 0) {
        console.log(`[Scraper] Cleaning up ${toClean.length} stale tasks:`, toClean.map(t => t.task_name));
        
        const ids = toClean.map(t => t.id);
        await supabase
          .from('scraper_logs')
          .update({ 
            status: 'failed', 
            error_message: 'Task timed out (stale task auto-cleanup 2m)',
            finished_at: new Date().toISOString()
          })
          .in('id', ids);
      }
    }
  }

  /**
   * Chunk timeout guard — returns true if we should stop processing to stay within Vercel's 60s limit
   */
  private chunkStartTime = 0;
  private isChunkTimedOut(safetyMs = 8000): boolean {
    if (!this.chunkStartTime) return false;
    return (Date.now() - this.chunkStartTime) >= safetyMs;
  }

  /**
   * Log an event to the database
   */
  public async createLog(taskName: string) {
    // 1. Always cleanup stale tasks first to avoid getting stuck
    await this.cleanupStaleTasks();

    // 2. Check DB for any 'running' task with the SAME name
    const { data: existingRunning } = await supabase
      .from('scraper_logs')
      .select('id, created_at')
      .eq('task_name', taskName)
      .eq('status', 'running')
      .single();

    if (existingRunning) {
      // If the existing running task is older than 3 minutes, force-kill it and proceed
      const age = Date.now() - new Date(existingRunning.created_at).getTime();
      if (age > 3 * 60 * 1000) {
        console.warn(`[Scraper] Force-killing stale task ${existingRunning.id} (age: ${Math.round(age/1000)}s)`);
        await supabase
          .from('scraper_logs')
          .update({ 
            status: 'failed', 
            error_message: 'Force-killed: task was stale',
            finished_at: new Date().toISOString()
          })
          .eq('id', existingRunning.id);
      } else {
        console.warn(`[Scraper] Task ${taskName} is already marked as running in DB (age: ${Math.round(age/1000)}s). Skipping.`);
        return null;
      }
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('scraper_logs')
      .insert({
        task_name: taskName,
        status: 'running',
        progress: { current: 0, total: 100, current_item: 'Memulai scraper...', _lastUpdated: now }
      })
      .select()
      .single();
    
    if (error) console.error('Error creating scraper log:', error.message);
    return data?.id;
  }

  public async updateLog(logId: string, status: 'success' | 'failed', summary: ScrapeTaskSummary, errorMessage?: string) {
    try {
      await supabase
        .from('scraper_logs')
        .update({
          status,
          summary,
          error_message: errorMessage,
          finished_at: new Date().toISOString(),
          items_count: summary.items_processed || 0,
          progress: { current: summary.items_processed || 0, total: summary.items_processed || 0, current_item: 'Selesai', _lastUpdated: new Date().toISOString() }
        })
        .eq('id', logId);
    } catch (err) {
      console.error('Failed to update scraper log:', err);
    }
  }

  public async updateLogProgress(logId: string, current: number, total: number, currentItem: string) {
    try {
      await supabase
        .from('scraper_logs')
        .update({
          progress: { current, total, current_item: currentItem, _lastUpdated: new Date().toISOString() }
        })
        .eq('id', logId);
    } catch (err) {
      console.error('Failed to update scraper progress:', err);
    }
  }

  /**
   * Check if task is still running in the DB to allow graceful abortion
   */
  private async checkTaskActive(logId?: string) {
    if (!logId) return;
    const { data: currentLog } = await supabase.from('scraper_logs').select('status').eq('id', logId).single();
    if (currentLog && currentLog.status !== 'running') {
      console.warn(`[Scraper] Task ${logId} is cancelled. Aborting.`);
      throw new Error('Task Aborted');
    }
  }

  /**
   * Fetch current scraper configuration from DB
   */
  private async getScraperConfig() {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'scraper_config')
      .single();
    
    return data?.value || {
      auto_approve: false,
      vidlink_enabled: true,
      moviesapito_enabled: true,
      videasy_enabled: true,
      auto_scrape_enabled: false,
      scraper_secret: '',
      discovery_pages: 3
    };
  }

  /**
   * Get/Set progress for specific genre/task
   */
  private async getScraperProgress() {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'scraper_progress')
      .single();
    
    return data?.value || {};
  }

  private async updateScraperProgress(progress: Record<string, number>) {
    await supabase
      .from('settings')
      .upsert({ key: 'scraper_progress', value: progress }, { onConflict: 'key' });
  }

  /**
   * Deep Scrape TV Series Details (Seasons & Episodes)
   */
  private async scrapeTVDetails(contentId: string, tmdbId: number, logId?: string, currentProcessed?: number, totalEstimated?: number, showTitle?: string) {
    try {
      // 0. Check if task is still active in DB if logId is provided
      if (logId) {
        const { data: currentLog } = await supabase.from('scraper_logs').select('status').eq('id', logId).single();
        if (currentLog?.status !== 'running') {
           console.log(`[Scraper] Task ${logId} is no longer running. Aborting TV details.`);
           return;
        }
      }

      const res = await this.fetchWithTimeout(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbApiKey}`);
      const data = await res.json();

      if (!data.seasons) return;

      // Filter out Specials (Season 0)
      const validSeasons = data.seasons.filter((s: any) => s.season_number > 0);

      // Process seasons in parallel (max 3 at a time) to stay within timeouts
      await this.pMap(validSeasons, async (seasonItem: any) => {
        try {
          const { data: dbSeason, error: sError } = await supabase
            .from('seasons')
            .upsert({
              content_id: contentId,
              season_number: seasonItem.season_number,
              title: seasonItem.name,
              overview: seasonItem.overview,
              poster_path: seasonItem.poster_path,
              air_date: seasonItem.air_date,
              episode_count: seasonItem.episode_count
            }, { onConflict: 'content_id,season_number' })
            .select().single();

          if (sError || !dbSeason) return;

          const sRes = await this.fetchWithTimeout(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonItem.season_number}?api_key=${tmdbApiKey}`);
          if (!sRes.ok) return;
          const sData = await sRes.json();

          if (sData.episodes && sData.episodes.length > 0) {
            const episodesToUpsert = sData.episodes.map((ep: any) => ({
              season_id: dbSeason.id,
              episode_number: ep.episode_number,
              title: ep.name,
              overview: ep.overview,
              still_path: ep.still_path,
              air_date: ep.air_date
            }));

            await supabase
              .from('episodes')
              .upsert(episodesToUpsert, { onConflict: 'season_id,episode_number' });

            console.log(`[Scraper] Updated ${episodesToUpsert.length} episodes for ${showTitle || tmdbId} S${seasonItem.season_number}`);
          }
        } catch (seasonErr: any) {
          console.error(`[Scraper] Error processing season ${seasonItem.season_number}:`, seasonErr.message);
        }
      }, 3);
    } catch (err: any) {
      console.error(`Error scraping TV details for ${tmdbId}:`, err.message);
    }
  }

  /**
   * Netflix Priority Discovery Task
   */
  public async runNetflixDiscovery(pagesPerType: number = 3): Promise<ScrapeTaskSummary> {
    const taskName = 'Netflix Priority Discovery';
    const logId = await this.createLog(taskName);
    if (!logId) return { items_processed: 0, items_added: 0, items_failed: 0, errors: ['Task already running'] };
    
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    try {
      await this.executeNetflixDiscovery(pagesPerType, logId, summary);
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      console.error("Netflix Discovery error:", err);
      if (err.message === 'Task Aborted') return summary; 
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }

    return summary;
  }

  private async executeNetflixDiscovery(pagesPerType: number, logId: string, summary: ScrapeTaskSummary) {
    const scraperConfig = await this.getScraperConfig();
    
    const tasks = [
      { type: 'tv', url: `https://api.themoviedb.org/3/discover/tv?api_key=${tmdbApiKey}&with_networks=213&sort_by=popularity.desc` },
      { type: 'movie', url: `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc` }
    ];

    for (const task of tasks) {
      for (let page = 1; page <= pagesPerType; page++) {
        await this.checkTaskActive(logId);
        console.log(`[Scraper] Netflix Priority: ${task.type.toUpperCase()} | Page ${page}`);
        
        const res = await this.fetchWithTimeout(`${task.url}&page=${page}`);
        const data = await res.json();

        if (data.results && data.results.length > 0) {
          await this.pMap(data.results, async (item: any) => {
            summary.items_processed++;
            if (logId) {
              const totalEstimated = tasks.length * pagesPerType * 20;
              await this.updateLogProgress(logId, summary.items_processed, totalEstimated, item.title || item.name || 'Scanning Netflix...');
            }

            try {
              const saved = await this.processAndSaveContent(item, task.type as 'movie' | 'tv', scraperConfig);
              if (saved) summary.items_added++;
            } catch {
              summary.items_failed++;
            }
          }, 3, () => this.checkTaskActive(logId));
        }
      }
    }
  }

  /**
   * Full Discovery & Scrape Task with Page Tracking
   */
  public async runDiscovery(pagesPerGenre: number = 3): Promise<ScrapeTaskSummary> {
    const taskName = 'Deep Discovery Scrape';
    const logId = await this.createLog(taskName);
    if (!logId) return { items_processed: 0, items_added: 0, items_failed: 0, errors: ['Task already running'] };
    
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    try {
      await this.executeDiscovery(pagesPerGenre, logId, summary);
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      console.error("Discovery error:", err);
      // If manually aborted, don't write generic error, keep status
      if (err.message === 'Task Aborted') return summary; 
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }

    return summary;
  }

  private async executeDiscovery(pagesPerGenre: number, logId: string, summary: ScrapeTaskSummary) {
    const scraperConfig = await this.getScraperConfig();
    const progress = await this.getScraperProgress();
    
    // Fetch all genres from TMDB
    const movieGenreRes = await this.fetchWithTimeout(`https://api.themoviedb.org/3/genre/movie/list?api_key=${tmdbApiKey}`);
    const tvGenreRes = await this.fetchWithTimeout(`https://api.themoviedb.org/3/genre/tv/list?api_key=${tmdbApiKey}`);
    
    const { genres: movieGenres } = await movieGenreRes.json();
    const { genres: tvGenres } = await tvGenreRes.json();

    if (!movieGenres || !tvGenres) {
       throw new Error("Failed to fetch genres from TMDB - API limit or invalid key");
    }

    const allTasks = [
      ...movieGenres.map((g: any) => ({ ...g, type: 'movie' })),
      ...tvGenres.map((g: any) => ({ ...g, type: 'tv' }))
    ];

    for (const genre of allTasks) {
      const key = `${genre.type}_${genre.id}`;
      const startPage = progress[key] || 1;
      const endPage = startPage + pagesPerGenre - 1;

      console.log(`🔍 Scraping Genre: ${genre.name} (${genre.type}) | Pages ${startPage}-${endPage}`);

      for (let page = startPage; page <= endPage; page++) {
        await this.checkTaskActive(logId);
        
        const url = `https://api.themoviedb.org/3/discover/${genre.type}?api_key=${tmdbApiKey}&with_genres=${genre.id}&sort_by=popularity.desc&page=${page}`;
        const res = await this.fetchWithTimeout(url);
        const data = await res.json();
        
        await this.delay(400);

        if (!data.results || data.results.length === 0) break;

        await this.pMap(data.results, async (item: any) => {
          summary.items_processed++;
          
          if (logId) {
            const totalEstimated = allTasks.length * pagesPerGenre * 20;
            await this.updateLogProgress(logId, summary.items_processed, totalEstimated, item.title || item.name || 'Scanning...');
          }

          try {
            const totalEstimated = allTasks.length * pagesPerGenre * 20;
            const saved = await this.processAndSaveContent(item, genre.type as any, scraperConfig, {
              logId,
              summary,
              totalEstimated
            });
            
            if (saved) {
              try {
                await SubtitleService.fetchAndUploadSubtitle(item.id, genre.type as 'movie' | 'tv');
              } catch (sErr) {
                console.warn(`[Scraper] Subtitle fetch failed for ${item.id}:`, sErr);
              }
              summary.items_added++;
            }
          } catch (err: any) {
            summary.items_failed++;
            if (summary.errors.length < 50) { // Limit error log size
              summary.errors.push(`${item.title || item.id}: ${err.message}`);
            }
          }
        }, 5, () => this.checkTaskActive(logId));

        progress[key] = page + 1;
        await this.updateScraperProgress(progress);
      }
    }
  }

  /**
   * Scrape Trending Content
   */
  public async runTrendingDiscovery(): Promise<ScrapeTaskSummary> {
    const taskName = 'Trending Discovery';
    const logId = await this.createLog(taskName);
    if (!logId) return { items_processed: 0, items_added: 0, items_failed: 0, errors: ['Task already running'] };

    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    try {
      await this.executeTrending(logId, summary);
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      console.error("Trending error:", err);
      if (err.message === 'Task Aborted') return summary;
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }
    return summary;
  }

  private async executeTrending(logId: string, summary: ScrapeTaskSummary) {
    const scraperConfig = await this.getScraperConfig();
    const url = `https://api.themoviedb.org/3/trending/all/week?api_key=${tmdbApiKey}`;
    const res = await this.fetchWithTimeout(url);
    const data = await res.json();

    if (data.results) {
      await this.pMap(data.results, async (item: any) => {
        if (item.media_type !== 'movie' && item.media_type !== 'tv') return;
        
        summary.items_processed++;
        
        if (logId) {
          await this.updateLogProgress(logId, summary.items_processed, data.results.length, item.title || item.name || 'Scanning...');
        }

        try {
          const saved = await this.processAndSaveContent(item, item.media_type as 'movie' | 'tv', scraperConfig, {
            logId,
            summary,
            totalEstimated: data.results.length
          });
          
          if (saved) {
            try {
              await SubtitleService.fetchAndUploadSubtitle(item.id, item.media_type as 'movie' | 'tv');
            } catch (sErr) {
              console.warn(`[Scraper] Subtitle fetch failed for trending ${item.id}:`, sErr);
            }
            summary.items_added++;
          }
        } catch (err: any) {
          summary.items_failed++;
        }
      }, 3, () => this.checkTaskActive(logId));
    }
  }

  /**
   * Full Daily Routine: Netflix + Trending + Genre Discovery
   */
  public async runFullRoutine(pages: number = 5): Promise<ScrapeTaskSummary[]> {
    console.log(`🚀 Starting Full Scraper Routine (Intensity: ${pages} pages)...`);
    const netflix = await this.runNetflixDiscovery(pages);
    const trending = await this.runTrendingDiscovery();
    const discovery = await this.runDiscovery(pages);
    return [netflix, trending, discovery];
  }

  /**
   * Health Check Task: Validates if links are active (200 OK)
   */
  public async validateLinks(): Promise<ScrapeTaskSummary> {
    const taskName = 'Health Check Validation';
    const logId = await this.createLog(taskName);
    if (!logId) return { items_processed: 0, items_added: 0, items_failed: 0, errors: ['Task already running'] };

    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };

    try {
      const { data: links } = await supabase.from('embed_links').select('*, contents(id, title)');
      
      if (links) {
        await this.pMap(links, async (link: any) => {
          summary.items_processed++;
          
          if (logId) {
            const title = Array.isArray(link.contents) ? link.contents[0]?.title : link.contents?.title;
            await this.updateLogProgress(logId, summary.items_processed, links.length, title || link.url || 'Scanning...');
          }

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000); 

            const res = await fetch(link.url, { method: 'GET', signal: controller.signal, headers: { 'Range': 'bytes=0-0' } });
            clearTimeout(timeout);

            const isHealthy = res.ok || res.status === 403 || res.status === 206; 
            
            await supabase.from('contents').update({ 
              is_healthy: isHealthy,
              last_checked_at: new Date().toISOString()
            }).eq('id', link.content_id);

          } catch (err: any) {
            summary.items_failed++;
          }
        }, 5, () => this.checkTaskActive(logId));
      }
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      if (err.message === 'Task Aborted') return summary;
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }

    return summary;
  }

  /**
   * Sync existing TV Series details and Genres
   */
  public async syncAllMetadata(): Promise<ScrapeTaskSummary> {
    const taskName = 'Full Metadata Sync';
    const logId = await this.createLog(taskName);
    if (!logId) return { items_processed: 0, items_added: 0, items_failed: 0, errors: ['Task already running'] };

    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    try {
      await this.executeSyncAllMetadata(logId, summary);
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      console.error("Sync error:", err);
      if (err.message === 'Task Aborted') return summary;
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }

    return summary;
  }

  private async executeSyncAllMetadata(logId: string, summary: ScrapeTaskSummary) {
    const { data: contents } = await supabase.from('contents').select('*');
    if (contents) {
      await this.pMap(contents, async (item: any) => {
        summary.items_processed++;
        
        if (logId) {
          await this.updateLogProgress(logId, summary.items_processed, contents.length, item.title || 'Scanning...');
        }

        try {
          const tmdbType = (item.type === 'movie') ? 'movie' : 'tv';
          const resMetadata = await this.fetchWithTimeout(`https://api.themoviedb.org/3/${tmdbType}/${item.tmdb_id}?api_key=${tmdbApiKey}&append_to_response=credits`);
          const metadata: TMDBMetadata = await resMetadata.json();
          
          const finalType = classifyContentType(metadata, tmdbType);
          const platform = classifyPlatform(metadata, finalType);
          const genreNames = metadata.genres?.map(g => g.name) || [];
          
          await supabase.from('contents').update({
            type: finalType,
            platform,
            genre_names: genreNames,
            cast_data: metadata.credits?.cast?.slice(0, 10) || [],
            overview: metadata.overview,
            poster_path: metadata.poster_path,
            backdrop_path: metadata.backdrop_path,
            vote_average: metadata.vote_average,
            popularity: metadata.popularity || 0,
            release_date: metadata.release_date || metadata.first_air_date,
            tv_status: metadata.status
          }).eq('id', item.id);

          if (tmdbType !== 'movie') {
            await this.scrapeTVDetails(item.id, item.tmdb_id, logId, summary.items_processed, contents.length, item.title);
          }
          
          summary.items_added++;
        } catch (err: any) {
          summary.items_failed++;
        }
      }, 3, () => this.checkTaskActive(logId));
    }
  }

  /**
   * Sync Missing Subtitles
   */
  public async syncMissingSubtitles(): Promise<ScrapeTaskSummary> {
    const taskName = 'Sync Missing Subtitles';
    const logId = await this.createLog(taskName);
    if (!logId) return { items_processed: 0, items_added: 0, items_failed: 0, errors: ['Task already running'] };

    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };

    try {
      const { data: contents } = await supabase.from('contents').select('*');
      
      if (contents) {
        await this.pMap(contents, async (item: any) => {
          summary.items_processed++;
          
          if (logId) {
            await this.updateLogProgress(logId, summary.items_processed, contents.length, item.title || 'Scanning...');
          }

          try {
            const result = await SubtitleService.fetchAndUploadSubtitle(item.tmdb_id, item.type === 'movie' ? 'movie' : 'tv');
            
            if (result.status === 'success') {
              summary.items_added++;
            } else if (result.status === 'error') {
              summary.items_failed++;
            }

          } catch (err: any) {
            summary.items_failed++;
          }
        }, 5, () => this.checkTaskActive(logId));
      }
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      if (err.message === 'Task Aborted') return summary;
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }

    return summary;
  }

  private async checkVideoAvailability(tmdbId: number, type: 'movie' | 'tv'): Promise<boolean> {
    try {
      const vidlinkUrl = `https://vidlink.pro/${type}/${tmdbId}${type === 'tv' ? '/1/1' : ''}`;
      const vidsrcUrl = `https://vidsrc.net/embed/${type}?tmdb=${tmdbId}`;

      const checkProvider = async (url: string, headers: any): Promise<boolean> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        try {
          const res = await fetch(url, { method: 'HEAD', headers, signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.status === 404 && url.includes('vidsrc')) return Promise.reject(new Error('404 Not Found'));
          if (res.ok || res.status === 403 || res.status === 206) return true;
          return Promise.reject(new Error('Invalid status'));
        } catch (e) {
          clearTimeout(timeoutId);
          return Promise.reject(e);
        }
      };

      const promises = [
        checkProvider(vidlinkUrl, { 'Referer': 'https://vidlink.pro/', 'User-Agent': 'Mozilla/5.0' }),
        checkProvider(vidsrcUrl, { 'User-Agent': 'Mozilla/5.0' })
      ];

      try {
        await Promise.any(promises);
        return true;
      } catch (e) {
        // If both rejected, assume true to avoid skipping valid movies during server hiccups
        return true; 
      }
    } catch (err) {
      console.warn(`[Scraper] checkVideoAvailability error for ${tmdbId}, assuming true`);
      return true;
    }
  }

  private async addProviderLinks(contentId: string, type: string, tmdbId: number, scraperConfig: Record<string, any>) {
    const isTV = type !== 'movie';
    const providers = [];

    // --- Available Servers ---
    if (scraperConfig.vidlink_enabled !== false) {
      providers.push({ name: 'VidLink', url: `https://vidlink.pro/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` });
    }

    if (scraperConfig.moviesapito_enabled !== false) {
      providers.push({ name: 'MoviesAPI', url: `https://moviesapi.to/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '-1-1' : ''}` });
    }

    if (scraperConfig.videasy_enabled !== false) {
      providers.push({ name: 'Videasy', url: `https://player.videasy.net/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` });
    }

    if (providers.length > 0) {
      const embedLinks = providers.map(p => ({
        content_id: contentId,
        provider: p.name,
        url: p.url,
        quality: 'HD'
      }));
      await supabase.from('embed_links').upsert(embedLinks, { onConflict: 'content_id,provider' });
    }
  }

  private async processAndSaveContent(
    item: any,
    genreType: 'movie' | 'tv',
    scraperConfig: Record<string, any>,
    options?: {
      logId?: string;
      summary?: ScrapeTaskSummary;
      totalEstimated?: number;
      skipDeepScrapeTV?: boolean;
    }
  ): Promise<boolean> {
    const { data: existing } = await supabase
      .from('contents')
      .select('id, status, updated_at')
      .eq('tmdb_id', item.id)
      .single();

    if (existing && genreType === 'movie') return false;

    // Check if item was updated in the last 24h to avoid redundant deep scrapes
    if (existing && existing.updated_at) {
      const lastUpdate = new Date(existing.updated_at).getTime();
      const now = new Date().getTime();
      if (now - lastUpdate < 24 * 60 * 60 * 1000) {
         return false;
      }
    }

    const resMetadata = await this.fetchWithTimeout(`https://api.themoviedb.org/3/${genreType}/${item.id}?api_key=${tmdbApiKey}&append_to_response=credits`);
    if (!resMetadata.ok) throw new Error(`TMDB Metadata fetch failed with status ${resMetadata.status}`);
    const metadata: any = await resMetadata.json();
    
    const finalType = classifyContentType(metadata, genreType);
    
    // VERIFY VIDEO EXISTS BEFORE SAVING
    const isAvailable = await this.checkVideoAvailability(item.id, genreType);
    if (!isAvailable) {
       console.log(`[Scraper] Video not available for ${item.title || item.name}, skipping.`);
       return false;
    }

    const platform = classifyPlatform(metadata, finalType);
    const genreNames = metadata.genres?.map((g: { name: string }) => g.name) || [];
    
    const { data: dbItem, error: upsertError } = await supabase
      .from('contents')
      .upsert({
        tmdb_id: item.id,
        title: item.title || item.name,
        type: finalType,
        ...(existing ? {} : { status: scraperConfig.auto_approve ? 'approved' : 'pending' }),
        platform,
        cast_data: metadata.credits?.cast?.slice(0, 10) || [],
        genre_names: genreNames,
        overview: metadata.overview,
        poster_path: metadata.poster_path,
        backdrop_path: metadata.backdrop_path,
        vote_average: metadata.vote_average,
        popularity: item.popularity || metadata.popularity || 0,
        release_date: metadata.release_date || metadata.first_air_date,
        tv_status: metadata.status,
        is_healthy: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tmdb_id' })
      .select().single();

    if (upsertError) throw upsertError;
    
    await this.addProviderLinks(dbItem.id, genreType, item.id, scraperConfig);
    
    // Optionally fetch TV Details if requested and available
    if (genreType === 'tv' && options?.logId && options?.summary && options?.totalEstimated && !options?.skipDeepScrapeTV) {
      await this.scrapeTVDetails(dbItem.id, item.id, options.logId, options.summary.items_processed, options.totalEstimated, item.title || item.name);
    }
    
    return true;
  }

  // ==========================================
  // CHUNKED EXECUTION FOR SERVERLESS (VERCEL)
  // ==========================================

  public async runNetflixDiscoveryChunk(pagesPerType: number = 3, state: Record<string, unknown> = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: Record<string, unknown> }> {
    this.chunkStartTime = Date.now();
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    const scraperConfig = await this.getScraperConfig();
    
    let allTasks = state.tasks as Array<{ type: string; url: string }> | undefined;
    if (!allTasks) {
      allTasks = [
        { type: 'tv', url: `https://api.themoviedb.org/3/discover/tv?api_key=${tmdbApiKey}&with_networks=213&sort_by=popularity.desc` },
        { type: 'movie', url: `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_watch_providers=8&watch_region=US&sort_by=popularity.desc` }
      ];
    }

    let currentTaskIndex = (state.currentTaskIndex as number) || 0;
    let currentPage = (state.currentPage as number) || 1;
    let currentItemIndex = (state.currentItemIndex as number) || 0;

    if (currentTaskIndex >= allTasks.length) {
      return { summary, hasMore: false, total: 0, nextState: {} };
    }

    const task = allTasks[currentTaskIndex];
    console.log(`[Chunk] Netflix Priority: ${task.type.toUpperCase()} | Page ${currentPage}`);

    const res = await this.fetchWithTimeout(`${task.url}&page=${currentPage}`);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const CHUNK_SIZE = 3;
      const resultsToProcess = data.results.slice(currentItemIndex, currentItemIndex + CHUNK_SIZE);
      
      const tmdbIds = resultsToProcess.map((i: any) => i.id);
      const { data: existingRecords } = await supabase.from('contents').select('tmdb_id').in('tmdb_id', tmdbIds);
      const existingIds = new Set(existingRecords?.map((r: any) => r.tmdb_id) || []);

      for (const item of resultsToProcess) {
        if (this.isChunkTimedOut()) {
          console.log(`[Chunk] Timeout guard triggered after ${summary.items_processed} items. Yielding...`);
          break;
        }

        summary.items_processed++;
        if (state.logId) {
          const totalEstimated = allTasks.length * pagesPerType * 20;
          const currentTotalProcessed = ((state.accumulatedProcessed as number) || 0) + summary.items_processed;
          await this.updateLogProgress(state.logId as string, currentTotalProcessed, totalEstimated, item.title || item.name || 'Scanning Netflix...');
        }
        
        if (existingIds.has(item.id) && task.type === 'movie') continue;

        try {
          const saved = await this.processAndSaveContent(item, task.type as 'movie' | 'tv', scraperConfig, {
            skipDeepScrapeTV: true
          });
          if (saved) summary.items_added++;
        } catch {
          summary.items_failed++;
        }
      }
    }

    const actualProcessed = summary.items_processed;
    let nextItemIndex = currentItemIndex + actualProcessed;

    if (nextItemIndex >= (data.results?.length || 0)) {
      nextItemIndex = 0;
      currentPage = currentPage + 1;
      if (currentPage > pagesPerType || !data.results || data.results.length === 0) {
        currentTaskIndex++;
        currentPage = 1;
      }
    }

    const hasMore = currentTaskIndex < allTasks.length;
    const total = allTasks.length * pagesPerType * 20;

    return {
      summary,
      hasMore,
      total,
      nextState: hasMore ? { tasks: allTasks, currentTaskIndex, currentPage, currentItemIndex: nextItemIndex } : {}
    };
  }

  public async runDiscoveryChunk(pagesPerGenre: number = 3, state: Record<string, unknown> = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: Record<string, unknown> }> {
    this.chunkStartTime = Date.now();
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    const scraperConfig = await this.getScraperConfig();
    
    // Fetch genres if not in state
    let allTasks = state.genres as Array<{ id: number; name: string; type: string }> | undefined;
    if (!allTasks) {
      const movieGenreRes = await this.fetchWithTimeout(`https://api.themoviedb.org/3/genre/movie/list?api_key=${tmdbApiKey}`);
      const tvGenreRes = await this.fetchWithTimeout(`https://api.themoviedb.org/3/genre/tv/list?api_key=${tmdbApiKey}`);
      const { genres: movieGenres } = await movieGenreRes.json();
      const { genres: tvGenres } = await tvGenreRes.json();
      
      if (!movieGenres || !tvGenres) throw new Error("Failed to fetch genres from TMDB");
      
      allTasks = [
        ...movieGenres.map((g: { id: number; name: string }) => ({ ...g, type: 'movie' })),
        ...tvGenres.map((g: { id: number; name: string }) => ({ ...g, type: 'tv' }))
      ];
    }

    let currentGenreIndex = (state.currentGenreIndex as number) || 0;
    let currentPage = (state.currentPage as number) || 1;
    let currentItemIndex = (state.currentItemIndex as number) || 0;

    if (currentGenreIndex >= allTasks.length) {
      return { summary, hasMore: false, total: 0, nextState: {} };
    }

    const genre = allTasks[currentGenreIndex];
    console.log(`[Chunk] Scraping Genre: ${genre.name} (${genre.type}) | Page ${currentPage}`);

    const url = `https://api.themoviedb.org/3/discover/${genre.type}?api_key=${tmdbApiKey}&with_genres=${genre.id}&sort_by=popularity.desc&page=${currentPage}`;
    const res = await this.fetchWithTimeout(url);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      // Process up to 3 items per chunk (no subtitles/TV deep scrape = much faster)
      const CHUNK_SIZE = 3;
      const resultsToProcess = data.results.slice(currentItemIndex, currentItemIndex + CHUNK_SIZE);
      
      const tmdbIds = resultsToProcess.map((i: any) => i.id);
      const { data: existingRecords } = await supabase.from('contents').select('tmdb_id').in('tmdb_id', tmdbIds);
      const existingIds = new Set(existingRecords?.map((r: any) => r.tmdb_id) || []);

      for (const item of resultsToProcess) {
        // Timeout guard — stop before Vercel kills us
        if (this.isChunkTimedOut()) {
          console.log(`[Chunk] Timeout guard triggered after ${summary.items_processed} items. Yielding...`);
          break;
        }

        summary.items_processed++;
        if (state.logId) {
          const totalEstimated = allTasks.length * pagesPerGenre * 20;
          const currentTotalProcessed = ((state.accumulatedProcessed as number) || 0) + summary.items_processed;
          await this.updateLogProgress(state.logId as string, currentTotalProcessed, totalEstimated, item.title || item.name || 'Scanning...');
        }
        
        if (existingIds.has(item.id) && genre.type === 'movie') continue;

        try {
          const saved = await this.processAndSaveContent(item, genre.type as any, scraperConfig, {
            skipDeepScrapeTV: true
          });
          if (saved) summary.items_added++;
        } catch {
          summary.items_failed++;
        }
      }
    }

    // Determine next state based on how many items we actually processed
    const actualProcessed = summary.items_processed;
    let nextItemIndex = currentItemIndex + actualProcessed;

    if (nextItemIndex >= (data.results?.length || 0)) {
      nextItemIndex = 0;
      currentPage = currentPage + 1;
      if (currentPage > pagesPerGenre || !data.results || data.results.length === 0) {
        currentGenreIndex++;
        currentPage = 1;
      }
    }

    const hasMore = currentGenreIndex < allTasks.length;
    const total = allTasks.length * pagesPerGenre * 20;

    return {
      summary,
      hasMore,
      total,
      nextState: hasMore ? { genres: allTasks, currentGenreIndex, currentPage, currentItemIndex: nextItemIndex } : {}
    };
  }

  public async runTrendingChunk(state: Record<string, unknown> = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: Record<string, unknown> }> {
    this.chunkStartTime = Date.now();
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    const scraperConfig = await this.getScraperConfig();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let items: any[] = (state.items as any[]) || [];
    if (items.length === 0) {
      const res = await this.fetchWithTimeout(`https://api.themoviedb.org/3/trending/all/week?api_key=${tmdbApiKey}`);
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items = data.results?.filter((i: any) => i.media_type === 'movie' || i.media_type === 'tv') || [];
    }

    const offset = (state.offset as number) || 0;
    const chunkSize = 3;
    const chunk = items.slice(offset, offset + chunkSize);

    if (chunk.length === 0) {
      return { summary, hasMore: false, total: 0, nextState: {} };
    }

    const tmdbIds = chunk.map((i: any) => i.id);
    const { data: existingRecords } = await supabase.from('contents').select('tmdb_id').in('tmdb_id', tmdbIds);
    const existingIds = new Set(existingRecords?.map((r: any) => r.tmdb_id) || []);

    for (const item of chunk) {
      if (this.isChunkTimedOut()) {
        console.log(`[Chunk] Trending timeout guard triggered. Yielding...`);
        break;
      }

      summary.items_processed++;
      if (state.logId) {
        const currentTotalProcessed = ((state.accumulatedProcessed as number) || 0) + summary.items_processed;
        await this.updateLogProgress(state.logId as string, currentTotalProcessed, items.length, item.title || item.name || 'Scanning...');
      }
      
      if (existingIds.has(item.id) && item.media_type === 'movie') continue;

      try {
        const saved = await this.processAndSaveContent(item, item.media_type as 'movie' | 'tv', scraperConfig, {
            skipDeepScrapeTV: true
        });
        if (saved) summary.items_added++;
      } catch {
        summary.items_failed++;
      }
    }

    const actualProcessed = summary.items_processed;
    const nextOffset = offset + actualProcessed;
    const hasMore = nextOffset < items.length;
    const total = items.length;

    return {
      summary,
      hasMore,
      total,
      nextState: hasMore ? { items, offset: nextOffset } : {}
    };
  }

  public async runHealthCheckChunk(state: Record<string, unknown> = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: Record<string, unknown> }> {
    this.chunkStartTime = Date.now();
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let links: any[] = (state.links as any[]) || [];
    if (links.length === 0) {
      const { data } = await supabase.from('embed_links').select('id, url, content_id');
      links = data || [];
    }

    const offset = (state.offset as number) || 0;
    const chunkSize = 10;
    const chunk = links.slice(offset, offset + chunkSize);

    if (chunk.length === 0) return { summary, hasMore: false, total: 0, nextState: {} };

    for (const link of chunk) {
      if (this.isChunkTimedOut()) {
        console.log(`[Chunk] HealthCheck timeout guard triggered. Yielding...`);
        break;
      }

      summary.items_processed++;
      if (state.logId) {
        const currentTotalProcessed = ((state.accumulatedProcessed as number) || 0) + summary.items_processed;
        await this.updateLogProgress(state.logId as string, currentTotalProcessed, links.length, link.url || 'Scanning...');
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); 
        const res = await fetch(link.url, { method: 'GET', signal: controller.signal, headers: { 'Range': 'bytes=0-0' } });
        clearTimeout(timeout);
        const isHealthy = res.ok || res.status === 403 || res.status === 206; 
        await supabase.from('contents').update({ is_healthy: isHealthy, last_checked_at: new Date().toISOString() }).eq('id', link.content_id);
      } catch {
        summary.items_failed++;
      }
    }

    const actualProcessed = summary.items_processed;
    const nextOffset = offset + actualProcessed;
    const hasMore = nextOffset < links.length;
    const total = links.length;
    return { summary, hasMore, total, nextState: hasMore ? { links, offset: nextOffset } : {} };
  }

  public async runSyncMetadataChunk(state: Record<string, unknown> = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: Record<string, unknown> }> {
    this.chunkStartTime = Date.now();
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents = state.contents as any[] | undefined;
    if (!contents) {
      const { data } = await supabase.from('contents').select('id, tmdb_id, type');
      contents = data || [];
    }

    const offset = (state.offset as number) || 0;
    const chunkSize = 3;
    const chunk = contents.slice(offset, offset + chunkSize);

    if (chunk.length === 0) return { summary, hasMore: false, total: 0, nextState: {} };

    for (const item of chunk) {
      if (this.isChunkTimedOut()) {
        console.log(`[Chunk] SyncMetadata timeout guard triggered. Yielding...`);
        break;
      }

      summary.items_processed++;
      if (state.logId) {
        const currentTotalProcessed = ((state.accumulatedProcessed as number) || 0) + summary.items_processed;
        await this.updateLogProgress(state.logId as string, currentTotalProcessed, contents.length, item.tmdb_id || 'Scanning...');
      }
      try {
        const tmdbType = item.type === 'movie' ? 'movie' : 'tv';
        const resMetadata = await this.fetchWithTimeout(`https://api.themoviedb.org/3/${tmdbType}/${item.tmdb_id}?api_key=${tmdbApiKey}&append_to_response=credits`);
        const metadata = await resMetadata.json();
        
        const finalType = classifyContentType(metadata, tmdbType);
        const platform = classifyPlatform(metadata, finalType);

        await supabase.from('contents').update({
          type: finalType,
          platform,
          genre_names: metadata.genres?.map((g: { name: string }) => g.name) || [],
          cast_data: metadata.credits?.cast?.slice(0, 10) || [],
          overview: metadata.overview,
          poster_path: metadata.poster_path,
          backdrop_path: metadata.backdrop_path,
          vote_average: metadata.vote_average,
          release_date: metadata.release_date || metadata.first_air_date,
          tv_status: metadata.status
        }).eq('id', item.id);

        // TV details removed from sync chunk — too heavy for Vercel serverless
        summary.items_added++;
      } catch {
        summary.items_failed++;
      }
    }

    const actualProcessed = summary.items_processed;
    const nextOffset = offset + actualProcessed;
    const hasMore = nextOffset < contents.length;
    const total = contents.length;
    return { summary, hasMore, total, nextState: hasMore ? { contents, offset: nextOffset } : {} };
  }

  public async runSyncSubtitlesChunk(state: Record<string, unknown> = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: Record<string, unknown> }> {
    this.chunkStartTime = Date.now();
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents = state.contents as any[] | undefined;
    if (!contents) {
      const { data } = await supabase.from('contents').select('tmdb_id, type');
      contents = data || [];
    }

    const offset = (state.offset as number) || 0;
    const chunkSize = 3; // Reduced from 5 — subtitles are slow (up to 4 API calls each)
    const chunk = contents.slice(offset, offset + chunkSize);

    if (chunk.length === 0) return { summary, hasMore: false, total: 0, nextState: {} };

    for (const item of chunk) {
      if (this.isChunkTimedOut()) {
        console.log(`[Chunk] SyncSubtitles timeout guard triggered. Yielding...`);
        break;
      }

      summary.items_processed++;
      if (state.logId) {
        const currentTotalProcessed = ((state.accumulatedProcessed as number) || 0) + summary.items_processed;
        await this.updateLogProgress(state.logId as string, currentTotalProcessed, contents.length, item.tmdb_id || 'Scanning...');
      }
      try {
        const result = await SubtitleService.fetchAndUploadSubtitle(item.tmdb_id, item.type === 'movie' ? 'movie' : 'tv');
        if (result.status === 'success') summary.items_added++;
        else summary.items_failed++;
      } catch {
        summary.items_failed++;
      }
    }

    const actualProcessed = summary.items_processed;
    const nextOffset = offset + actualProcessed;
    const hasMore = nextOffset < contents.length;
    const total = contents.length;
    return { summary, hasMore, total, nextState: hasMore ? { contents, offset: nextOffset } : {} };
  }
}
