"use client";

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon } from 'lucide-react';
import MovieCard from './MovieCard';

interface ContentRowProps {
  title: string;
  items: any[];
  isNewRow?: boolean;
  platformColor?: string; // Brand accent color for the section
}

export default function ContentRow({ title, items, isNewRow, platformColor }: ContentRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isMoved, setIsMoved] = useState(false);

  const handleScroll = (direction: 'left' | 'right') => {
    setIsMoved(true);
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75;
      
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2 md:space-y-4 px-4 md:px-12 lg:px-20 relative group">
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-white transition hover:text-white/80 cursor-pointer flex items-center gap-3">
          {/* Platform color dot indicator */}
          {platformColor && (
            <span 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-lg" 
              style={{ backgroundColor: platformColor, boxShadow: `0 0 8px ${platformColor}60` }}
            />
          )}
          {title}
          <ChevronRightIcon size={20} className="text-primary hidden group-hover:block transition-all opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0" />
        </h2>
        
        <Link href="/browse" className="hidden md:flex items-center text-sm font-semibold text-gray-400 hover:text-white transition-colors">
          Lihat Semua
        </Link>
      </div>

      <div className="relative group/row">
        {/* Left Arrow */}
        <button 
          className={`absolute top-0 bottom-0 left-0 bg-black/50 hover:bg-black/80 w-10 md:w-16 z-40 flex items-center justify-center transition-all duration-300 opacity-0 ${isMoved ? 'group-hover/row:opacity-100' : 'hidden'}`}
          onClick={() => handleScroll('left')}
        >
          <ChevronLeft className="text-white hover:scale-125 transition-transform" size={32} />
        </button>

        {/* Scroll Container */}
        <div 
          ref={rowRef}
          className="flex items-center gap-3 md:gap-4 overflow-x-scroll no-scrollbar scroll-smooth py-4"
        >
          {items.map((item, idx) => (
            <div key={item.id} className="w-32 md:w-40 lg:w-48 flex-shrink-0">
              <MovieCard 
                item={item} 
                isNew={isNewRow && idx < 5} 
                progress={undefined} 
              />
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <button 
          className="absolute top-0 bottom-0 right-0 bg-black/50 hover:bg-black/80 w-10 md:w-16 z-40 flex items-center justify-center transition-all duration-300 opacity-0 group-hover/row:opacity-100"
          onClick={() => handleScroll('right')}
        >
          <ChevronRight className="text-white hover:scale-125 transition-transform" size={32} />
        </button>
      </div>
    </div>
  );
}
