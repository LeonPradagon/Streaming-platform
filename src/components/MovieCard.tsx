"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Play, Plus, Info, ThumbsUp, Star, Check } from 'lucide-react';
import { useWatchlist, useLikes } from '@/lib/useWatchlist';
import { showToast } from '@/components/Toast';

interface MovieCardProps {
  item: any;
  progress?: number; // 0 to 100
  isNew?: boolean;
}

export default function MovieCard({ item, progress, isNew }: MovieCardProps) {
  const getImageUrl = (path: string | undefined | null) => 
    path ? `https://image.tmdb.org/t/p/w500${path}` : `https://placehold.co/400x600/1a1a1a/ffffff?text=${encodeURIComponent(item.title)}`;
  
  const year = (item.metadata?.release_date || item.metadata?.first_air_date || '').split('-')[0];
  
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { isLiked, toggleLike } = useLikes();

  const router = useRouter();
  const inList = isInWatchlist(String(item.id));
  const liked = isLiked(String(item.id));

  const handleNavigate = (e: React.MouseEvent) => {
    router.push(`/watch/${item.id}`);
  };

  const handleAddToList = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleWatchlist({
      id: String(item.id),
      title: item.title,
      type: item.type,
      poster_path: item.metadata?.poster_path,
      vote_average: item.metadata?.vote_average,
      release_date: item.metadata?.release_date,
      first_air_date: item.metadata?.first_air_date,
      addedAt: Date.now(),
    });
    showToast(added ? `"${item.title}" ditambahkan ke Daftar!` : `"${item.title}" dihapus dari Daftar`, added ? 'success' : 'info');
  };

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nowLiked = toggleLike(String(item.id));
    showToast(nowLiked ? `Menyukai "${item.title}"` : `Batal menyukai "${item.title}"`, nowLiked ? 'success' : 'info');
  };

  return (
    <div 
      className="relative group w-full cursor-pointer flex-shrink-0 transition-transform duration-500 hover:z-50 hover:scale-105"
      onClick={handleNavigate}
    >
      <div className="relative w-full aspect-[2/3] rounded-md md:rounded-lg overflow-hidden bg-card border border-white/5">
        <img 
          src={getImageUrl(item.metadata?.poster_path)} 
          alt={item.title}
          className="w-full h-full object-cover text-[10px] text-gray-500"
          loading="lazy"
        />
        
        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-20">
          {isNew && (
            <span className="bg-green-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase">
              Baru
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2 z-20">
           <span className="bg-primary text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-lg">
             HD
           </span>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 z-10">
          <h3 className="text-white font-bold text-sm line-clamp-2 drop-shadow-md">{item.title}</h3>
          
          <div className="flex items-center gap-2 mt-1 mb-2 text-xs font-semibold text-gray-300">
            <span className="flex items-center text-yellow-400">
              <Star size={12} fill="currentColor" className="mr-0.5" />
              {item.metadata?.vote_average?.toFixed(1) || 'N/A'}
            </span>
            <span>{year}</span>
            <span className="px-1 border border-gray-500 rounded text-[9px] uppercase">
              {item.type === 'tv' ? 'Series' : item.type}
            </span>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 mt-1">
            <button 
              onClick={(e) => { e.stopPropagation(); handleNavigate(e); }}
              className="bg-white text-black p-1.5 rounded-full hover:bg-gray-200 transition-colors" 
              title="Play"
            >
              <Play size={14} fill="currentColor" />
            </button>
            <button 
              onClick={handleAddToList}
              className={`p-1.5 rounded-full transition-colors border ${inList ? 'bg-primary border-primary text-white' : 'border-gray-400 text-white hover:border-white'}`} 
              title={inList ? 'Hapus dari Daftar' : 'Tambah ke Daftar'}
            >
              {inList ? <Check size={14} /> : <Plus size={14} />}
            </button>
            <button 
              onClick={handleLike}
              className={`p-1.5 rounded-full transition-colors border ${liked ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-400 text-white hover:border-white'}`} 
              title={liked ? 'Batal Suka' : 'Suka'}
            >
              <ThumbsUp size={14} />
            </button>
            <div className="flex-1"></div>
            <button 
              onClick={(e) => { e.stopPropagation(); handleNavigate(e); }}
              className="border border-gray-400 text-white p-1.5 rounded-full hover:border-white hover:text-white transition-colors" 
              title="Info"
            >
              <Info size={14} />
            </button>
          </div>
        </div>

        {/* Progress Bar (if watched) */}
        {progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700 z-20">
            <div className="h-full bg-primary" style={{ width: `${progress}%` }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
