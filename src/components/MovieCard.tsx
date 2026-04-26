import Image from 'next/image';
import Link from 'next/link';
import { Star, Play, Info } from 'lucide-react';
import { getTMDBImageUrl } from '@/lib/tmdb';

interface MovieCardProps {
  item: any;
  isNew?: boolean;
  progress?: number;
  rank?: number; // For the top 10 numbers
}

export default function MovieCard({ item, isNew, progress, rank }: MovieCardProps) {
  const posterPath = getTMDBImageUrl(item.poster_path, 'w342');

  // Format rating (e.g., 8.5)
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const isTV = item.type ? item.type !== 'movie' : Boolean(item.name);
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || '').split('-')[0];
  const rawStatus = item.tv_status || item.metadata?.status || '';
  const isOngoing = [
    'returning series', 
    'in production', 
    'planned', 
    'ongoing'
  ].includes(rawStatus.toLowerCase().trim());

  return (
    <div className="flex flex-col w-full group relative">
      {/* Background Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-900 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500 group-hover:duration-200" />
      
      <Link href={`/watch/${item.id}?type=${isTV ? 'tv' : 'movie'}`} className="block relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-[#1a1a1a] shadow-2xl border border-white/5 transition-all duration-500 group-hover:border-red-600/30 group-hover:scale-[1.02] z-10">
        
        {/* Ranked Number */}
        {rank !== undefined && (
          <div className="absolute -bottom-4 -left-3 z-30 font-black text-7xl md:text-8xl text-white drop-shadow-[0_10px_20px_rgba(0,0,0,1)] opacity-95 tracking-tighter italic select-none pointer-events-none [text-stroke:2px_rgba(255,255,255,0.1)]">
            {rank}
          </div>
        )}

        {/* Hover overlay subtle dark */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 z-20 flex flex-col justify-center items-center backdrop-blur-[2px]">
           <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(229,9,20,0.8)] scale-50 group-hover:scale-100 transition-transform duration-500">
             <Play size={20} fill="white" className="ml-1" />
           </div>
           <span className="text-[10px] font-black text-white mt-3 tracking-[0.2em] uppercase opacity-0 group-hover:opacity-100 transition-opacity delay-200">Watch Now</span>
        </div>

        {/* Top Right Box - Quality & Status Badges */}
        <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5 z-30">
          <div className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter backdrop-blur-md border shadow-xl ${
            item.quality === 'CAM' ? 'bg-yellow-500/90 border-yellow-400 text-black' : 'bg-black/60 border-white/10 text-white'
          }`}>
            {item.quality || 'HD'}
          </div>
          {isTV && (
            <div className="bg-red-600 text-white px-2 py-0.5 rounded-md text-[10px] font-black tracking-tighter border border-red-500/50 shadow-xl">
              {isOngoing ? 'ONGOING' : 'TAMAT'}
            </div>
          )}
        </div>

        {/* Top Left - Episode Badge for TV */}
        {isTV && item.episode_count && (
          <div className="absolute top-2.5 left-2.5 z-30">
            <div className="bg-blue-600/90 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[10px] font-black border border-blue-400/50 shadow-xl">
              EP {item.episode_count}
            </div>
          </div>
        )}

        <Image
          src={posterPath}
          alt={title || 'Movie Thumbnail'}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 15vw"
          className="object-cover transition-all duration-700 group-hover:scale-110 lazy-image opacity-95 group-hover:opacity-100 group-hover:rotate-1"
          loading="lazy"
        />

        {/* Bottom Left Box - Rating Badge */}
        {rating && (
          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xl px-2 py-1 rounded-lg text-[#F5C518] text-[11px] font-black z-30 flex items-center gap-1.5 border border-white/10 shadow-2xl">
            <Star size={12} fill="currentColor" strokeWidth={0} />
            {rating}
          </div>
        )}

        {/* Bottom Progress Bar */}
        {progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 truncate z-40">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_10px_rgba(229,9,20,0.8)]" style={{ width: `${progress}%` }} />
          </div>
        )}
      </Link>

      {/* Info below the poster */}
      <div className="mt-3.5 px-1 flex flex-col gap-1 transition-transform duration-300 group-hover:translate-x-1">
        <Link 
          href={`/watch/${item.id}?type=${isTV ? 'tv' : 'movie'}`} 
          className="text-white font-black text-[12px] md:text-[14px] leading-tight line-clamp-1 group-hover:text-red-500 transition-colors uppercase tracking-tight"
          title={title}
        >
          {title}
        </Link>
        <div className="text-gray-500 text-[10px] font-bold flex items-center gap-2 uppercase tracking-[0.1em]">
          <span className={isTV ? "text-blue-500" : "text-green-500"}>{isTV ? 'TV SERIES' : 'MOVIE'}</span>
          {year && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-800" />
              <span>{year}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
