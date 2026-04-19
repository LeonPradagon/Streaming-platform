import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY;
const BASE_URL = 'https://api.opensubtitles.com/api/v1';

// Supabase client with service role for storage uploads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Convert SRT content to VTT format
 */
function srtToVtt(srt: string): string {
  let vtt = 'WEBVTT\n\n';
  
  // Normalize line endings
  const normalized = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split into subtitle blocks
  const blocks = normalized.split('\n\n').filter(block => block.trim());
  
  for (const block of blocks) {
    const lines = block.split('\n');
    
    // Find the timestamp line (contains "-->")
    let timestampIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timestampIdx = i;
        break;
      }
    }
    
    if (timestampIdx === -1) continue;
    
    // Convert timestamp: replace commas with dots for VTT format
    const timestamp = lines[timestampIdx].replace(/,/g, '.');
    
    // Get subtitle text (everything after timestamp)
    const text = lines.slice(timestampIdx + 1).join('\n');
    
    if (text.trim()) {
      vtt += `${timestamp}\n${text}\n\n`;
    }
  }
  
  return vtt;
}

// Rate Limit Map
const rateLimitMap = new Map<string, { count: number, resetAt: number }>();

export async function GET(req: Request) {
  // Rate Limiting (Simple In-Memory for API route)
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const rateRecord = rateLimitMap.get(ip) || { count: 0, resetAt: now + 60000 };
  
  if (now > rateRecord.resetAt) {
    rateRecord.count = 1;
    rateRecord.resetAt = now + 60000;
  } else {
    rateRecord.count += 1;
  }
  rateLimitMap.set(ip, rateRecord);

  if (rateRecord.count > 15) {
    return NextResponse.json({ error: 'Too many requests / Rate Limited' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get('tmdb_id');
  const type = searchParams.get('type') || 'movie';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  
  if (!tmdbId) {
    return NextResponse.json({ error: 'tmdb_id is required' }, { status: 400 });
  }
  
  if (!OPENSUBTITLES_API_KEY) {
    return NextResponse.json({ error: 'OpenSubtitles API key not configured' }, { status: 500 });
  }

  // Build storage path
  const storagePath = type === 'tv' && season && episode
    ? `${type}/${tmdbId}/s${season}e${episode}.vtt`
    : `${type}/${tmdbId}.vtt`;

  // Step 0: Check if subtitle already exists in Supabase Storage
  const { data: existingFile } = await supabase.storage
    .from('subtitles')
    .createSignedUrl(storagePath, 86400); // 24h signed URL

  if (existingFile?.signedUrl) {
    // File exists — return public URL
    const { data: publicUrlData } = supabase.storage
      .from('subtitles')
      .getPublicUrl(storagePath);

    return NextResponse.json({ 
      url: publicUrlData.publicUrl,
      cached: true 
    });
  }

  try {
    // Step 1: Search for Indonesian subtitles
    const searchParams2 = new URLSearchParams({
      tmdb_id: tmdbId,
      languages: 'id',
      order_by: 'download_count',
      order_direction: 'desc',
    });

    if (type === 'tv' && season && episode) {
      searchParams2.set('season_number', season);
      searchParams2.set('episode_number', episode);
    }

    const searchRes = await fetch(`${BASE_URL}/subtitles?${searchParams2.toString()}`, {
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'StreamingApp v1.0',
      },
    });

    if (!searchRes.ok) {
      console.error('[Subtitles] Search failed:', searchRes.status);
      return NextResponse.json({ error: 'Subtitle search failed' }, { status: searchRes.status });
    }

    const searchData = await searchRes.json();
    
    if (!searchData.data || searchData.data.length === 0) {
      return NextResponse.json({ error: 'No Indonesian subtitles found' }, { status: 404 });
    }

    // Get the best subtitle (highest download count)
    const bestSub = searchData.data[0];
    const fileId = bestSub.attributes?.files?.[0]?.file_id;

    if (!fileId) {
      return NextResponse.json({ error: 'No subtitle file found' }, { status: 404 });
    }

    // Step 2: Request download link from OpenSubtitles
    const downloadRes = await fetch(`${BASE_URL}/download`, {
      method: 'POST',
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'StreamingApp v1.0',
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    if (!downloadRes.ok) {
      console.error('[Subtitles] Download request failed:', downloadRes.status);
      return NextResponse.json({ error: 'Subtitle download failed' }, { status: downloadRes.status });
    }

    const downloadData = await downloadRes.json();
    const downloadUrl = downloadData.link;

    if (!downloadUrl) {
      return NextResponse.json({ error: 'No download link received' }, { status: 500 });
    }

    // Step 3: Download the actual subtitle file
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch subtitle file' }, { status: 500 });
    }

    const srtContent = await fileRes.text();

    // Step 4: Convert SRT to VTT
    const vttContent = srtToVtt(srtContent);

    // Step 5: Upload VTT to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('subtitles')
      .upload(storagePath, new Blob([vttContent], { type: 'text/vtt' }), {
        contentType: 'text/vtt',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Subtitles] Upload error:', uploadError.message);
      // Still return inline VTT as fallback
      return new Response(vttContent, {
        headers: {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Step 6: Return the public URL
    const { data: publicUrlData } = supabase.storage
      .from('subtitles')
      .getPublicUrl(storagePath);

    return NextResponse.json({ 
      url: publicUrlData.publicUrl,
      cached: false 
    });
  } catch (err: any) {
    console.error('[Subtitles] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
