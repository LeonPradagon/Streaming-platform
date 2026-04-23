import { createClient } from '@supabase/supabase-js';

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
  /**
   * Convert SRT content to VTT format
   */
  private static srtToVtt(srt: string): string {
    let vtt = 'WEBVTT\n\n';
    const normalized = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split('\n\n').filter(block => block.trim());
    
    for (const block of blocks) {
      const lines = block.split('\n');
      let timestampIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
          timestampIdx = i;
          break;
        }
      }
      if (timestampIdx === -1) continue;
      
      const timestamp = lines[timestampIdx].replace(/,/g, '.');
      const text = lines.slice(timestampIdx + 1).join('\n');
      
      if (text.trim()) {
        vtt += `${timestamp}\n${text}\n\n`;
      }
    }
    return vtt;
  }

  private static async fetchWithTimeout(url: string, options: any = {}, timeout = 15000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  private static async fetchFromOpenSubtitles(tmdbId: number | string, type: 'movie' | 'tv', season?: string, episode?: string, langCode: string = 'id'): Promise<string> {
    if (!OPENSUBTITLES_API_KEY) throw new Error('OpenSubtitles API key missing');
    
    const searchParams = new URLSearchParams({
      tmdb_id: String(tmdbId),
      languages: langCode,
      order_by: 'download_count',
      order_direction: 'desc',
    });

    if (type === 'tv' && season && episode) {
      searchParams.set('season_number', season);
      searchParams.set('episode_number', episode);
    }

    const searchRes = await this.fetchWithTimeout(`${OS_BASE_URL}/subtitles?${searchParams.toString()}`, {
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

    const fileId = searchData.data[0].attributes?.files?.[0]?.file_id;
    if (!fileId) throw new Error('No subtitle file ID found');

    const downloadRes = await this.fetchWithTimeout(`${OS_BASE_URL}/download`, {
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

    const fileRes = await this.fetchWithTimeout(downloadUrl);
    if (!fileRes.ok) throw new Error('Failed to fetch from OS dl URL');

    return await fileRes.text();
  }

  private static async fetchFromSubdl(tmdbId: number | string, type: 'movie' | 'tv', season?: string, episode?: string, langCode: string = 'ID'): Promise<string> {
    if (!SUBDL_API_KEY) throw new Error('Subdl API Key missing');
    
    let subdlUrl = `https://api.subdl.com/api/v1/subtitles?api_key=${SUBDL_API_KEY}&tmdb_id=${tmdbId}&languages=${langCode.toUpperCase()}&type=${type}`;
    if (type === 'tv' && season && episode) {
      subdlUrl += `&season_number=${season}&episode_number=${episode}`;
    }

    const subdlRes = await this.fetchWithTimeout(subdlUrl);
    if (!subdlRes.ok) throw new Error(`Subdl Search Failed: ${subdlRes.status}`);

    const subdlData = await subdlRes.json();
    if (!subdlData.status || !subdlData.subtitles || subdlData.subtitles.length === 0) {
      throw new Error(`No ${langCode} subtitles found on Subdl`);
    }

    const downloadLink = `https://dl.subdl.com${subdlData.subtitles[0].url}`;
    const zipRes = await this.fetchWithTimeout(downloadLink);
    if (!zipRes.ok) throw new Error('Failed to download ZIP from Subdl');

    const arrayBuffer = await zipRes.arrayBuffer();
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(Buffer.from(arrayBuffer));
    
    for (const entry of zip.getEntries()) {
      if (entry.entryName.toLowerCase().endsWith('.srt')) {
        return zip.readAsText(entry);
      }
    }

    throw new Error('No .srt file found inside Subdl ZIP');
  }

  public static async fetchAndUploadSubtitle(tmdbId: number | string, type: 'movie' | 'tv' = 'movie', season?: string, episode?: string): Promise<SubtitleFetchResult> {
    // We will save language as part of the filename: movie/123_id.vtt or movie/123_en.vtt
    // Actually, to avoid breaking existing frontend logic that expects /api/subtitles?tmdb_id=123 to return the correct sub,
    // we will save it as {type}/{tmdbId}_en.vtt or {type}/{tmdbId}_id.vtt, and the API will find whichever exists.
    const basePath = type === 'tv' && season && episode
      ? `${type}/${tmdbId}/s${season}e${episode}`
      : `${type}/${tmdbId}`;

    // 0. Check if already exists in storage (ID or EN)
    try {
      const folderPath = type === 'tv' && season && episode ? `${type}/${tmdbId}` : `${type}`;
      const searchPrefix = type === 'tv' && season && episode ? `s${season}e${episode}` : `${tmdbId}`;
      
      const { data: listData } = await supabase.storage.from('subtitles').list(folderPath, { search: searchPrefix });
      
      if (listData && listData.length > 0) {
        // If file exists
        const file = listData.find(f => f.name === `${searchPrefix}_id.vtt` || f.name === `${searchPrefix}_en.vtt` || f.name === `${searchPrefix}.vtt`);
        if (file) {
          const { data } = supabase.storage.from('subtitles').getPublicUrl(`${folderPath}/${file.name}`);
          return { 
            status: 'skipped', 
            reason: 'already_exists', 
            url: data.publicUrl,
            language: file.name.includes('_en') ? 'en' : 'id'
          };
        }
      }
    } catch (e) {}

    let srtContent = '';
    let foundLang = 'id';

    // 1. Try Indonesian (OS -> Subdl)
    try {
      srtContent = await this.fetchFromOpenSubtitles(tmdbId, type, season, episode, 'id');
    } catch (errOS) {
      try {
        srtContent = await this.fetchFromSubdl(tmdbId, type, season, episode, 'ID');
      } catch (errSubdl) {
        // 2. Fallback to English (OS -> Subdl)
        try {
          console.log(`[Subtitles] ID failed for ${tmdbId}. Trying EN Fallback...`);
          srtContent = await this.fetchFromOpenSubtitles(tmdbId, type, season, episode, 'en');
          foundLang = 'en';
        } catch (errOSEn) {
          try {
            srtContent = await this.fetchFromSubdl(tmdbId, type, season, episode, 'EN');
            foundLang = 'en';
          } catch (errSubdlEn) {
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
    } catch (err: any) {
      return { status: 'error', reason: err.message };
    }
  }
}
