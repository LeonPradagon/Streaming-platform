import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-time migration API to update all existing embed_links 
 * from old providers (Server 1/2/3) to new providers.
 * Call via: POST /api/scraper/migrate-providers
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all contents with tmdb_id
    const { data: contents, error } = await supabase
      .from('contents')
      .select('id, tmdb_id, type');

    if (error || !contents) {
      return NextResponse.json({ error: 'Failed to fetch contents', details: error?.message }, { status: 500 });
    }

    let updated = 0;
    let failed = 0;

    const NEW_PROVIDERS = [
      { name: 'Videasy', urlFn: (tmdbId: number, isTV: boolean) => `https://player.videasy.net/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
      { name: 'EmbedSU', urlFn: (tmdbId: number, isTV: boolean) => `https://embed.su/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
      { name: 'MultiEmbed', urlFn: (tmdbId: number, isTV: boolean) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1${isTV ? '&s=1&e=1' : ''}` },
      { name: 'VidSrc', urlFn: (tmdbId: number, isTV: boolean) => `https://vidsrc.cc/v2/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
      { name: 'AutoEmbed', urlFn: (tmdbId: number, isTV: boolean) => `https://autoembed.cc/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
      { name: 'EmbedSoap', urlFn: (tmdbId: number, isTV: boolean) => `https://embedsoap.net/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
    ];

    // Process in batches of 20
    for (let i = 0; i < contents.length; i += 20) {
      const batch = contents.slice(i, i + 20);
      
      await Promise.all(batch.map(async (content) => {
        const isTV = content.type !== 'movie';
        
        try {
          for (const provider of NEW_PROVIDERS) {
            await supabase.from('embed_links').upsert({
              content_id: content.id,
              provider: provider.name,
              url: provider.urlFn(content.tmdb_id, isTV),
              quality: 'HD'
            }, { onConflict: 'content_id,provider' });
          }
          updated++;
        } catch (err) {
          failed++;
        }
      }));
    }

    // Optionally: Delete old provider links
    await supabase.from('embed_links').delete().in('provider', ['Server 1', 'Server 2', 'Server 3']);

    return NextResponse.json({ 
      success: true, 
      message: `Migration complete. Updated ${updated} items, ${failed} failed.`,
      updated,
      failed,
      total: contents.length
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
