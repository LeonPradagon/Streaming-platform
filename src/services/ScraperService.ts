import { createClient } from '@supabase/supabase-js';
import { TMDBMetadata, classifyPlatform, classifyContentType } from '@/lib/tmdb-utils';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables for standalone script execution
config({ path: path.resolve(process.cwd(), '.env.local') });
config(); // also check .env if exists

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const tmdbApiKey = process.env.TMDB_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface ScrapeTaskSummary {
  items_processed: number;
  items_added: number;
  items_failed: number;
  errors: string[];
}

export class ScraperService {
  private static instance: ScraperService;
  
  public static getInstance(): ScraperService {
    if (!ScraperService.instance) {
      ScraperService.instance = new ScraperService();
    }
    return ScraperService.instance;
  }

  /**
   * Log an event to the database
   */
  private async createLog(taskName: string) {
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

  private async updateLog(logId: string, status: 'success' | 'failed', summary: any, errorMessage?: string) {
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

  private async updateScraperProgress(progress: any) {
    await supabase
      .from('settings')
      .upsert({ key: 'scraper_progress', value: progress }, { onConflict: 'key' });
  }

  /**
   * Deep Scrape TV Series Details (Seasons & Episodes)
   */
  private async scrapeTVDetails(contentId: string, tmdbId: number) {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbApiKey}`);
      const data = await res.json();

      if (!data.seasons) return;

      for (const seasonItem of data.seasons) {
        // Skip season 0 (Specials) usually
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
        const sRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonItem.season_number}?api_key=${tmdbApiKey}`);
        const sData = await sRes.json();

        if (sData.episodes) {
          for (const ep of sData.episodes) {
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
      }
    } catch (err) {
      console.error(`Error scraping TV details for ${tmdbId}:`, err);
    }
  }

  /**
   * Full Discovery & Scrape Task with Page Tracking
   */
  public async runDiscovery(pagesPerGenre: number = 3): Promise<ScrapeTaskSummary> {
    const logId = await this.createLog('Deep Discovery Scrape');
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    const config = await this.getScraperConfig();
    const progress = await this.getScraperProgress();

    try {
      // Fetch all genres from TMDB
      const movieGenreRes = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${tmdbApiKey}`);
      const tvGenreRes = await fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${tmdbApiKey}`);
      
      const { genres: movieGenres } = await movieGenreRes.json();
      const { genres: tvGenres } = await tvGenreRes.json();

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
          const res = await fetch(url);
          const data = await res.json();

          if (!data.results || data.results.length === 0) break;

          for (const item of data.results) {
            summary.items_processed++;
            try {
              const resMetadata = await fetch(`https://api.themoviedb.org/3/${genre.type}/${item.id}?api_key=${tmdbApiKey}&append_to_response=credits`);
              const metadata: any = await resMetadata.json();
              
              // Use Advanced Classification
              const finalType = classifyContentType(metadata, genre.type as any);
              const platform = classifyPlatform(metadata, finalType);
              const genreNames = metadata.genres?.map((g: any) => g.name) || [];
              
              const { data: dbItem, error: upsertError } = await supabase
                .from('contents')
                .upsert({
                  tmdb_id: item.id,
                  title: item.title || item.name,
                  type: finalType,
                  status: config.auto_approve ? 'approved' : 'pending',
                  platform,
                  cast_data: metadata.credits?.cast?.slice(0, 10) || [],
                  genre_names: genreNames,
                  overview: metadata.overview,
                  poster_path: metadata.poster_path,
                  backdrop_path: metadata.backdrop_path,
                  vote_average: metadata.vote_average,
                  release_date: metadata.release_date || metadata.first_air_date,
                  is_healthy: true // Assume new items are healthy
                }, { onConflict: 'tmdb_id' })
                .select().single();

              if (upsertError) throw upsertError;
              
              // Add links
              await this.addProviderLinks(dbItem.id, genre.type, item.id, config);
              
              // If not movie, scrape series details
              if (genre.type === 'tv') {
                await this.scrapeTVDetails(dbItem.id, item.id);
              }
              
              summary.items_added++;
            } catch (err: any) {
              summary.items_failed++;
              summary.errors.push(`${item.title || item.id}: ${err.message}`);
            }
          }
          // Update progress per page to be safe
          progress[key] = page + 1;
          await this.updateScraperProgress(progress);
        }
      }
      
      if (logId) await this.updateLog(logId, 'success', summary);
    } catch (err: any) {
      if (logId) await this.updateLog(logId, 'failed', summary, err.message);
    }

    return summary;
  }

  /**
   * Scrape Trending Content
   */
  public async runTrendingDiscovery(): Promise<ScrapeTaskSummary> {
    const logId = await this.createLog('Trending Discovery');
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };
    const config = await this.getScraperConfig();

    try {
      const url = `https://api.themoviedb.org/3/trending/all/week?api_key=${tmdbApiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.results) {
        for (const item of data.results) {
          if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;
          
          summary.items_processed++;
          try {
            const resMetadata = await fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}?api_key=${tmdbApiKey}&append_to_response=credits`);
            const metadata: TMDBMetadata = await resMetadata.json();
            
            // Use Advanced Classification
            const finalType = classifyContentType(metadata, item.media_type as any);
            const platform = classifyPlatform(metadata, finalType);
            const genreNames = metadata.genres?.map(g => g.name) || [];

            const { data: dbItem, error: upsertError } = await supabase
              .from('contents')
              .upsert({
                tmdb_id: item.id,
                title: item.title || item.name,
                type: finalType,
                status: config.auto_approve ? 'approved' : 'pending',
                platform,
                cast_data: metadata.credits?.cast?.slice(0, 10) || [],
                genre_names: genreNames,
                overview: metadata.overview,
                poster_path: metadata.poster_path,
                backdrop_path: metadata.backdrop_path,
                vote_average: metadata.vote_average,
                release_date: metadata.release_date || metadata.first_air_date,
                is_healthy: true
              }, { onConflict: 'tmdb_id' })
              .select().single();

            if (upsertError) throw upsertError;

            // Report progress
            await this.updateLogProgress(logId!, summary.items_processed, data.results.length, item.title || item.name);
            
            // Add links
            await this.addProviderLinks(dbItem.id, finalType, item.id, config);
            
            if (item.media_type === 'tv') {
              await this.scrapeTVDetails(dbItem.id, item.id);
            }
            
            summary.items_added++;
          } catch (err) {
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
   * Health Check Task: Validates if links are active (200 OK)
   */
  public async validateLinks(): Promise<ScrapeTaskSummary> {
    const logId = await this.createLog('Health Check Validation');
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };

    try {
      const { data: links } = await supabase.from('embed_links').select('*, contents(id, title)');
      
      if (links) {
        for (const link of links) {
          summary.items_processed++;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const res = await fetch(link.url, { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeout);

            const isHealthy = res.ok || res.status === 403; // Some providers block HEAD but are 200 on GET
            
            await supabase.from('contents').update({ 
              is_healthy: isHealthy,
              last_checked_at: new Date().toISOString()
            }).eq('id', link.content_id);

          } catch (err: any) {
            summary.items_failed++;
            // Don't mark as unhealthy immediately on timeout, but log it
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
    const logId = await this.createLog('Full Metadata Sync');
    const summary: ScrapeTaskSummary = { items_processed: 0, items_added: 0, items_failed: 0, errors: [] };

    try {
      const { data: contents } = await supabase.from('contents').select('*');
      
      if (contents) {
        for (const item of contents) {
          summary.items_processed++;
          try {
            const tmdbType = (item.type === 'movie') ? 'movie' : 'tv';
            const resMetadata = await fetch(`https://api.themoviedb.org/3/${tmdbType}/${item.tmdb_id}?api_key=${tmdbApiKey}&append_to_response=credits`);
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
              release_date: metadata.release_date || metadata.first_air_date
            }).eq('id', item.id);

            // Report sync progress
            await this.updateLogProgress(logId!, summary.items_processed, contents.length, item.title);

            // Small delay to prevent TMDB rate limit (429) during bulk sync
            await new Promise(resolve => setTimeout(resolve, 200));
            
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

  private async addProviderLinks(contentId: string, type: string, tmdbId: number, config: any) {
    const isTV = type === 'tv';
    const providers = [];

    if (config.videospider_enabled) {
      providers.push({ name: 'Speed 1', url: `https://vidlink.pro/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` });
    }
    
    if (config.superembed_enabled) {
      providers.push({ name: 'Speed 2', url: `https://vidsrc.pm/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` });
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
