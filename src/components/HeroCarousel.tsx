"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Play, Star } from "lucide-react";

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
  // prefer backdrop, fallback to poster
  const getImageUrl = (path: string | undefined | null) =>
    path ? `https://image.tmdb.org/t/p/original${path}` : null;
  const rating = currentItem.metadata?.vote_average
    ? currentItem.metadata.vote_average.toFixed(1)
    : null;

  return (
    <section className="relative w-full h-[55vh] md:h-[65vh] lg:h-[75vh] flex items-end overflow-hidden bg-[#0f0f0f] pb-6 md:pb-8 ">
      {/* Background Poster */}
      {getImageUrl(
        currentItem.metadata?.backdrop_path ||
          currentItem.metadata?.poster_path,
      ) && (
        <img
          src={
            getImageUrl(
              currentItem.metadata?.backdrop_path ||
                currentItem.metadata?.poster_path,
            )!
          }
          alt={currentItem.title}
          className="absolute inset-0 w-full h-full object-cover object-top opacity-60"
        />
      )}

      {/* IDLIX style heavy gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/80 to-transparent" />

      {/* Content Positioned Bottom Left */}
      <div className="relative z-20 px-4 md:px-8 lg:px-12 w-full lg:w-[60%]">
        <div
          className="flex flex-col items-start gap-2 animate-fadeIn transition-opacity duration-500"
          key={currentItem.id}
        >
          {/* Badge */}
          <div className="text-[#E50914] text-[10px] md:text-xs font-bold uppercase tracking-wider drop-shadow-md">
            {currentItem.type === "tv" ? "Series" : "Movie"}
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-2 drop-shadow-lg uppercase tracking-wider font-sans">
            {currentItem.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-gray-400 font-medium mb-3">
            {rating && (
              <span className="flex items-center text-[#F5C518]">
                <Star size={14} fill="currentColor" className="mr-1" /> {rating}
              </span>
            )}
            <span>
              {
                (
                  currentItem.metadata?.release_date ||
                  currentItem.metadata?.first_air_date ||
                  ""
                ).split("-")[0]
              }
            </span>
            <div className="text-green-500 font-bold text-[10px] uppercase">
              HD
            </div>
            {currentItem.metadata?.runtime && (
              <span>
                {Math.floor(currentItem.metadata.runtime / 60)}h{" "}
                {currentItem.metadata.runtime % 60}m
              </span>
            )}
          </div>

          <p className="text-xs md:text-sm text-gray-300 mb-6 max-w-xl line-clamp-3 leading-relaxed drop-shadow-md">
            {currentItem.metadata?.overview ||
              "Streaming the best movies and TV shows."}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/watch/${currentItem.id}`}
              className="flex items-center gap-2 bg-gradient-to-br from-[#E50914] to-[#b81d24] text-white px-6 py-2.5 rounded hover:from-[#f40612] hover:to-[#e50914] transition-all font-bold text-sm md:text-base border border-red-500/50 hover:shadow-[0_4px_15px_rgba(229,9,20,0.6)] active:scale-95"
            >
              <Play size={16} fill="currentColor" /> Watch Now
            </Link>
          </div>
          {/* Tiny dots indicator typical in sliders */}
          <div className="flex items-center gap-2 mt-6">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all duration-300 h-1.5 rounded-full ${
                  idx === currentIndex
                    ? "w-6 bg-[#E50914]"
                    : "w-1.5 bg-gray-500 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
