import { NextResponse } from 'next/server';

export async function GET() {
  const tmdbKey = process.env.TMDB_API_KEY;
  
  const providers = [
    { name: 'TMDB API', url: `https://api.themoviedb.org/3/configuration?api_key=${tmdbKey}` },
    { name: 'Vidlink.pro', url: 'https://vidlink.pro' },
    { name: 'Vidsrc.pm', url: 'https://vidsrc.pm' }
  ];

  const results = await Promise.all(providers.map(async (p) => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const res = await fetch(p.url, { 
        method: 'HEAD', 
        signal: controller.signal,
        cache: 'no-store' 
      });
      
      clearTimeout(timeout);
      const latency = Date.now() - start;
      
      return {
        name: p.name,
        status: res.ok || res.status === 403 ? 'Operational' : 'Issue Detected',
        delay: `${latency}ms`,
        isHealthy: res.ok || res.status === 403
      };
    } catch (err) {
      return {
        name: p.name,
        status: 'Offline',
        delay: '>3000ms',
        isHealthy: false
      };
    }
  }));

  return NextResponse.json({ providers: results });
}
