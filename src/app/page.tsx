import { supabase } from '@/lib/supabase';
import { fetchTMDBMetadata, classifyPlatform, PLATFORM_LABELS, PLATFORM_COLORS, Platform } from '@/lib/tmdb';
import HeroCarousel from '@/components/HeroCarousel';
import ContentRow from '@/components/ContentRow';
import PersonalizedRows from '@/components/PersonalizedRows';
import { Flame, Sparkles, Tv, MonitorPlay, Clapperboard, Film as FilmIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // 1. Fetch approved content with basic info
  const { data: allContent, error: dbError } = await supabase
    .from('contents')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (dbError || !allContent) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="glass p-8 rounded-2xl text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">Gagal Memuat Konten</h2>
          <p className="text-gray-400">Silakan periksa koneksi database Anda.</p>
        </div>
      </div>
    );
  }

  // 2. Map stored metadata (no more bulk TMDB API calls!)
  const validContent = allContent.map((item: any) => {
    // We treat the database row as the source of truth for metadata
    // This dramatically speeds up page loads and prevents 429 errors
    return { 
      ...item, 
      metadata: {
        id: item.tmdb_id,
        title: item.title,
        overview: item.overview || item.metadata?.overview || '',
        poster_path: item.poster_path || item.metadata?.poster_path,
        backdrop_path: item.backdrop_path || item.metadata?.backdrop_path,
        vote_average: item.vote_average || item.metadata?.vote_average || 0,
        popularity: item.popularity || item.metadata?.popularity || 0,
        release_date: item.release_date || item.metadata?.release_date || item.metadata?.first_air_date,
        genres: (item.genre_names || item.metadata?.genres?.map((g: any) => g.name) || []).map((name: string) => ({ id: 0, name })),
        credits: { cast: item.cast_data || item.metadata?.credits?.cast || [] }
      },
      platform: item.platform || 'other' as Platform 
    };
  });

  // 3. Group by Specialized Type (Drakor, Drachin, etc.)
  const typeGroups: Record<string, typeof validContent> = {
    'drakor': [],
    'drachin': [],
    'anime': [],
    'donghua': [],
    'variety': [],
    'drathai': [],
    'drajep': [],
  };

  validContent.forEach((item: any) => {
    if (typeGroups[item.type]) {
      typeGroups[item.type].push(item);
    }
  });

  // 4. Group by Genre (Localized & Semantic)
  const genreGroups: Record<string, typeof validContent> = {
    'Aksi & Petualangan': [],
    'Drama & Romansa': [],
    'Horor & Misteri': [],
    'Komedi': [],
    'Animasi': [],
    'Sci-Fi & Fantasi': [],
  };

  validContent.forEach((item: any) => {
    const genres = (item.genre_names || item.metadata?.genres?.map((g: any) => g.name) || []).map((g: string) => g.toLowerCase());
    
    // Aksi & Petualangan
    if (genres.some((g: string) => ['action', 'adventure', 'war', 'martial arts', 'aksi', 'petualangan'].includes(g))) {
      genreGroups['Aksi & Petualangan'].push(item);
    }
    // Drama & Romansa
    if (genres.some((g: string) => ['drama', 'romance', 'romansa'].includes(g))) {
      genreGroups['Drama & Romansa'].push(item);
    }
    // Horor & Misteri
    if (genres.some((g: string) => ['horror', 'thriller', 'mystery', 'misteri', 'horor'].includes(g))) {
      genreGroups['Horor & Misteri'].push(item);
    }
    // Komedi
    if (genres.some((g: string) => ['comedy', 'family', 'komedi', 'keluarga'].includes(g))) {
      genreGroups['Komedi'].push(item);
    }
    // Animasi
    if (genres.some((g: string) => ['animation', 'kids', 'anak-anak', 'animasi'].includes(g))) {
      genreGroups['Animasi'].push(item);
    }
    // Sci-Fi & Fantasi
    if (genres.some((g: string) => ['science fiction', 'fantasy', 'sci-fi & fantasy', 'fantasi'].includes(g))) {
      genreGroups['Sci-Fi & Fantasi'].push(item);
    }
  });

  // 5. Group by Platform
  const platformGroups: Record<Platform, typeof validContent> = {
    netflix: [],
    disney: [],
    amazon: [],
    apple: [],
    hbo: [],
    paramount: [],
    anime: [],
    other: [],
  };

  validContent.forEach((item: any) => {
    platformGroups[item.platform as Platform].push(item);
  });

  // Layout logic
  const currTime = new Date().getTime();

  // Trending = highest popularity directly from TMDB
  const trending = [...validContent]
    .filter(a => (a.metadata?.popularity || 0) > 0)
    .sort((a, b) => (b.metadata?.popularity || 0) - (a.metadata?.popularity || 0));
    
  // Latest = newest release_date, but already released (no future unreleased movies)
  const latest = [...validContent]
    .filter(a => a.metadata?.release_date && new Date(a.metadata.release_date).getTime() <= currTime)
    .sort((a, b) => new Date(b.metadata.release_date).getTime() - new Date(a.metadata.release_date).getTime());

  // Hero uses a mix of newest high-quality content
  const heroItems = [...latest]
    .filter(a => (a.metadata?.vote_average || 0) >= 5)
    .slice(0, 5);

  const TYPE_LABELS: Record<string, string> = {
    drakor: '🇰🇷 Drama Korea (Drakor)',
    drachin: '🇨🇳 Drama China',
    anime: '🎌 Anime Terpopuler',
    donghua: '🐲 Donghua (Animasi China)',
    variety: '📺 Variety & Reality Shows',
    drathai: '🇹🇭 Drama Thailand',
    drajep: '🇯🇵 Drama Jepang (J-Drama)',
  };

  return (
    <div className="pb-10 relative">
      
      {heroItems.length > 0 ? (
        <HeroCarousel items={heroItems} />
      ) : (
        <div className="h-[80vh] flex items-center justify-center">
          <div className="skeleton w-3/4 h-1/2 rounded-xl"></div>
        </div>
      )}

      {/* Main Content Sections */}
      <div className="relative z-30 flex flex-col gap-3 pb-20 mt-2 px-0 md:px-0 bg-[#0f0f0f]">
        
        {/* Continue Watching & My List (Client Side) */}
        <PersonalizedRows />

        {/* New Releases */}
        {latest.length > 0 && (
          <ContentRow title="New Releases" items={latest} isNewRow={true} icon={<Sparkles size={22} />} />
        )}

        {/* Trending Now */}
        {trending.length > 0 && (
          <ContentRow title="Trending Now" items={trending} isNewRow={false} isTrendingRow={true} icon={<Flame size={22} />} />
        )}

        {/* Specialized Types (Primary Rows) */}
        {typeGroups.drakor.length > 0 && (
          <ContentRow title={TYPE_LABELS.drakor} items={typeGroups.drakor} icon={<Tv size={22} />} />
        )}

        {/* Popular Movies */}
        {genreGroups['Aksi & Petualangan'].length > 0 && (
          <ContentRow title="Popular Movies" items={genreGroups['Aksi & Petualangan']} icon={<Clapperboard size={22} />} />
        )}

        {/* Netflix Platform */}
        {platformGroups.netflix.length > 0 && (
          <ContentRow 
             title={PLATFORM_LABELS.netflix} 
             items={platformGroups.netflix} 
             platformColor={PLATFORM_COLORS.netflix}
          />
        )}

        {/* Drachin */}
        {typeGroups.drachin.length > 0 && (
          <ContentRow title={TYPE_LABELS.drachin} items={typeGroups.drachin} icon={<MonitorPlay size={22} />} />
        )}

        {/* Top Rated */}
        {genreGroups['Drama & Romansa'].length > 0 && (
          <ContentRow title="Top Rated" items={genreGroups['Drama & Romansa']} icon={<FilmIcon size={22} />} />
        )}

        {/* Anime / Animation */}
        {(typeGroups.anime.length > 0 || typeGroups.donghua.length > 0 || genreGroups['Animasi'].length > 0) && (
          <ContentRow 
            title={typeGroups.anime.length > 0 ? TYPE_LABELS.anime : "🎨 Animasi Terpopuler"} 
            items={Array.from(new Map([...typeGroups.anime, ...typeGroups.donghua, ...genreGroups['Animasi']].map(item => [item.id, item])).values())} 
            platformColor={PLATFORM_COLORS.anime} 
          />
        )}

        {/* Disney Platform */}
        {platformGroups.disney.length > 0 && (
          <ContentRow 
             title={PLATFORM_LABELS.disney} 
             items={platformGroups.disney} 
             platformColor={PLATFORM_COLORS.disney}
          />
        )}

        {/* Variety Shows */}
        {typeGroups.variety.length > 0 && (
          <ContentRow title={TYPE_LABELS.variety} items={typeGroups.variety} />
        )}

        {/* Remaining Countries */}
        {typeGroups.drathai.length > 0 && (
          <ContentRow title={TYPE_LABELS.drathai} items={typeGroups.drathai} />
        )}

        {/* Other Platform Sections */}
        {['amazon', 'hbo', 'apple', 'paramount'].map((p) => {
           const platform = p as Platform;
           if (platformGroups[platform].length === 0) return null;
           return (
             <ContentRow 
               key={platform} 
               title={PLATFORM_LABELS[platform]} 
               items={platformGroups[platform]} 
               platformColor={PLATFORM_COLORS[platform]}
             />
           );
        })}

        {/* Horror Genre */}
        {genreGroups['Horor & Misteri'].length > 0 && (
          <ContentRow title="👻 Horor & Misteri" items={genreGroups['Horor & Misteri']} />
        )}

        {/* Sci-Fi */}
        {genreGroups['Sci-Fi & Fantasi'].length > 0 && (
          <ContentRow title="🚀 Dunia Sci-Fi & Fantasi" items={genreGroups['Sci-Fi & Fantasi']} />
        )}

        {/* Empty State */}
        {validContent.length === 0 && (
          <div className="px-5 mt-20">
             <div className="glass p-12 text-center rounded-2xl mx-auto max-w-2xl border-white/5">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">Situs Masih Kosong</h2>
              <p className="text-gray-400 text-lg">Gunakan panel admin atau scraper untuk mengisi konten premium pertama Anda.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
