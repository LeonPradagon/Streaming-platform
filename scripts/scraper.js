/**
 * Scraper Core Logic
 * 
 * Script ini bertugas untuk:
 * 1. Mengambil drama/anime populer dari TMDB.
 * 2. Memasukkannya ke database Supabase dengan status 'pending'.
 * 3. Mengintegrasikan link embed awal.
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const tmdbApiKey = process.env.TMDB_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeMovies(type = 'tv', genreId = 18) { // Default 18 = Drama
  console.log(`Starting scrape for ${type} with genre ${genreId}...`);
  
  if (!tmdbApiKey) {
    console.error('TMDB_API_KEY missing');
    return;
  }

  try {
    // 1. Fetch from TMDB (Discover)
    const url = `https://api.themoviedb.org/3/discover/${type}?api_key=${tmdbApiKey}&with_genres=${genreId}&sort_by=popularity.desc`;
    const response = await fetch(url);
    const data = await response.json();

    const contents = data.results.slice(0, 10); // Ambil 10 teratas dulu untuk testing

    for (const item of contents) {
      const tmdbId = item.id;
      const title = item.name || item.title;
      const category = genreId === 16 ? 'anime' : 'drakor';

      console.log(`Processing: ${title} (TMDB: ${tmdbId})`);

      // 2. Insert to Supabase 'contents'
      const { data: dbContent, error: dbError } = await supabase
        .from('contents')
        .upsert({ 
          tmdb_id: tmdbId, 
          title: title, 
          type: category, 
          status: 'pending' 
        }, { onConflict: 'tmdb_id' })
        .select()
        .single();

      if (dbError) {
        console.error(`Error inserting ${title}:`, dbError.message);
        continue;
      }

      // 3. Simulasi pencarian Link Embed (Contoh link placeholder)
      // Nantinya bagian ini bisa dihubungkan ke crawler aggregator film
      const embedUrl = `https://vidsrc.to/embed/${type}/${tmdbId}`; // Contoh provider vidsrc
      
      const { error: linkError } = await supabase
        .from('embed_links')
        .upsert({
          content_id: dbContent.id,
          provider: 'Vidsrc (Auto)',
          url: embedUrl,
          quality: 'HD'
        });

      if (linkError) {
        console.error(`Error inserting link for ${title}:`, linkError.message);
      } else {
        console.log(`✅ Success: ${title} added to queue.`);
      }
    }

    console.log('Scraping session finished.');

  } catch (err) {
    console.error('Scraper failed:', err);
  }
}

// Jalankan: 18 = Drama (untuk Drakor), 16 = Animation (untuk Anime)
async function run() {
  await scrapeMovies('tv', 18); // Drakor
  await scrapeMovies('tv', 16); // Anime (TMDB treats Anime as Animation genre)
}

run();
