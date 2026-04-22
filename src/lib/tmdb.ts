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
    const response = await fetch(`${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`);
    
    if (!response.ok) {
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
    const response = await fetch(`${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`);
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
export const getTMDBImageUrl = (path: string, size: 'w500' | 'original' = 'w500') => {
  if (!path) return '/placeholder-poster.png';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

// ============================================================
// Platform Classification
// ============================================================

export type Platform = 'netflix' | 'disney' | 'amazon' | 'apple' | 'hbo' | 'paramount' | 'anime' | 'other';

// TMDB Network IDs
const NETFLIX_NETWORKS = [213];
const DISNEY_NETWORKS = [2739, 3353]; // Disney+, Disney Channel
const AMAZON_NETWORKS = [1024, 4353]; // Amazon Prime Video, Amazon Studios
const APPLE_NETWORKS = [2552]; // Apple TV+
const HBO_NETWORKS = [49, 3186, 2832]; // HBO, HBO Max, Max
const PARAMOUNT_NETWORKS = [4330, 2076]; // Paramount+, Paramount Network
const ANIME_NETWORKS = [
  614, 98, 210, 1112, 269, 174, 100, 
  // Tokyo MX, TV Tokyo, Fuji TV, Crunchyroll, Funimation, AT-X, Nippon TV
  1376, 171, 167, 68, 530, 2064, 
  // Animax, TBS, Bilibili, NHK, NTV, HIDIVE
];

// TMDB Production Company IDs
const NETFLIX_COMPANIES = [213534, 157436]; // Netflix, Netflix Animation
const DISNEY_COMPANIES = [2, 3166, 6125, 420, 16211]; // Walt Disney, Disney+, Walt Disney Animation, Marvel, Pixar
const AMAZON_COMPANIES = [9353, 20580]; // Amazon Studios, Amazon Prime Video
const APPLE_COMPANIES = [164461, 138382]; // Apple TV+, Apple Studios
const HBO_COMPANIES = [3268, 174652, 12, 76043]; // HBO Films, HBO Max, Warner Bros, Warner Bros Discovery
const PARAMOUNT_COMPANIES = [4, 21]; // Paramount Pictures, Paramount

function matchesIds(ids: number[], targets: number[]): boolean {
  return ids.some(id => targets.includes(id));
}

/**
 * Classify a content item into a streaming platform based on TMDB metadata.
 * Uses networks (TV) and production_companies (movies) for classification.
 */
export function classifyPlatform(metadata: TMDBMetadata | null, contentType: string): Platform {
  if (!metadata) return 'other';

  const networkIds = (metadata.networks || []).map(n => n.id);
  const companyIds = (metadata.production_companies || []).map(c => c.id);
  const allIds = [...networkIds, ...companyIds];
  const genreIds = (metadata.genres || []).map(g => g.id);
  const originCountry = metadata.origin_country || [];

  // Check Anime first (Japanese animation)
  const isJapaneseAnimation = (
    contentType === 'anime' ||
    (genreIds.includes(16) && originCountry.includes('JP')) ||
    matchesIds(networkIds, ANIME_NETWORKS)
  );
  if (isJapaneseAnimation) return 'anime';

  // Platform matching (order: most specific first)
  if (matchesIds(allIds, NETFLIX_NETWORKS) || matchesIds(companyIds, NETFLIX_COMPANIES)) return 'netflix';
  if (matchesIds(allIds, DISNEY_NETWORKS) || matchesIds(companyIds, DISNEY_COMPANIES)) return 'disney';
  if (matchesIds(allIds, AMAZON_NETWORKS) || matchesIds(companyIds, AMAZON_COMPANIES)) return 'amazon';
  if (matchesIds(allIds, APPLE_NETWORKS) || matchesIds(companyIds, APPLE_COMPANIES)) return 'apple';
  if (matchesIds(allIds, HBO_NETWORKS) || matchesIds(companyIds, HBO_COMPANIES)) return 'hbo';
  if (matchesIds(allIds, PARAMOUNT_NETWORKS) || matchesIds(companyIds, PARAMOUNT_COMPANIES)) return 'paramount';

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
