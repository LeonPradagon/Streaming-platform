import { createClient } from '@supabase/supabase-js';
import { TMDBMetadata, classifyPlatform, classifyContentType } from '@/lib/tmdb';
import { SubtitleService } from '@/services/SubtitleService';

// Load environment variables ONLY for standalone script execution (Node.js)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production' && !process.env.NEXT_RUNTIME) {
  try {
    const { config } = require('dotenv');
    const path = require('path');
    config({ path: path.resolve(process.cwd(), '.env.local') });
    config(); 
  } catch (e) {
    // Ignore if dotenv/path not available in current runtime
  }
}

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const tmdbApiKey = process.env.TMDB_API_KEY!;

// Use service_role key if available (bypasses RLS for backend operations)
// Falls back to anon key if not set (may fail writes with strict RLS)
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
  private static activeTasks: Set<string> = new Set();
  
  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * Cleanup tasks that have been 'running' for more than 30 minutes
   */
  private async cleanupStaleTasks() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('scraper_logs')
      .update({ 
        status: 'failed', 
        error_message: 'Task timed out (stale task auto-cleanup)' 
      })
      .eq('status', 'running')
      .lt('created_at', thirtyMinutesAgo);

    if (error) console.error('[Scraper] Error cleaning up stale tasks:', error.message);
    
    // Also clear memory set
    ScraperService.activeTasks.clear();
  }

  /**
   * Log an event to the database
   */
  private async createLog(taskName: string) {
    // 1. Always cleanup stale tasks first to avoid getting stuck
    await this.cleanupStaleTasks();

    // 2. Prevent concurrent identical tasks
    if (ScraperService.activeTasks.has(taskName)) {
      console.warn(`[Scraper] Task ${taskName} is already running. Skipping.`);
      return null;
    }
    
    ScraperService.activeTasks.add(taskName);

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

  private async updateLog(logId: string, status: 'success' | 'failed', summary: ScrapeTaskSummary, errorMessage?: string) {
    try {
      const { data: log } = await supabase.from('scraper_logs').select('task_name').eq('id', logId).single();
      if (log?.task_name) {
        ScraperService.activeTasks.delete(log.task_name);
      }

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

  private async updateLogProgress(logId: string, current: number, total: number, currentItem: string) {
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
      videospider_enabled: true,
      superembed_enabled: true
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
  private async scrapeTVDetails(contentId: string, tmdbId: number) {
    try {
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

        // Fetch Episodes for this season
        const sRes = await this.fetchWithTimeout(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonItem.season_number}?api_key=${tmdbApiKey}`);
        if (!sRes.ok) continue;
        const sData = await sRes.json();

        if (sData.episodes) {
          for (const ep of sData.episodes) {
            // Episode Smart Skip: Check if episode already exists
            const { data: existingEp } = await supabase
              .from('episodes')
              .select('id')
              .eq('season_id', dbSeason.id)
              .eq('episode_number', ep.episode_number)
              .single();

            if (existingEp) continue;

            await supabase
              .from('episodes')
              .upsert({
                season_id: dbSeason.id,
                episode_number: ep.episode_number,
                title: ep.name,
                overview: ep.overview,
                still_path: ep.still_path,
                air_date: ep.air_date
              }, { onConflict: 'season_id,episode_number' });
          }
        }
        await this.delay(300); // Delay between seasons
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
    const scraperConfig = await this.getScraperConfig();
    const progress = await this.getScraperProgress();

    try {
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
          const url = `https://api.themoviedb.org/3/discover/${genre.type}?api_key=${tmdbApiKey}&with_genres=${genre.id}&sort_by=popularity.desc&page=${page}`;
          const res = await this.fetchWithTimeout(url);
          const data = await res.json();
          
          await this.delay(400); // Increased rate limiting delay

          if (!data.results || data.results.length === 0) break;

          let batchCount = 0;
          for (const item of data.results) {
            summary.items_processed++;
            batchCount++;

            // Smart Skip: Check if already exists
            const { data: existing } = await supabase
              .from('contents')
              .select('id, status')
              .eq('tmdb_id', item.id)
              .single();

            // Only skip entirely if it's a MOVIE. 
            // For TV Series, we still want to check for new episodes.
            if (existing && taskName === 'Deep Discovery Scrape' && genre.type === 'movie') {
              continue;
            }

            try {
              const resMetadata = await this.fetchWithTimeout(`https://api.themoviedb.org/3/${genre.type}/${item.id}?api_key=${tmdbApiKey}&append_to_response=credits`);
              if (!resMetadata.ok) throw new Error(`TMDB Metadata fetch failed with status ${resMetadata.status}`);
              const metadata: any = await resMetadata.json();
              
              await this.delay(300);
              
              const finalType = classifyContentType(metadata, genre.type as any);
              const platform = classifyPlatform(metadata, finalType);
              const genreNames = metadata.genres?.map((g: { name: string }) => g.name) || [];
              
              const { data: dbItem, error: upsertError } = await supabase
                .from('contents')
                .upsert({
                  tmdb_id: item.id,
                  title: item.title || item.name,
                  type: finalType,
                  // Only set status to pending/config-value if it's a NEW item
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
                  is_healthy: true
                }, { onConflict: 'tmdb_id' })
                .select().single();

              if (upsertError) throw upsertError;
              
              await this.addProviderLinks(dbItem.id, genre.type, item.id, scraperConfig);
              
              if (genre.type === 'tv') {
                await this.scrapeTVDetails(dbItem.id, item.id);
              }
              
              await SubtitleService.fetchAndUploadSubtitle(item.id, genre.type as 'movie' | 'tv');
              
              summary.items_added++;

              if (logId) {
                const totalEstimated = allTasks.length * pagesPerGenre * 20;
                await this.updateLogProgress(logId, summary.items_processed, totalEstimated, item.title || item.name);
              }

              // Batch Breathing: extra pause every 30 items
              if (batchCount % 30 === 0) {
                console.log('[Scraper] Batch limit reached. Breathing for 3s...');
                await this.delay(3000);
              }
            } catch (err: any) {
              summary.items_failed++;
              const errorType = err.message.includes('TMDB') ? '[TMDB]' : err.message.includes('supabase') ? '[DB]' : '[SCRAPE]';
              summary.errors.push(`${errorType} ${item.title || item.id}: ${err.message}`);
              console.error(`[Scraper] Failed item ${item.id}:`, err.message);
            }
          }
          progress[key] = page + 1;
          await this.updateScraperProgress(progress);
        }
      }
      
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      console.error("Discovery error:", err);
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }

    return summary;
  }

  /**
   * Scrape Trending Content
   */
  public async runTrendingDiscovery(): Promise<ScrapeTaskSummary> {
    const taskName = 'Trending Discovery';
    const logId = await this.createLog(taskName);
    if (!logId) return { items_processed: 0, items_added: 0, items_failed: 0, errors: ['Task already running'] };

    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    const scraperConfig = await this.getScraperConfig();

    try {
      const url = `https://api.themoviedb.org/3/trending/all/week?api_key=${tmdbApiKey}`;
      const res = await this.fetchWithTimeout(url);
      const data = await res.json();

      if (data.results) {
        for (const item of data.results) {
          if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;
          
          summary.items_processed++;
          try {
            // Check if already exists to protect status
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
                // Only set status if NEW item
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
                is_healthy: true
              }, { onConflict: 'tmdb_id' })
              .select().single();

            if (upsertError) throw upsertError;

            if (logId) {
              await this.updateLogProgress(logId, summary.items_processed, data.results.length, item.title || item.name);
            }
            
            await this.addProviderLinks(dbItem.id, finalType, item.id, scraperConfig);
            
            if (item.media_type === 'tv') {
              await this.scrapeTVDetails(dbItem.id, item.id);
            }
            
            await SubtitleService.fetchAndUploadSubtitle(item.id, finalType === 'movie' ? 'movie' : 'tv');
            
            summary.items_added++;
            await this.delay(300);
          } catch (err: any) {
            summary.items_failed++;
            console.error(`[Scraper] Trending failed for ${item.id}:`, err.message);
          }
        }
      }
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }
    return summary;
  }

  /**
   * Full Daily Routine: Trending + Genre Discovery
   */
  public async runFullRoutine(): Promise<ScrapeTaskSummary[]> {
    console.log('🚀 Starting Full Scraper Routine...');
    const trending = await this.runTrendingDiscovery();
    const discovery = await this.runDiscovery(5);
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
        for (const link of links) {
          summary.items_processed++;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000); 

            const res = await fetch(link.url, { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeout);

            const isHealthy = res.ok || res.status === 403; 
            
            await supabase.from('contents').update({ 
              is_healthy: isHealthy,
              last_checked_at: new Date().toISOString()
            }).eq('id', link.content_id);

            if (logId) {
              const title = Array.isArray(link.contents) ? link.contents[0]?.title : link.contents?.title;
              await this.updateLogProgress(logId, summary.items_processed, links.length, title || link.url);
            }
          } catch (err: any) {
            summary.items_failed++;
          }
        }
      }
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
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
      const { data: contents } = await supabase.from('contents').select('*');
      
      if (contents) {
        for (const item of contents) {
          summary.items_processed++;
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
              release_date: metadata.release_date || metadata.first_air_date
            }).eq('id', item.id);

            if (logId) {
              await this.updateLogProgress(logId, summary.items_processed, contents.length, item.title);
            }

            await this.delay(300);
            
            if (tmdbType !== 'movie') {
              await this.scrapeTVDetails(item.id, item.tmdb_id);
            }
            
            summary.items_added++;
          } catch (err: any) {
            summary.items_failed++;
          }
        }
      }
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }

    return summary;
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
        for (const item of contents) {
          summary.items_processed++;
          try {
            const result = await SubtitleService.fetchAndUploadSubtitle(item.tmdb_id, item.type === 'movie' ? 'movie' : 'tv');
            
            if (result.status === 'success') {
              summary.items_added++;
            } else if (result.status === 'error') {
              summary.items_failed++;
            }

            if (logId) {
              await this.updateLogProgress(logId, summary.items_processed, contents.length, item.title);
            }

            await this.delay(400);
          } catch (err: any) {
            summary.items_failed++;
          }
        }
      }
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }

    return summary;
  }

  private async addProviderLinks(contentId: string, type: string, tmdbId: number, scraperConfig: { videospider_enabled?: boolean, superembed_enabled?: boolean }) {
    const isTV = type === 'tv';
    const providers = [];

    if (scraperConfig.videospider_enabled) {
      providers.push({ name: 'Server 1', url: `https://vidlink.pro/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` });
    }
    
    if (scraperConfig.superembed_enabled) {
      providers.push({ name: 'Server 2', url: `https://vidsrc.pm/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` });
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
}
