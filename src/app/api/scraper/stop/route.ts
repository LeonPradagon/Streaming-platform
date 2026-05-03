import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // Validasi session admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ubah status semua task yang 'running' menjadi 'failed' dengan pesan khusus
    const { data, error } = await supabase
      .from('scraper_logs')
      .update({ 
        status: 'failed', 
        error_message: 'Task Aborted' // This message matches the abort check in ScraperService
      })
      .eq('status', 'running')
      .select();

    if (error) {
      console.error('[API] Stop Scraper Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Semua tugas scraper berhasil dihentikan.',
      stopped: data?.length || 0
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] Stop Scraper Fatal:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
