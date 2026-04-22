require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const AdmZip = require('adm-zip');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const SUBDL_API_KEY = process.env.SUBDL_API_KEY;
const DELAY_MS = 1500; // 1.5s delay to avoid rate limiting

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function srtToVtt(srtContent) {
  if (!srtContent) return '';
  let vtt = 'WEBVTT\n\n';
  const lines = srtContent.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === '') {
      i++;
      continue;
    }
    const indexLine = lines[i];
    i++;
    if (i >= lines.length) break;
    const timeLine = lines[i].replace(/,/g, '.');
    i++;
    vtt += `${indexLine}\n${timeLine}\n`;
    while (i < lines.length && lines[i].trim() !== '') {
      vtt += `${lines[i]}\n`;
      i++;
    }
    vtt += '\n';
  }
  return vtt;
}

async function checkIsIndonesian(tmdbId, type) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return false;
    const data = await res.json();
    
    if (data.original_language === 'id') return true;
    if (data.origin_country && data.origin_country.includes('ID')) return true;
    if (data.production_countries && data.production_countries.some(c => c.iso_3166_1 === 'ID')) return true;
    
    return false;
  } catch (err) {
    console.error(`[TMDB Error] ID ${tmdbId}:`, err.message);
    return false;
  }
}

const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY;

async function processSubtitles(tmdbId) {
  const storagePath = `movie/${tmdbId}/id.vtt`;

  // Check if file already exists
  try {
    const { data: listData, error: listError } = await supabase.storage
      .from('subtitles')
      .list(`movie/${tmdbId}`);
      
    if (!listError && listData && listData.some(f => f.name === 'id.vtt')) {
      return { status: 'skipped', reason: 'already_exists' };
    }
  } catch (err) {}

  let srtContent = '';

  // 1. Try OpenSubtitles
  try {
    if (!OPENSUBTITLES_API_KEY) throw new Error('No OS Key');
    const searchRes = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?tmdb_id=${tmdbId}&languages=id&order_by=download_count&order_direction=desc`, {
      headers: { 'Api-Key': OPENSUBTITLES_API_KEY, 'Content-Type': 'application/json' }
    });
    if (!searchRes.ok) throw new Error(`OS Search Failed ${searchRes.status}`);
    const searchData = await searchRes.json();
    if (!searchData.data || searchData.data.length === 0) throw new Error('No subs on OS');
    const fileId = searchData.data[0].attributes?.files?.[0]?.file_id;
    if (!fileId) throw new Error('No file ID');

    const dlRes = await fetch(`https://api.opensubtitles.com/api/v1/download`, {
      method: 'POST',
      headers: { 'Api-Key': OPENSUBTITLES_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId })
    });
    if (!dlRes.ok) throw new Error('OS Download API Failed');
    const dlData = await dlRes.json();
    
    const fileRes = await fetch(dlData.link);
    srtContent = await fileRes.text();
  } catch (osErr) {
    // 2. Try Subdl Fallback
    try {
      const subdlUrl = `https://api.subdl.com/api/v1/subtitles?api_key=${SUBDL_API_KEY}&tmdb_id=${tmdbId}&languages=ID&type=movie`;
      const res = await fetch(subdlUrl);
      if (!res.ok) throw new Error(`Subdl failed with ${res.status}`);
      const data = await res.json();
      if (!data.status || !data.subtitles || data.subtitles.length === 0) throw new Error('No subtitle on Subdl');

      const zipRes = await fetch(`https://dl.subdl.com${data.subtitles[0].url}`);
      const arrayBuffer = await zipRes.arrayBuffer();
      const zip = new AdmZip(Buffer.from(arrayBuffer));
      
      for (const entry of zip.getEntries()) {
        if (entry.entryName.toLowerCase().endsWith('.srt')) {
          srtContent = zip.readAsText(entry);
          break;
        }
      }
      if (!srtContent) throw new Error('No .srt in ZIP');
    } catch (subdlErr) {
      return { status: 'error', reason: `OS: ${osErr.message} | Subdl: ${subdlErr.message}` };
    }
  }

  try {
    const vttContent = srtToVtt(srtContent);
    const { error: uploadError } = await supabase.storage
      .from('subtitles')
      .upload(storagePath, Buffer.from(vttContent, 'utf-8'), {
        contentType: 'text/vtt',
        upsert: true,
      });

    if (uploadError) return { status: 'error', reason: 'Upload failed: ' + uploadError.message };
    return { status: 'success' };
  } catch (err) {
    return { status: 'error', reason: err.message };
  }
}

async function main() {
  console.log('Starting Bulk Cleanup and Subtitle Pre-fetch...');
  
  let offset = 0;
  const limit = 500;
  let hasMore = true;
  let totalProcessed = 0;
  let totalDeleted = 0;
  let subSuccess = 0;
  let subFailed = 0;
  let subSkipped = 0;

  while (hasMore) {
    const { data: items, error } = await supabase
      .from('contents')
      .select('id, tmdb_id, title, type')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching contents:', error);
      break;
    }

    if (!items || items.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of items) {
      totalProcessed++;
      
      const isIndo = await checkIsIndonesian(item.tmdb_id, item.type);
      if (isIndo) {
        await supabase.from('contents').delete().eq('id', item.id);
        console.log(`[${totalProcessed}] DELETED: ${item.title} (Indonesian)`);
        totalDeleted++;
        await sleep(DELAY_MS);
        continue;
      }

      if (item.type === 'movie') {
        const subResult = await processSubtitles(item.tmdb_id);
        if (subResult.status === 'success') {
          console.log(`[${totalProcessed}] SUBDL SUCCESS: ${item.title}`);
          subSuccess++;
        } else if (subResult.status === 'skipped') {
          console.log(`[${totalProcessed}] SUBDL SKIPPED: ${item.title} (${subResult.reason})`);
          subSkipped++;
        } else {
          console.log(`[${totalProcessed}] SUBDL FAILED: ${item.title} (${subResult.reason})`);
          subFailed++;
        }
      } else {
         console.log(`[${totalProcessed}] SKIPPED TV SHOW: ${item.title}`);
      }

      await sleep(DELAY_MS);
    }

    offset += limit;
  }

  console.log('==================================');
  console.log('FINISHED!');
  console.log(`Total Processed: ${totalProcessed}`);
  console.log(`Total Indonesian Deleted: ${totalDeleted}`);
  console.log(`Subtitles Uploaded: ${subSuccess}`);
  console.log(`Subtitles Skipped (Exists): ${subSkipped}`);
  console.log(`Subtitles Failed/Not Found: ${subFailed}`);
}

main().catch(console.error);
