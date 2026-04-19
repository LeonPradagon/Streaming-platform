"use client";

import { useHistory, useWatchlist } from '@/lib/useWatchlist';
import ContentRow from './ContentRow';
import { History, ListVideo } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function PersonalizedRows() {
  const { items: historyItems } = useHistory();
  const { items: watchlistItems } = useWatchlist();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Adapt local storage items to the structure expected by MovieCard
  // MovieCard expects: item.id, item.title, item.type, item.metadata.poster_path, etc.
  const adaptItem = (item: any) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    metadata: {
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      release_date: item.release_date,
      first_air_date: item.first_air_date
    },
    // We pass down progress if it exists (for history)
    progress: item.progress,
    // Add dummy metadata so missing parts don't crash
    genre_names: []
  });

  const adaptedHistory = historyItems.map(adaptItem);
  const adaptedWatchlist = watchlistItems.map(adaptItem);

  return (
    <>
      {adaptedHistory.length > 0 && (
        <ContentRow 
          title="Terus Menonton" 
          items={adaptedHistory} 
          icon={<History size={22} />} 
        />
      )}
      
      {adaptedWatchlist.length > 0 && (
        <ContentRow 
          title="Daftar Saya" 
          items={adaptedWatchlist} 
          icon={<ListVideo size={22} />} 
        />
      )}
    </>
  );
}
