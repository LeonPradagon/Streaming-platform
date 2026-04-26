"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Play, Star, ChevronLeft, ChevronRight, Info } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { getTMDBImageUrl } from "@/lib/tmdb";

interface HeroCarouselProps {
  items: any[];
}

export default function HeroCarousel({ items }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!items || items.length === 0) return;

    // Fast interval
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [items]);

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex];

  const backdropUrl = getTMDBImageUrl(
    currentItem.metadata?.backdrop_path || currentItem.metadata?.poster_path,
    "w1280",
  );

  const rating = currentItem.metadata?.vote_average
    ? currentItem.metadata.vote_average.toFixed(1)
    : null;

  return (
    <section className="relative w-full h-[60vh] md:h-[75vh] lg:h-[85vh] flex items-end overflow-hidden bg-[#0f0f0f] pb-20 md:pb-24 group">
      {/* Background Poster */}
      {backdropUrl && (
        <Image
          src={backdropUrl}
          alt={currentItem.title}
          fill
          priority
          className="absolute inset-0 w-full h-full object-cover object-top opacity-70 scale-105 animate-slow-zoom"
        />
      )}

      {/* Modern IDLIX style heavy gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/60 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-[#0f0f0f]/20 to-transparent z-10" />

      {/* Content Positioned Bottom Left */}
      <div className="relative z-30 px-6 md:px-12 lg:px-20 w-full lg:w-[70%] pb-10 md:pb-16">
        <div
          className="flex flex-col items-start gap-3 animate-slide-up"
          key={currentItem.id}
        >
          {/* Badge */}
          <div className="flex items-center gap-2">
            <span className="bg-red-600 text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-lg">
              {currentItem.type === "tv" ? "TV Series" : "Movie"}
            </span>
            <span className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest">
              Trending #1
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-8xl font-black text-white leading-[0.9] mb-4 drop-shadow-2xl uppercase tracking-tighter font-sans italic [text-stroke:1px_rgba(255,255,255,0.1)]">
            {currentItem.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm md:text-base text-white/80 font-bold mb-4 drop-shadow-md">
            {rating && (
              <span className="flex items-center text-[#F5C518] bg-black/40 backdrop-blur-md px-2 py-0.5 rounded border border-white/5">
                <Star size={16} fill="currentColor" className="mr-1.5" /> {rating}
              </span>
            )}
            <span className="bg-white/10 backdrop-blur-md px-2 py-0.5 rounded border border-white/5">
              {
                (
                  currentItem.metadata?.release_date ||
                  currentItem.metadata?.first_air_date ||
                  ""
                ).split("-")[0]
              }
            </span>
            <span className="text-green-500 font-black tracking-widest">4K ULTRA HD</span>
          </div>

          <p className="text-sm md:text-lg text-gray-300 mb-8 max-w-2xl line-clamp-3 leading-relaxed drop-shadow-md font-medium text-pretty">
            {currentItem.metadata?.overview ||
              "Streaming the best movies and TV shows with premium quality and Indonesian subtitles."}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/watch/${currentItem.id}`}
              className="group/btn flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full hover:bg-red-600 hover:text-white transition-all duration-300 font-black text-base md:text-lg shadow-[0_10px_30px_rgba(0,0,0,0.5)] active:scale-95"
            >
              <div className="w-8 h-8 rounded-full bg-black group-hover/btn:bg-white flex items-center justify-center transition-colors">
                <Play size={18} fill="currentColor" className="ml-1 text-white group-hover/btn:text-red-600" />
              </div>
              WATCH NOW
            </Link>
            
            <button className="flex items-center gap-3 bg-white/10 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-full hover:bg-white/20 transition-all duration-300 font-black text-base md:text-lg shadow-xl">
              <Info size={22} /> MORE INFO
            </button>
          </div>

          {/* Indicators */}
          <div className="flex items-center gap-2 mt-6">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className="relative h-1.5 rounded-full overflow-hidden bg-white/20 hover:bg-white/40 transition-all duration-500"
                style={{ width: idx === currentIndex ? "40px" : "8px" }}
              >
                {idx === currentIndex && (
                  <motion.div 
                    key={`indicator-${currentIndex}`}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="absolute inset-y-0 left-0 bg-[#E50914]"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Preload Next/Prev Images via link tags (no hidden img downloads) */}
      {items.map((item, idx) => {
        const isNext = idx === (currentIndex + 1) % items.length;
        const isPrev = idx === (currentIndex - 1 + items.length) % items.length;
        if (isNext || isPrev) {
          const preloadUrl = getTMDBImageUrl(
            item.metadata?.backdrop_path || item.metadata?.poster_path || "",
            "w1280",
          );
          return <link key={idx} rel="prefetch" href={preloadUrl} as="image" />;
        }
        return null;
      })}
    </section>
  );
}
