/**
 * Universal Scraper logic
 */

const { createClient } = require("@supabase/supabase-js");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const tmdbApiKey = process.env.TMDB_API_KEY;

if (!supabaseServiceKey) {
  console.warn('[Scraper] WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Using anon key - writes may be blocked by RLS.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

// Definisi Genre Utama
const MOVIE_GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 35, name: "Comedy" },
  { id: 27, name: "Horror" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
];

const TV_GENRES = [
  { id: 10759, name: "Action & Adventure" },
  { id: 16, name: "Animation" }, // For Anime
  { id: 18, name: "Drama" }, // For Drakor
  { id: 10765, name: "Sci-Fi & Fantasy" },
];

async function scrapeMetadata(type = "tv", genreId = 18, pagesToScrape = 3) {
  console.log(`\n🔍 Starting scrape for ${type} | Genre ID: ${genreId}...`);

  if (!tmdbApiKey) {
    console.error("TMDB_API_KEY missing");
    return;
  }

  try {
    for (let page = 1; page <= pagesToScrape; page++) {
      console.log(`   📄 Fetching Page ${page}...`);
      const url = `https://api.themoviedb.org/3/discover/${type}?api_key=${tmdbApiKey}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        console.error(
          `No results for ${type} genre ${genreId} on page ${page}`,
        );
        break; // Stop if no more results
      }

      const contents = data.results; // Do all results instead of slice(0, 10)

      for (const item of contents) {
        const tmdbId = item.id;
        const title = item.name || item.title;

        // Categorization Logic
        let category = "movie";
        if (type === "tv") {
          category = genreId === 16 ? "anime" : "drakor";
        }

        console.log(`   - Processing: ${title} (${category.toUpperCase()})`);

        // 1. Insert/Upsert Content
        const { data: dbContent, error: dbError } = await supabase
          .from("contents")
          .upsert(
            {
              tmdb_id: tmdbId,
              title: title,
              type: category,
              status: "pending",
            },
            { onConflict: "tmdb_id" },
          )
          .select()
          .single();

        if (dbError) {
          // Fallback for 'movie' type if constraint not updated by user
          if (
            dbError.message.includes("check constraint") &&
            category === "movie"
          ) {
            console.warn(
              `      ⚠️  Constraint check failed for 'movie'. Falling back to 'drakor'...`,
            );
            const { data: fallback, error: fbError } = await supabase
              .from("contents")
              .upsert(
                {
                  tmdb_id: tmdbId,
                  title: title,
                  type: "drakor",
                  status: "pending",
                },
                { onConflict: "tmdb_id" },
              )
              .select()
              .single();
            if (fbError) {
              console.error(`      ❌ Fallback failed:`, fbError.message);
              continue;
            }
            // Use fallback content for links
            addProviderLinks(fallback, type, tmdbId);
          } else {
            console.error(
              `      ❌ Error inserting ${title}:`,
              dbError.message,
            );
            continue;
          }
        } else {
          addProviderLinks(dbContent, type, tmdbId);
        }
      }
    }
  } catch (err) {
    console.error("Scraper failed:", err);
  }
}

async function addProviderLinks(dbContent, type, tmdbId) {
  const isTV = type === "tv" || type === "anime";
  const providers = [
    {
      name: "Server 1",
      url: `https://vidlink.pro/${isTV ? "tv" : "movie"}/${tmdbId}${isTV ? "/1/1" : ""}?player=jw`,
    },
    {
      name: "Server 2",
      url: `https://vidsrc.pm/embed/${isTV ? "tv" : "movie"}/${tmdbId}${isTV ? "/1/1" : ""}`,
    },
  ];

  for (const p of providers) {
    const { error: linkError } = await supabase.from("embed_links").upsert(
      {
        content_id: dbContent.id,
        provider: p.name,
        url: p.url,
        quality: "HD",
      },
      { onConflict: "content_id,provider" },
    );

    if (linkError) {
      console.error(`      ❌ Error link for ${p.name}:`, linkError.message);
    }
  }
}

async function syncExistingContent() {
  console.log("\n🔄 Syncing links for EXISTING content in database...");
  const { data: contents, error } = await supabase.from("contents").select("*");

  if (error) {
    console.error("Error fetching contents:", error.message);
    return;
  }

  console.log(`   - Found ${contents.length} items to sync.`);

  for (const item of contents) {
    console.log(`   - Syncing: ${item.title} (${item.type})`);
    // Pass correct 'type' based on category
    const tmdbType = item.type === "movie" ? "movie" : "tv";
    await addProviderLinks(item, tmdbType, item.tmdb_id);
  }
}

async function run() {
  console.log("🚀 Starting FULL Scraper session...");

  // 1. Sync existing first to ensure everything has links
  await syncExistingContent();

  // 2. Discover new TV Categories
  for (const g of TV_GENRES) {
    await scrapeMetadata("tv", g.id);
  }

  // 3. Discover new Movie Categories
  for (const g of MOVIE_GENRES) {
    await scrapeMetadata("movie", g.id);
  }

  console.log("\n✅ ALL Scraping session finished.");
}

run();
