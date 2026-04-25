// Script to add old providers back to DB (keeping new ones too)
// Run with: node scripts/restore-old-providers.js

const SUPABASE_URL = 'https://oqpubtvugpevpgflrjwv.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcHVidHZ1Z3BldnBnZmxyand2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMwMjg1MiwiZXhwIjoyMDkxODc4ODUyfQ.wqYCGxciXK-63sLaR5hkBuvHQ5rT-kJa7jzSgDDqRMk';

async function migrate() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contents?select=id,tmdb_id,type`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
  });
  
  const contents = await res.json();
  console.log(`Found ${contents.length} content items`);

  const OLD_PROVIDERS = [
    { name: 'VidLink', urlFn: (tmdbId, isTV) => `https://vidlink.pro/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
    { name: 'VidSrc.pm', urlFn: (tmdbId, isTV) => `https://vidsrc.pm/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
    { name: 'MoviesAPI', urlFn: (tmdbId, isTV) => `https://moviesapi.to/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '-1-1' : ''}` },
  ];

  let updated = 0;

  for (let i = 0; i < contents.length; i += 10) {
    const batch = contents.slice(i, i + 10);
    
    await Promise.all(batch.map(async (content) => {
      const isTV = content.type !== 'movie';
      
      try {
        for (const provider of OLD_PROVIDERS) {
          await fetch(`${SUPABASE_URL}/rest/v1/embed_links`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify({
              content_id: content.id,
              provider: provider.name,
              url: provider.urlFn(content.tmdb_id, isTV),
              quality: 'HD'
            })
          });
        }
        updated++;
        if (updated % 100 === 0) console.log(`  Progress: ${updated}/${contents.length}`);
      } catch (err) {
        console.error(`Failed for ${content.id}:`, err.message);
      }
    }));
  }

  console.log(`\n✅ Restored old providers for ${updated} items!`);
}

migrate().catch(console.error);
