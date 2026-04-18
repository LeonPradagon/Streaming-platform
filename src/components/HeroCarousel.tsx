"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Plus, Info, Star, Calendar, Clock, TrendingUp, Check } from 'lucide-react';
import { useWatchlist } from '@/lib/useWatchlist';
import { showToast } from '@/components/Toast';

interface HeroCarouselProps {
  items: any[];
}

export default function HeroCarousel({ items }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { isInWatchlist, toggleWatchlist } = useWatchlist();

  useEffect(() => {
    if (!items || items.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [items]);

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex];
  const getImageUrl = (path: string | undefined | null) => path ? `https://image.tmdb.org/t/p/original${path}` : null;
  const inList = isInWatchlist(String(currentItem.id));

  const handleAddToList = () => {
    const added = toggleWatchlist({
      id: String(currentItem.id),
      title: currentItem.title,
      type: currentItem.type,
      poster_path: currentItem.metadata?.poster_path,
      vote_average: currentItem.metadata?.vote_average,
      release_date: currentItem.metadata?.release_date,
      first_air_date: currentItem.metadata?.first_air_date,
      addedAt: Date.now(),
    });
    showToast(
      added ? `"${currentItem.title}" ditambahkan ke Daftar!` : `"${currentItem.title}" dihapus dari Daftar`, 
      added ? 'success' : 'info'
    );
  };

  return (
    <section className="relative w-full h-[85vh] md:h-[90vh] flex items-center overflow-hidden">
      {/* Background Slides */}
      {items.map((item, idx) => (
        <div 
          key={item.id} 
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {getImageUrl(item.metadata?.backdrop_path || item.metadata?.poster_path) && (
            <img 
              src={getImageUrl(item.metadata?.backdrop_path || item.metadata?.poster_path)!} 
              alt={item.title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10" />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-20 px-6 md:px-12 lg:px-20 max-w-4xl pt-20">
        <div key={currentItem.id} className="animate-fade-in">
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-sm mb-4 uppercase drop-shadow-md">
            <TrendingUp size={16} /> 
            Trending #{currentIndex + 1}
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-4 drop-shadow-2xl">
            {currentItem.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm md:text-base text-gray-300 font-semibold mb-6">
            <div className="flex items-center gap-1 text-yellow-400">
              <Star size={16} fill="currentColor" />
              <span>{currentItem.metadata?.vote_average?.toFixed(1) || 'N/A'}</span>
            </div>
            <span>|</span>
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>
                {(currentItem.metadata?.release_date || currentItem.metadata?.first_air_date || '').split('-')[0]}
              </span>
            </div>
            <span>|</span>
            <div className="flex items-center gap-1">
              <Clock size={16} />
              <span className="uppercase">{currentItem.type === 'tv' ? 'Series' : currentItem.type}</span>
            </div>
            <div className="px-2 py-0.5 border border-gray-500 rounded text-xs font-bold text-gray-400">
              HD
            </div>
          </div>

          <p className="text-base md:text-lg text-gray-300 mb-8 max-w-2xl line-clamp-3 leading-relaxed drop-shadow-lg">
            {currentItem.metadata?.overview || "Tidak ada deskripsi tersedia untuk judul ini."}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link 
              href={`/watch/${currentItem.id}`} 
              className="flex items-center gap-2 bg-primary text-white px-6 md:px-8 py-3 md:py-4 rounded-lg font-bold text-base md:text-lg hover:brightness-110 hover:scale-105 transition-all shadow-lg shadow-primary-glow"
            >
              <Play size={20} fill="currentColor" /> Tonton Sekarang
            </Link>
            <button 
              onClick={handleAddToList}
              className={`flex items-center gap-2 backdrop-blur-md border px-6 py-3 md:py-4 rounded-lg font-bold text-base md:text-lg hover:scale-105 transition-all ${
                inList 
                  ? 'bg-primary/30 border-primary text-white' 
                  : 'bg-white/20 border-white/30 text-white hover:bg-white/30'
              }`}
            >
              {inList ? <Check size={20} /> : <Plus size={20} />} 
              {inList ? 'Dalam Daftar' : 'Daftar Saya'}
            </button>
            <Link 
              href={`/watch/${currentItem.id}`}
              className="hidden md:flex items-center justify-center bg-white/10 backdrop-blur-md text-white border border-white/20 w-14 h-14 rounded-full hover:bg-white/20 transition-all group"
            >
              <Info size={24} className="group-hover:scale-110 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* Carousel Dots */}
      <div className="absolute bottom-10 right-6 md:right-12 lg:right-20 z-30 flex gap-2">
        {items.map((_, idx) => (
          <button 
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`transition-all duration-300 rounded-full ${
              idx === currentIndex ? 'w-8 h-2 bg-primary shadow-[0_0_10px_rgba(229,9,20,0.8)]' : 'w-2 h-2 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
