"use client";

import { Plus, ThumbsUp, Share2, Check } from 'lucide-react';
import { useWatchlist, useLikes, useHistory } from '@/lib/useWatchlist';
import { showToast } from '@/components/Toast';
import { useEffect } from 'react';

interface WatchActionsProps {
  item: {
    id: string;
    title: string;
    type: string;
    poster_path?: string;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
  };
}

export default function WatchActions({ item }: WatchActionsProps) {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { isLiked, toggleLike } = useLikes();
  const { addToHistory } = useHistory();

  const inList = isInWatchlist(item.id);
  const liked = isLiked(item.id);

  // Record to watch history on mount
  useEffect(() => {
    addToHistory({
      id: item.id,
      title: item.title,
      type: item.type,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      release_date: item.release_date,
      first_air_date: item.first_air_date,
      addedAt: Date.now(),
      progress: 0, // start at 0%
    });
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddToList = () => {
    const added = toggleWatchlist({
      id: item.id,
      title: item.title,
      type: item.type,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      release_date: item.release_date,
      first_air_date: item.first_air_date,
      addedAt: Date.now(),
    });
    showToast(
      added ? `"${item.title}" ditambahkan ke Daftar!` : `"${item.title}" dihapus dari Daftar`, 
      added ? 'success' : 'info'
    );
  };

  const handleLike = () => {
    const nowLiked = toggleLike(item.id);
    showToast(nowLiked ? `Menyukai "${item.title}"` : `Batal menyukai "${item.title}"`, nowLiked ? 'success' : 'info');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, url });
        showToast('Berhasil dibagikan!', 'success');
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      showToast('Link disalin ke clipboard!', 'success');
    }
  };

  return (
    <div className="flex flex-wrap gap-4 mb-8">
      <button 
        onClick={handleAddToList}
        className={`flex items-center gap-2 border hover:bg-white/20 px-4 py-2.5 rounded-lg font-bold transition ${
          inList ? 'bg-primary/20 border-primary text-primary' : 'bg-white/10 border-white/20 text-white'
        }`}
      >
        {inList ? <Check size={20} /> : <Plus size={20} />} 
        {inList ? 'Dalam Daftar' : 'Daftar Saya'}
      </button>
      <button 
        onClick={handleLike}
        className={`flex items-center gap-2 border hover:bg-white/20 px-4 py-2.5 rounded-lg font-bold transition ${
          liked ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/10 border-white/20 text-white'
        }`}
      >
        <ThumbsUp size={20} /> {liked ? 'Disukai' : 'Suka'}
      </button>
      <button 
        onClick={handleShare}
        className="flex items-center gap-2 bg-white/10 border border-white/20 hover:bg-white/20 px-4 py-2.5 rounded-lg text-white font-bold transition"
      >
        <Share2 size={20} /> Bagikan
      </button>
    </div>
  );
}
