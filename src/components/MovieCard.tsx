import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { getTMDBImageUrl } from '@/lib/tmdb';

interface MovieCardProps {
  item: any;
  isNew?: boolean;
  progress?: number;
  rank?: number; // For the top 10 numbers
}

export default function MovieCard({ item, isNew, progress, rank }: MovieCardProps) {
  const posterPath = getTMDBImageUrl(item.poster_path, 'w500');

  // Format rating (e.g., 8.5)
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const isTV = item.type ? item.type !== 'movie' : Boolean(item.name);
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || '').split('-')[0];

  return (
    <div className="flex flex-col w-full group relative">
      <Link href={`/watch/${item.id}?type=${isTV ? 'tv' : 'movie'}`} className="block relative w-full aspect-[2/3] rounded-3xl overflow-hidden bg-[#1a1a1a] shadow-sm border border-transparent transition-all duration-300 group-hover:border-white/30">
        
        {/* Ranked Number */}
        {rank !== undefined && (
          <div className="absolute top-0 left-0.5 z-20 font-black text-3xl md:text-4xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] opacity-95 tracking-tighter" style={{ WebkitTextStroke: '1px black' }}>
            {rank}
          </div>
        )}

        {/* Hover overlay subtle dark */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Top Right Box - Quality & Season Badges */}
        <div className="absolute top-1 right-1.5 flex flex-col items-end gap-1 z-10">
          <div className="text-green-400 text-[8px] md:text-[10px] font-black tracking-widest uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
            {item.quality || 'HD'}
          </div>
          {isTV && item.seasonsCount > 0 && (
            <div className="bg-[#E50914]/90 text-white px-1 py-[1px] rounded-[3px] text-[8px] md:text-[9px] font-bold tracking-wider drop-shadow-md border border-white/20">
              S{item.seasonsCount}
            </div>
          )}
        </div>

        <Image
          src={posterPath}
          alt={title || 'Movie Thumbnail'}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 15vw"
          className="object-cover transition-transform duration-300 group-hover:scale-110 lazy-image opacity-90 group-hover:opacity-100"
          loading="lazy"
        />

        {/* Bottom Left Box - Rating Badge */}
        {rating && (
          <div className="absolute bottom-1 left-1.5 text-[#F5C518] text-[9px] md:text-[11px] font-black z-10 flex items-center gap-0.5 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
            <Star size={10} fill="currentColor" strokeWidth={0.5} className="drop-shadow-md" />
            {rating}
          </div>
        )}

        {/* Bottom Progress Bar */}
        {progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 truncate z-20">
            <div className="h-full bg-[#E50914]" style={{ width: `${progress}%` }} />
          </div>
        )}
      </Link>

      {/* Info below the poster */}
      <div className="mt-1.5 px-0.5 flex flex-col">
        <Link 
          href={`/watch/${item.id}?type=${isTV ? 'tv' : 'movie'}`} 
          className="text-white/90 font-semibold text-[10px] md:text-[12px] leading-tight line-clamp-1 group-hover:text-white transition-colors"
          title={title}
        >
          {title}
        </Link>
        <div className="text-gray-500 text-[9px] md:text-[10px] font-bold flex items-center gap-1 mt-0.5 uppercase tracking-wide">
          <span className="text-[#E50914]">{isTV ? 'TV' : 'Movie'}</span>
          {year && (
            <>
              <span className="text-gray-700">•</span>
              <span>{year}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
