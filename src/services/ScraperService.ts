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
      
      if (response.status === 429) {
        if (retryCount >= 3) {
          throw new Error(`Rate limit exceeded after ${retryCount} retries`);
        }
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 8000;
        console.warn(`[Scraper] Rate limited by ${url}. Pausing for ${waitTime/1000}s (Retry ${retryCount + 1})...`);
        await this.delay(waitTime);
        return this.fetchWithTimeout(url, options, timeout, retryCount + 1); 
      }
      
      return response;
    } catch (error) {
      clearTimeout(id);
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
   * Cleanup tasks that have been 'running' for more than 10 minutes
   */
  private async cleanupStaleTasks() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // 1. Get stale tasks from DB
    const { data: staleTasks } = await supabase
      .from('scraper_logs')
      .select('task_name')
      .eq('status', 'running')
      .lt('created_at', tenMinutesAgo);

    if (staleTasks && staleTasks.length > 0) {
      console.log(`[Scraper] Cleaning up ${staleTasks.length} stale tasks...`);

      await supabase
        .from('scraper_logs')
        .update({ 
          status: 'failed', 
          error_message: 'Task timed out (stale task auto-cleanup 10m)' 
        })
        .eq('status', 'running')
        .lt('created_at', tenMinutesAgo);
    }
  }

  /**
   * Log an event to the database
   */
  public async createLog(taskName: string) {
    // 1. Always cleanup stale tasks first to avoid getting stuck
    await this.cleanupStaleTasks();

    // 2. Check DB for any 'running' task with same name that isn't stale (within 60m)
    const { data: existingRunning } = await supabase
      .from('scraper_logs')
      .select('id')
      .eq('task_name', taskName)
      .eq('status', 'running')
      .single();

    if (existingRunning) {
      console.warn(`[Scraper] Task ${taskName} is already marked as running in DB. Skipping.`);
      return null;
    }

    const { data, error } = await supabase
      .from('scraper_logs')
      .insert({
        task_name: taskName,
        status: 'running'
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
          progress: { current: summary.items_processed || 0, total: summary.items_processed || 0, current_item: 'Selesai' }
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
          progress: { current, total, current_item: currentItem }
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

      for (const seasonItem of data.seasons) {
        if (seasonItem.season_number === 0) continue;

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

        if (sError || !dbSeason) continue;

        // Smart Skip: If episode count matches, we might not need to fetch every episode again
        // But for fresh metadata, we fetch once. 
        const sRes = await this.fetchWithTimeout(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonItem.season_number}?api_key=${tmdbApiKey}`);
        if (!sRes.ok) continue;
        const sData = await sRes.json();

        if (sData.episodes && sData.episodes.length > 0) {
          // Prepare episodes for bulk upsert
          const episodesToUpsert = sData.episodes.map((ep: any) => ({
            season_id: dbSeason.id,
            episode_number: ep.episode_number,
            title: ep.name,
            overview: ep.overview,
            still_path: ep.still_path,
            air_date: ep.air_date
          }));

          // Bulk upsert episodes (much faster than one-by-one)
          await supabase
            .from('episodes')
            .upsert(episodesToUpsert, { onConflict: 'season_id,episode_number' });

          console.log(`[Scraper] Bulk upserted ${episodesToUpsert.length} episodes for ${showTitle} S${seasonItem.season_number}`);
        }
        
        // Removed individual subtitle fetching here as it causes serverless timeouts. 
        // Subtitles should be synced using the dedicated 'sync subtitles' task.
        
        await this.delay(200); // Shorter delay
      }
    } catch (err: any) {
      console.error(`Error scraping TV details for ${tmdbId}:`, err.message);
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

          const { data: existing } = await supabase
            .from('contents')
            .select('id, status')
            .eq('tmdb_id', item.id)
            .single();

          if (existing && genre.type === 'movie') return;

          try {
            const resMetadata = await this.fetchWithTimeout(`https://api.themoviedb.org/3/${genre.type}/${item.id}?api_key=${tmdbApiKey}&append_to_response=credits`);
            if (!resMetadata.ok) throw new Error(`TMDB Metadata fetch failed with status ${resMetadata.status}`);
            const metadata: any = await resMetadata.json();
            
            const finalType = classifyContentType(metadata, genre.type as any);
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
                is_healthy: true
              }, { onConflict: 'tmdb_id' })
              .select().single();

            if (upsertError) throw upsertError;
            
            await this.addProviderLinks(dbItem.id, genre.type, item.id, scraperConfig);
            
            if (genre.type === 'tv') {
              const totalEstimated = allTasks.length * pagesPerGenre * 20;
              await this.scrapeTVDetails(dbItem.id, item.id, logId, summary.items_processed, totalEstimated, item.title || item.name);
            }
            
            await SubtitleService.fetchAndUploadSubtitle(item.id, genre.type as 'movie' | 'tv');
            
            summary.items_added++;

          } catch (err: any) {
            summary.items_failed++;
            summary.errors.push(`${item.title || item.id}: ${err.message}`);
          }
        }, 3, () => this.checkTaskActive(logId));

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
          const { data: existing } = await supabase
            .from('contents')
            .select('id, status')
            .eq('tmdb_id', item.id)
            .single();

          const resMetadata = await this.fetchWithTimeout(`https://api.themoviedb.org/3/${item.media_type}/${item.id}?api_key=${tmdbApiKey}&append_to_response=credits`);
          if (!resMetadata.ok) throw new Error(`TMDB Metadata fetch failed with status ${resMetadata.status}`);
          const metadata: TMDBMetadata = await resMetadata.json();
          
          const finalType = classifyContentType(metadata, item.media_type as any);
          const platform = classifyPlatform(metadata, finalType);
          const genreNames = metadata.genres?.map(g => g.name) || [];

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
              is_healthy: true
            }, { onConflict: 'tmdb_id' })
            .select().single();

          if (upsertError) throw upsertError;
          
          await this.addProviderLinks(dbItem.id, finalType, item.id, scraperConfig);
          
          if (item.media_type === 'tv') {
            await this.scrapeTVDetails(dbItem.id, item.id, logId, summary.items_processed, data.results.length, item.title || item.name);
          }
          
          await SubtitleService.fetchAndUploadSubtitle(item.id, finalType === 'movie' ? 'movie' : 'tv');
          
          summary.items_added++;
        } catch (err: any) {
          summary.items_failed++;
        }
      }, 3, () => this.checkTaskActive(logId));
    }
  }

  /**
   * Full Daily Routine: Trending + Genre Discovery
   */
  public async runFullRoutine(pages: number = 5): Promise<ScrapeTaskSummary[]> {
    console.log(`🚀 Starting Full Scraper Routine (Intensity: ${pages} pages)...`);
    const trending = await this.runTrendingDiscovery();
    const discovery = await this.runDiscovery(pages);
    return [trending, discovery];
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

    for (const p of providers) {
      await supabase.from('embed_links').upsert({
        content_id: contentId,
        provider: p.name,
        url: p.url,
        quality: 'HD'
      }, { onConflict: 'content_id,provider' });
    }
  }

  // ==========================================
  // CHUNKED EXECUTION FOR SERVERLESS (NETLIFY)
  // ==========================================

  public async runDiscoveryChunk(pagesPerGenre: number = 3, state: any = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: any }> {
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    const scraperConfig = await this.getScraperConfig();
    
    // Fetch genres if not in state
    let allTasks = state.genres;
    if (!allTasks) {
      const movieGenreRes = await this.fetchWithTimeout(`https://api.themoviedb.org/3/genre/movie/list?api_key=${tmdbApiKey}`);
      const tvGenreRes = await this.fetchWithTimeout(`https://api.themoviedb.org/3/genre/tv/list?api_key=${tmdbApiKey}`);
      const { genres: movieGenres } = await movieGenreRes.json();
      const { genres: tvGenres } = await tvGenreRes.json();
      
      if (!movieGenres || !tvGenres) throw new Error("Failed to fetch genres from TMDB");
      
      allTasks = [
        ...movieGenres.map((g: any) => ({ ...g, type: 'movie' })),
        ...tvGenres.map((g: any) => ({ ...g, type: 'tv' }))
      ];
    }

    const currentGenreIndex = state.currentGenreIndex || 0;
    const currentPage = state.currentPage || 1;
    const currentItemIndex = state.currentItemIndex || 0;

    if (currentGenreIndex >= allTasks.length) {
      return { summary, hasMore: false, total: 0, nextState: {} };
    }

    const genre = allTasks[currentGenreIndex];
    console.log(`[Chunk] Scraping Genre: ${genre.name} (${genre.type}) | Page ${currentPage}`);

    const url = `https://api.themoviedb.org/3/discover/${genre.type}?api_key=${tmdbApiKey}&with_genres=${genre.id}&sort_by=popularity.desc&page=${currentPage}`;
    const res = await this.fetchWithTimeout(url);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const resultsToProcess = data.results.slice(currentItemIndex, currentItemIndex + 2); // Process 2 items at a time
      
      await this.pMap(resultsToProcess, async (item: any) => {
        summary.items_processed++;
        const { data: existing } = await supabase.from('contents').select('id').eq('tmdb_id', item.id).single();
        if (existing && genre.type === 'movie') return;

        try {
          const resMetadata = await this.fetchWithTimeout(`https://api.themoviedb.org/3/${genre.type}/${item.id}?api_key=${tmdbApiKey}&append_to_response=credits`);
          if (!resMetadata.ok) throw new Error(`Fetch failed`);
          const metadata: any = await resMetadata.json();
          
          const finalType = classifyContentType(metadata, genre.type as any);
          const platform = classifyPlatform(metadata, finalType);
          const genreNames = metadata.genres?.map((g: { name: string }) => g.name) || [];
          
          const { data: dbItem } = await supabase.from('contents').upsert({
            tmdb_id: item.id,
            title: item.title || item.name,
            type: finalType,
            status: scraperConfig.auto_approve ? 'approved' : 'pending',
            platform,
            cast_data: metadata.credits?.cast?.slice(0, 10) || [],
            genre_names: genreNames,
            overview: metadata.overview,
            poster_path: metadata.poster_path,
            backdrop_path: metadata.backdrop_path,
            vote_average: metadata.vote_average,
            popularity: item.popularity || metadata.popularity || 0,
            release_date: metadata.release_date || metadata.first_air_date,
            is_healthy: true
          }, { onConflict: 'tmdb_id' }).select().single();

          if (dbItem) {
            await this.addProviderLinks(dbItem.id, genre.type, item.id, scraperConfig);
            if (genre.type === 'tv') {
              await this.scrapeTVDetails(dbItem.id, item.id);
            }
            await SubtitleService.fetchAndUploadSubtitle(item.id, genre.type as 'movie' | 'tv');
            summary.items_added++;
          }
        } catch (err: any) {
          summary.items_failed++;
        }
      }, 1); // Sequential processing within chunk for safety
    }

    // Determine next state
    let nextGenreIndex = currentGenreIndex;
    let nextPage = currentPage;
    let nextItemIndex = currentItemIndex + 2;

    if (nextItemIndex >= (data.results?.length || 0)) {
      nextItemIndex = 0;
      nextPage = currentPage + 1;
      if (nextPage > pagesPerGenre || !data.results || data.results.length === 0) {
        nextGenreIndex++;
        nextPage = 1;
      }
    }

    const hasMore = nextGenreIndex < allTasks.length;
    
    const total = allTasks.length * pagesPerGenre * 20;

    return {
      summary,
      hasMore,
      total,
      nextState: hasMore ? { genres: allTasks, currentGenreIndex: nextGenreIndex, currentPage: nextPage, currentItemIndex: nextItemIndex } : {}
    };
  }

  public async runTrendingChunk(state: any = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: any }> {
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    const scraperConfig = await this.getScraperConfig();
    
    let items = state.items;
    if (!items) {
      const res = await this.fetchWithTimeout(`https://api.themoviedb.org/3/trending/all/week?api_key=${tmdbApiKey}`);
      const data = await res.json();
      items = data.results?.filter((i: any) => i.media_type === 'movie' || i.media_type === 'tv') || [];
    }

    const offset = state.offset || 0;
    const chunkSize = 5; // Process 5 items per chunk
    const chunk = items.slice(offset, offset + chunkSize);

    if (chunk.length === 0) {
      return { summary, hasMore: false, total: 0, nextState: {} };
    }

    await this.pMap(chunk, async (item: any) => {
      summary.items_processed++;
      try {
        const { data: existing } = await supabase.from('contents').select('id').eq('tmdb_id', item.id).single();
        const resMetadata = await this.fetchWithTimeout(`https://api.themoviedb.org/3/${item.media_type}/${item.id}?api_key=${tmdbApiKey}&append_to_response=credits`);
        const metadata: any = await resMetadata.json();
        
        const finalType = classifyContentType(metadata, item.media_type as any);
        const platform = classifyPlatform(metadata, finalType);
        
        const { data: dbItem } = await supabase.from('contents').upsert({
          tmdb_id: item.id,
          title: item.title || item.name,
          type: finalType,
          status: scraperConfig.auto_approve ? 'approved' : 'pending',
          platform,
          cast_data: metadata.credits?.cast?.slice(0, 10) || [],
          genre_names: metadata.genres?.map((g: any) => g.name) || [],
          overview: metadata.overview,
          poster_path: metadata.poster_path,
          backdrop_path: metadata.backdrop_path,
          vote_average: metadata.vote_average,
          popularity: item.popularity || metadata.popularity || 0,
          release_date: metadata.release_date || metadata.first_air_date,
          tv_status: metadata.status,
          is_healthy: true
        }, { onConflict: 'tmdb_id' }).select().single();

        if (dbItem) {
          await this.addProviderLinks(dbItem.id, finalType, item.id, scraperConfig);
          if (item.media_type === 'tv') await this.scrapeTVDetails(dbItem.id, item.id);
          await SubtitleService.fetchAndUploadSubtitle(item.id, finalType as 'movie' | 'tv');
          summary.items_added++;
        }
      } catch (err) {
        summary.items_failed++;
      }
    }, 3);

    const nextOffset = offset + chunkSize;
    const hasMore = nextOffset < items.length;

    const total = items.length;

    return {
      summary,
      hasMore,
      total,
      nextState: hasMore ? { items, offset: nextOffset } : {}
    };
  }

  public async runHealthCheckChunk(state: any = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: any }> {
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    let links = state.links;
    if (!links) {
      const { data } = await supabase.from('embed_links').select('id, url, content_id');
      links = data || [];
    }

    const offset = state.offset || 0;
    const chunkSize = 15; // 15 links per chunk
    const chunk = links.slice(offset, offset + chunkSize);

    if (chunk.length === 0) return { summary, hasMore: false, total: 0, nextState: {} };

    await this.pMap(chunk, async (link: any) => {
      summary.items_processed++;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); 
        const res = await fetch(link.url, { method: 'GET', signal: controller.signal, headers: { 'Range': 'bytes=0-0' } });
        clearTimeout(timeout);
        const isHealthy = res.ok || res.status === 403 || res.status === 206; 
        await supabase.from('contents').update({ is_healthy: isHealthy, last_checked_at: new Date().toISOString() }).eq('id', link.content_id);
      } catch (err) {
        summary.items_failed++;
      }
    }, 5);

    const nextOffset = offset + chunkSize;
    const hasMore = nextOffset < links.length;

    const total = links.length;
    return { summary, hasMore, total, nextState: hasMore ? { links, offset: nextOffset } : {} };
  }

  public async runSyncMetadataChunk(state: any = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: any }> {
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    let contents = state.contents;
    if (!contents) {
      const { data } = await supabase.from('contents').select('id, tmdb_id, type');
      contents = data || [];
    }

    const offset = state.offset || 0;
    const chunkSize = 3; // Reduced for Vercel
    const chunk = contents.slice(offset, offset + chunkSize);

    if (chunk.length === 0) return { summary, hasMore: false, total: 0, nextState: {} };

    await this.pMap(chunk, async (item: any) => {
      summary.items_processed++;
      try {
        const tmdbType = item.type === 'movie' ? 'movie' : 'tv';
        const resMetadata = await this.fetchWithTimeout(`https://api.themoviedb.org/3/${tmdbType}/${item.tmdb_id}?api_key=${tmdbApiKey}&append_to_response=credits`);
        const metadata: any = await resMetadata.json();
        
        const finalType = classifyContentType(metadata, tmdbType);
        const platform = classifyPlatform(metadata, finalType);

        await supabase.from('contents').update({
          type: finalType,
          platform,
          genre_names: metadata.genres?.map((g: any) => g.name) || [],
          cast_data: metadata.credits?.cast?.slice(0, 10) || [],
          overview: metadata.overview,
          poster_path: metadata.poster_path,
          backdrop_path: metadata.backdrop_path,
          vote_average: metadata.vote_average,
          release_date: metadata.release_date || metadata.first_air_date,
          tv_status: metadata.status
        }).eq('id', item.id);

        if (tmdbType === 'tv') await this.scrapeTVDetails(item.id, item.tmdb_id);
        summary.items_added++;
      } catch (err) {
        summary.items_failed++;
      }
    }, 1);

    const nextOffset = offset + chunkSize;
    const hasMore = nextOffset < contents.length;
    const total = contents.length;
    return { summary, hasMore, total, nextState: hasMore ? { contents, offset: nextOffset } : {} };
  }

  public async runSyncSubtitlesChunk(state: any = {}): Promise<{ summary: ScrapeTaskSummary, hasMore: boolean, total: number, nextState: any }> {
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    
    let contents = state.contents;
    if (!contents) {
      const { data } = await supabase.from('contents').select('tmdb_id, type');
      contents = data || [];
    }

    const offset = state.offset || 0;
    const chunkSize = 5;
    const chunk = contents.slice(offset, offset + chunkSize);

    if (chunk.length === 0) return { summary, hasMore: false, total: 0, nextState: {} };

    await this.pMap(chunk, async (item: any) => {
      summary.items_processed++;
      try {
        const result = await SubtitleService.fetchAndUploadSubtitle(item.tmdb_id, item.type === 'movie' ? 'movie' : 'tv');
        if (result.status === 'success') summary.items_added++;
        else summary.items_failed++;
      } catch (err) {
        summary.items_failed++;
      }
    }, 1);

    const nextOffset = offset + chunkSize;
    const hasMore = nextOffset < contents.length;
    const total = contents.length;
    return { summary, hasMore, total, nextState: hasMore ? { contents, offset: nextOffset } : {} };
  }
}
