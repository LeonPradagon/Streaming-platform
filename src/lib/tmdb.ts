/**
 * TMDB API Service
 * 
 * Digunakan untuk mengambil metadata (poster, sinopsis, rating) 
 * dari The Movie Database (TMDB).
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string;
  vote_average?: number;
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string;
  episode_count: number;
  episodes?: TMDBEpisode[];
}

export interface TMDBMetadata {
  id: number;
  title?: string;
  name?: string; // Untuk TV Series (Drakor/Anime)
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
  status?: string;
  genres: { id: number; name: string }[];
  networks?: { id: number; name: string; logo_path?: string }[];
  production_companies?: { id: number; name: string; logo_path?: string; origin_country?: string }[];
  origin_country?: string[];
  number_of_seasons?: number;
  seasons?: TMDBSeason[];
  credits?: { cast: { id: number; name: string; character: string; profile_path: string | null }[] };
}

export const fetchTMDBMetadata = async (id: number, type: 'movie' | 'tv'): Promise<TMDBMetadata | null> => {
  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not set in environment variables.');
    return null;
  }

  try {
    const response = await fetch(`${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`, { next: { revalidate: 3600 } });
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`TMDB API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data as TMDBMetadata;
  } catch (error) {
    console.error('Error fetching TMDB metadata:', error);
    return null;
  }
};

export const fetchTMDBTVSeasonDetails = async (tvId: number, seasonNumber: number): Promise<TMDBSeason | null> => {
  if (!TMDB_API_KEY) return null;
  try {
    const response = await fetch(`${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`, { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`TMDB API Error: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching season details:', error);
    return null;
  }
};

/**
 * Get image URL from TMDB path
 */
export const getTMDBImageUrl = (path: string, size: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500') => {
  if (!path) return '/placeholder-poster.png';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

// ============================================================
// Platform Classification
// ============================================================

export type Platform = 'netflix' | 'disney' | 'amazon' | 'apple' | 'hbo' | 'paramount' | 'anime' | 'other';

// TMDB Network IDs — Expanded for comprehensive platform classification
export const TMDB_NETWORKS = {
  NETFLIX: [213, 49, 2552, 3749], // Netflix, Netflix Kids
  DISNEY: [2739, 3353, 2, 54, 6125, 3475], // Disney+, Disney Channel, Hotstar
  AMAZON: [1024, 4353, 4354, 2697], // Amazon Prime Video, Freevee, MGM+
  APPLE: [2552, 3750], // Apple TV+
  HBO: [49, 3186, 2832, 453, 3306, 1709], // HBO, HBO Max, Max, Cinemax
  PARAMOUNT: [4330, 2076, 16, 4353, 1023, 43], // Paramount+, CBS, Showtime
  ANIME: [614, 98, 210, 1112, 269, 174, 100, 1376, 171, 167, 68, 530, 2064, 1430, 2750, 3619, 287, 1341, 366, 2534, 173]
};

export const TMDB_COMPANIES = {
  NETFLIX: [213534, 157436, 145174, 15231, 211346, 132628, 186116, 175281],
  DISNEY: [2, 3166, 6125, 420, 16211, 3, 25, 11461, 176762, 184228, 1382, 7505],
  AMAZON: [9353, 20580, 7429, 246660, 10817, 138381, 21, 2440],
  APPLE: [164461, 138382, 140042, 137787, 126860],
  HBO: [3268, 174652, 12, 76043, 3267, 5820, 125581, 157627],
  PARAMOUNT: [4, 21, 882, 11, 5, 122951, 7493, 25841]
};

// Watch Provider IDs (JustWatch / TMDB) for additional matching
export const TMDB_WATCH_PROVIDERS = {
  NETFLIX: [8],
  DISNEY: [337, 390],
  AMAZON: [9, 119, 10],
  APPLE: [350, 2],
  HBO: [384, 1899],
  PARAMOUNT: [531, 37]
};

/**
 * Enhanced Content Types for Streaming Platforms
 */
export type ContentType = 'movie' | 'tv' | 'anime' | 'drakor' | 'drachin' | 'donghua' | 'variety' | 'drathai' | 'drajep';

/**
 * Classify content into a specific cultural/genre type
 */
export function classifyContentType(metadata: TMDBMetadata | null, tmdbType: 'movie' | 'tv'): ContentType {
  if (!metadata) return tmdbType === 'movie' ? 'movie' : 'tv';
  
  if (tmdbType === 'movie') return 'movie';

  const genreIds = (metadata.genres || []).map(g => g.id);
  const countries = metadata.origin_country || [];
  const isAnimation = genreIds.includes(16);

  // 1. Anime (JP Animation)
  if (isAnimation && countries.includes('JP')) return 'anime';
  
  // 2. Donghua (CN Animation)
  if (isAnimation && (countries.includes('CN') || countries.includes('TW'))) return 'donghua';

  // 3. Variety / Reality / Talk
  if (genreIds.includes(10764) || genreIds.includes(10767) || genreIds.includes(10763)) return 'variety';

  // 4. Cultural Dramas (TV)
  if (countries.includes('KR')) return 'drakor';
  if (countries.includes('CN') || countries.includes('TW')) return 'drachin';
  if (countries.includes('TH')) return 'drathai';
  if (countries.includes('JP')) return 'drajep';

  return 'tv';
}

/**
 * Classify a content item into a streaming platform based on TMDB metadata.
 */
export function classifyPlatform(metadata: TMDBMetadata | null, contentType: string): Platform {
  if (!metadata) return 'other';

  const networkIds = (metadata.networks || []).map(n => n.id);
  const companyIds = (metadata.production_companies || []).map(c => c.id);
  const allIds = [...networkIds, ...companyIds];
  const genreIds = (metadata.genres || []).map(g => g.id);
  const originCountry = metadata.origin_country || [];

  const matches = (targets: number[]) => allIds.some(id => targets.includes(id));

  // Anime check
  if (contentType === 'anime' || (genreIds.includes(16) && originCountry.includes('JP')) || networkIds.some(id => TMDB_NETWORKS.ANIME.includes(id))) {
    return 'anime';
  }

  if (matches(TMDB_NETWORKS.NETFLIX) || companyIds.some(id => TMDB_COMPANIES.NETFLIX.includes(id))) return 'netflix';
  if (matches(TMDB_NETWORKS.DISNEY) || companyIds.some(id => TMDB_COMPANIES.DISNEY.includes(id))) return 'disney';
  if (matches(TMDB_NETWORKS.AMAZON) || companyIds.some(id => TMDB_COMPANIES.AMAZON.includes(id))) return 'amazon';
  if (matches(TMDB_NETWORKS.APPLE) || companyIds.some(id => TMDB_COMPANIES.APPLE.includes(id))) return 'apple';
  if (matches(TMDB_NETWORKS.HBO) || companyIds.some(id => TMDB_COMPANIES.HBO.includes(id))) return 'hbo';
  if (matches(TMDB_NETWORKS.PARAMOUNT) || companyIds.some(id => TMDB_COMPANIES.PARAMOUNT.includes(id))) return 'paramount';

  return 'other';
}

/** Human-readable platform labels */
export const PLATFORM_LABELS: Record<Platform, string> = {
  netflix: 'Netflix Originals',
  disney: 'Disney+',
  amazon: 'Amazon Prime Video',
  apple: 'Apple TV+',
  hbo: 'HBO / Max',
  paramount: 'Paramount+',
  anime: 'Anime & Animasi',
  other: 'Film & Series Lainnya',
};

/** Platform brand colors for badges/accents */
export const PLATFORM_COLORS: Record<Platform, string> = {
  netflix: '#E50914',
  disney: '#113CCF',
  amazon: '#00A8E1',
  apple: '#A3AAAE',
  hbo: '#B01CD2',
  paramount: '#0064FF',
  anime: '#FF6740',
  other: '#888888',
};

/** Network configurations for UI display */
export const NETWORK_CONFIGS = [
  { slug: 'netflix', name: 'Netflix', color: '#E50914', bgGradient: 'from-red-900/80 to-black', description: 'Film & Series Original dari Netflix' },
  { slug: 'disney', name: 'Disney+', color: '#113CCF', bgGradient: 'from-blue-900/80 to-black', description: 'Konten Eksklusif Disney, Marvel, Star Wars & Pixar' },
  { slug: 'amazon', name: 'Prime Video', color: '#00A8E1', bgGradient: 'from-cyan-900/80 to-black', description: 'Amazon Original Series & Film' },
  { slug: 'apple', name: 'Apple TV+', color: '#A3AAAE', bgGradient: 'from-gray-700/80 to-black', description: 'Premium Original Content dari Apple' },
  { slug: 'hbo', name: 'HBO / Max', color: '#B01CD2', bgGradient: 'from-purple-900/80 to-black', description: 'HBO Original, Warner Bros & DC Universe' },
  { slug: 'paramount', name: 'Paramount+', color: '#0064FF', bgGradient: 'from-blue-800/80 to-black', description: 'Showtime, CBS & Paramount Original' },
] as const;
