/**
 * Shared TMDB Utilities & Classification Logic
 */

export interface TMDBMetadata {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  genres: { id: number; name: string }[];
  credits?: { cast: { id: number; name: string; character: string; profile_path: string | null }[] };
  networks?: { id: number; name: string; logo_path?: string }[];
  production_companies?: { id: number; name: string; logo_path?: string; origin_country?: string }[];
  origin_country?: string[];
}

export type Platform = 'netflix' | 'disney' | 'amazon' | 'apple' | 'hbo' | 'paramount' | 'anime' | 'other';

/**
 * Enhanced Content Types for Streaming Platforms
 * movie: Standalone films
 * tv: General Western/Global TV shows
 * anime: Japanese Animation
 * drakor: Korean Drama
 * drachin: Chinese Drama
 * donghua: Chinese Animation
 * variety: Variety/Reality Shows
 * drathai: Thailand Drama
 * drajep: Japanese Drama (Live Action)
 */
export type ContentType = 'movie' | 'tv' | 'anime' | 'drakor' | 'drachin' | 'donghua' | 'variety' | 'drathai' | 'drajep';

// TMDB IDs Constants
export const TMDB_NETWORKS = {
  NETFLIX: [213],
  DISNEY: [2739, 3353],
  AMAZON: [1024, 4353],
  APPLE: [2552],
  HBO: [49, 3186, 2832],
  PARAMOUNT: [4330, 2076],
  ANIME: [614, 98, 210, 1112, 269, 174, 100, 1376, 171, 167, 68, 530, 2064]
};

export const TMDB_COMPANIES = {
  NETFLIX: [213534, 157436],
  DISNEY: [2, 3166, 6125, 420, 16211],
  AMAZON: [9353, 20580],
  APPLE: [164461, 138382],
  HBO: [3268, 174652, 12, 76043],
  PARAMOUNT: [4, 21]
};

/**
 * Classify content into a specific cultural/genre type
 */
export function classifyContentType(metadata: TMDBMetadata | null, tmdbType: 'movie' | 'tv'): ContentType {
  if (!metadata) return tmdbType === 'movie' ? 'movie' : 'tv';
  
  // If it's a movie, we generally keep it as 'movie' to avoid logic break
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
 * Classify a content item into a streaming platform
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

export const PLATFORM_LABELS: Record<Platform, string> = {
  netflix: 'Netflix Originals',
  disney: 'Disney+',
  amazon: 'Amazon Prime Video',
  apple: 'Apple TV+',
  hbo: 'HBO / Max',
  paramount: 'Paramount+',
  anime: 'Anime & Animasi',
  other: 'Lainnya',
};

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
