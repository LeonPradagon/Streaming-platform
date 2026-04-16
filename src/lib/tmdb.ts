/**
 * TMDB API Service
 * 
 * Digunakan untuk mengambil metadata (poster, sinopsis, rating) 
 * dari The Movie Database (TMDB).
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

export interface TMDBMetadata {
  id: number;
  title?: string;
  name?: string; // Untuk TV Series (Drakor/Anime)
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genres: { id: number; name: string }[];
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

/**
 * Get image URL from TMDB path
 */
export const getTMDBImageUrl = (path: string, size: 'w500' | 'original' = 'w500') => {
  if (!path) return '/placeholder-poster.png';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};
