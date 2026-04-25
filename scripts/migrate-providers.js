// Script to migrate ALL content to new embed providers (with pagination)
// Run with: node scripts/migrate-providers.js

const SUPABASE_URL = 'https://oqpubtvugpevpgflrjwv.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcHVidHZ1Z3BldnBnZmxyand2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMwMjg1MiwiZXhwIjoyMDkxODc4ODUyfQ.wqYCGxciXK-63sLaR5hkBuvHQ5rT-kJa7jzSgDDqRMk';

const ALL_PROVIDERS = [
  { name: 'VidLink', urlFn: (tmdbId, isTV) => `https://vidlink.pro/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
  { name: 'VidSrc.pm', urlFn: (tmdbId, isTV) => `https://vidsrc.pm/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
  { name: 'MoviesAPI', urlFn: (tmdbId, isTV) => `https://moviesapi.to/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '-1-1' : ''}` },
  { name: 'Videasy', urlFn: (tmdbId, isTV) => `https://player.videasy.net/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
  { name: 'EmbedSU', urlFn: (tmdbId, isTV) => `https://embed.su/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
  { name: 'MultiEmbed', urlFn: (tmdbId, isTV) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1${isTV ? '&s=1&e=1' : ''}` },
  { name: 'VidSrc', urlFn: (tmdbId, isTV) => `https://vidsrc.cc/v2/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
  { name: 'AutoEmbed', urlFn: (tmdbId, isTV) => `https://autoembed.cc/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
  { name: 'EmbedSoap', urlFn: (tmdbId, isTV) => `https://embedsoap.net/embed/${isTV ? 'tv' : 'movie'}/${tmdbId}${isTV ? '/1/1' : ''}` },
];

async function fetchAllContents() {
  let allContents = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contents?select=id,tmdb_id,type&order=id`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Range': `${from}-${to}`,
      }
    });
    
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    
    allContents = allContents.concat(data);
    console.log(`  Fetched page ${page + 1}: ${data.length} items (total: ${allContents.length})`);
    
    if (data.length < pageSize) break;
    page++;
  }
  
  return allContents;
}

async function migrate() {
  console.log('Fetching all contents...');
  const contents = await fetchAllContents();
  console.log(`\nTotal: ${contents.length} content items to migrate\n`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < contents.length; i += 10) {
    const batch = contents.slice(i, i + 10);
    
    await Promise.all(batch.map(async (content) => {
      const isTV = content.type !== 'movie';
      
      try {
        for (const provider of ALL_PROVIDERS) {
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
        if (updated % 100 === 0) {
          console.log(`  Progress: ${updated}/${contents.length}`);
        }
      } catch (err) {
        failed++;
        console.error(`Failed for content ${content.id}:`, err.message);
      }
    }));
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${contents.length}`);
}

migrate().catch(console.error);
