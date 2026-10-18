import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';
import { subtitleRequest, toWebVtt } from '@/lib/subtitle-format';

// Configuration

const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY;
const SUBDL_API_KEY = process.env.SUBDL_API_KEY;
const OS_BASE_URL = 'https://api.opensubtitles.com/api/v1';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface SubtitleFetchResult {
  status: 'success' | 'error' | 'skipped';
  reason?: string;
  url?: string;
  language?: string;
}

export class SubtitleService {
  private static pending = new Map<string, Promise<SubtitleFetchResult>>();
  private static recent = new Map<string, { expires: number; result: SubtitleFetchResult }>();
  /**
   * Convert SRT content to VTT format
   */
  private static srtToVtt(srt: string): string {
    return toWebVtt(srt);
  }

  private static async fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 8000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  private static async fetchFromOpenSubtitles(tmdbId: number | string, type: 'movie' | 'tv', season?: string, episode?: string, langCode: string = 'id', signal?: AbortSignal): Promise<string> {
    if (!OPENSUBTITLES_API_KEY) throw new Error('OpenSubtitles API key missing');
    
    const searchParams = new URLSearchParams({
      [type === 'tv' ? 'parent_tmdb_id' : 'tmdb_id']: String(tmdbId),
      languages: langCode,
      order_by: 'download_count',
      order_direction: 'desc',
    });

    if (type === 'tv' && season && episode) {
      searchParams.set('season_number', season);
      searchParams.set('episode_number', episode);
    }

    const searchRes = await this.fetchWithTimeout(`${OS_BASE_URL}/subtitles?${searchParams.toString()}`, {
      signal,
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'StreamingApp v1.0',
      },
    });

    if (!searchRes.ok) throw new Error(`OS Search Failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    
    if (!searchData.data || searchData.data.length === 0) {
      throw new Error(`No ${langCode} subtitles found on OS`);
    }

    const match = searchData.data.find((item: { attributes?: { language?: string } }) => item.attributes?.language === langCode);
    const fileId = match?.attributes?.files?.[0]?.file_id;
    if (!fileId) throw new Error('No subtitle file ID found');

    const downloadRes = await this.fetchWithTimeout(`${OS_BASE_URL}/download`, {
      signal,
      method: 'POST',
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'StreamingApp v1.0',
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    if (!downloadRes.ok) throw new Error('OS Download API Failed');
    const downloadData = await downloadRes.json();
    const downloadUrl = downloadData.link;

    if (!downloadUrl) throw new Error('No dl link received');
    const source = new URL(downloadUrl);
    if (source.protocol !== 'https:' || source.username || source.password || !['opensubtitles.com', 'opensubtitles.org'].some(host => source.hostname === host || source.hostname.endsWith(`.${host}`))) throw new Error('Unexpected OpenSubtitles download host');

    const fileRes = await this.fetchWithTimeout(downloadUrl, { redirect: 'error', signal });
    if (!fileRes.ok) throw new Error('Failed to fetch from OS dl URL');

    const text = await fileRes.text();
    this.srtToVtt(text); // Validate before deciding that this provider succeeded.
    return text;
  }

  private static async fetchFromSubdl(tmdbId: number | string, type: 'movie' | 'tv', season?: string, episode?: string, langCode: string = 'ID', signal?: AbortSignal): Promise<string> {
    if (!SUBDL_API_KEY) throw new Error('Subdl API Key missing');
    
    let subdlUrl = `https://api.subdl.com/api/v1/subtitles?api_key=${SUBDL_API_KEY}&tmdb_id=${tmdbId}&languages=${langCode.toUpperCase()}&type=${type}`;
    if (type === 'tv' && season && episode) {
      subdlUrl += `&season_number=${season}&episode_number=${episode}`;
    }

    const subdlRes = await this.fetchWithTimeout(subdlUrl, { signal });
    if (!subdlRes.ok) throw new Error(`Subdl Search Failed: ${subdlRes.status}`);

    const subdlData = await subdlRes.json();
    if (!subdlData.status || !subdlData.subtitles || subdlData.subtitles.length === 0) {
      throw new Error(`No ${langCode} subtitles found on Subdl`);
    }

    const selected = subdlData.subtitles.find((item: { language?: string; full_season?: boolean; episode?: number; episode_from?: number; episode_end?: number }) => item.language?.toUpperCase() === langCode.toUpperCase() && (type === 'movie' || !item.full_season && [item.episode, item.episode_from, item.episode_end].every(value => !value || Number(value) === Number(episode))));
    const path = selected?.url;
    if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('No matching episode download path from Subdl');
    const download = new URL(path, 'https://dl.subdl.com');
    if (download.origin !== 'https://dl.subdl.com' || !/^\/(?:sub|subtitle)\/[A-Za-z0-9_.-]+\.zip$/.test(download.pathname)) throw new Error('Invalid Subdl download path');
    const zipRes = await this.fetchWithTimeout(download.toString(), { redirect: 'error', signal });
    if (!zipRes.ok) throw new Error('Failed to download ZIP from Subdl');

    const arrayBuffer = await zipRes.arrayBuffer();
    if (arrayBuffer.byteLength > 8 * 1024 * 1024) throw new Error('Subtitle archive too large');
    const zip = new AdmZip(Buffer.from(arrayBuffer));
    if (zip.getEntryCount() > 200) throw new Error('Too many subtitle archive entries');
    
    for (const entry of zip.getEntries()) {
      if (entry.entryName.toLowerCase().endsWith('.srt')) {
        if (entry.header.size > 2 * 1024 * 1024) continue;
        const text = zip.readAsText(entry);
        try { this.srtToVtt(text); return text; } catch { /* Try the next valid subtitle in the archive. */ }
      }
    }

    throw new Error('No .srt file found inside Subdl ZIP');
  }

  public static async fetchAndUploadSubtitle(tmdbId: number | string, type: 'movie' | 'tv' = 'movie', season?: string, episode?: string): Promise<SubtitleFetchResult> {
    let request: ReturnType<typeof subtitleRequest>;
    try { request = subtitleRequest(tmdbId, type, season, episode); } catch (error) {
      return { status: 'error', reason: error instanceof Error ? error.message : 'Invalid subtitle request' };
    }
    const cached = this.recent.get(request.basePath);
    if (cached && cached.expires > Date.now()) return cached.result.status === 'success' ? { ...cached.result, status: 'skipped', reason: 'recent_result' } : cached.result;
    const active = this.pending.get(request.basePath);
    if (active) return active;
    const promise = this.fetchSubtitle(request).then(result => {
      this.recent.set(request.basePath, { result, expires: Date.now() + (result.status === 'error' ? 5 : 10) * 60 * 1000 });
      if (this.recent.size > 256) this.recent.delete(this.recent.keys().next().value!);
      return result;
    }).finally(() => this.pending.delete(request.basePath));
    this.pending.set(request.basePath, promise);
    return promise;
  }

  private static async fetchSubtitle({ id: tmdbId, type, season, episode, folder: folderPath, prefix: searchPrefix, basePath }: ReturnType<typeof subtitleRequest>): Promise<SubtitleFetchResult> {
    let fallback: SubtitleFetchResult | undefined;
    const signal = AbortSignal.timeout(25000);

    // Only an explicitly Indonesian cache satisfies the preferred-language request.
    try {
      const { data: listData } = await supabase.storage.from('subtitles').list(folderPath, { search: searchPrefix });
      
      if (listData && listData.length > 0) {
        // Prioritize Indonesian, then English
        const idFile = listData.find(f => f.name === `${searchPrefix}_id.vtt`);
        const enFile = listData.find(f => f.name === `${searchPrefix}_en.vtt`);
        const defaultFile = listData.find(f => f.name === `${searchPrefix}.vtt`);
        
        const file = idFile || enFile || defaultFile;
        
        if (file) {
          const { data } = supabase.storage.from('subtitles').getPublicUrl(`${folderPath}/${file.name}`);
          const result: SubtitleFetchResult = {
            status: 'skipped', 
            reason: 'already_exists', 
            url: data.publicUrl,
            language: file === idFile ? 'id' : (file === enFile ? 'en' : 'unknown')
          };
          if (idFile) return result;
          fallback = result;
        }
      }
    } catch {
      // Ignored
    }

    let srtContent = '';
    let foundLang = 'id';

    // 1. Try Indonesian (OS -> Subdl)
    try {
      srtContent = await this.fetchFromOpenSubtitles(tmdbId, type, season, episode, 'id', signal);
    } catch {
      try {
        srtContent = await this.fetchFromSubdl(tmdbId, type, season, episode, 'ID', signal);
      } catch {
        if (fallback) return fallback;
        // 2. Fallback to English (OS -> Subdl)
        try {
          console.log(`[Subtitles] ID failed for ${tmdbId}. Trying EN Fallback...`);
          srtContent = await this.fetchFromOpenSubtitles(tmdbId, type, season, episode, 'en', signal);
          foundLang = 'en';
        } catch {
          try {
            srtContent = await this.fetchFromSubdl(tmdbId, type, season, episode, 'EN', signal);
            foundLang = 'en';
          } catch {
            return { status: 'error', reason: 'No subtitles found for ID or EN' };
          }
        }
      }
    }

    try {
      const vttContent = this.srtToVtt(srtContent);
      const storagePath = `${basePath}_${foundLang}.vtt`;

      const { error: uploadError } = await supabase.storage
        .from('subtitles')
        .upload(storagePath, Buffer.from(vttContent, 'utf-8'), {
          contentType: 'text/vtt',
          upsert: true,
        });

      if (uploadError) return { status: 'error', reason: 'Upload failed: ' + uploadError.message };

      const { data: publicUrlData } = supabase.storage.from('subtitles').getPublicUrl(storagePath);
      
      return { 
        status: 'success', 
        url: publicUrlData.publicUrl,
        language: foundLang
      };
    } catch (err: unknown) {
      return { status: 'error', reason: err instanceof Error ? err.message : String(err) };
    }
  }
}
