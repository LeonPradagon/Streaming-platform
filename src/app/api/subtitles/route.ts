import { NextResponse } from 'next/server';
import { SubtitleService } from '@/services/SubtitleService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get('tmdb_id');
  const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv';
  const season = searchParams.get('season') || undefined;
  const episode = searchParams.get('episode') || undefined;
  
  if (!tmdbId) {
    return NextResponse.json({ error: 'tmdb_id is required' }, { status: 400 });
  }

  try {
    const result = await SubtitleService.fetchAndUploadSubtitle(tmdbId, type, season, episode);

    if (result.status === 'error') {
      return NextResponse.json({ error: result.reason }, { status: 404 });
    }

    return NextResponse.json({ 
      url: result.url,
      language: result.language,
      cached: result.status === 'skipped'
    });
  } catch (err: any) {
    console.error('[Subtitles API] Processing Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
