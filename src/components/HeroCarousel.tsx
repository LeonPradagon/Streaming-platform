"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Info, Star, Calendar } from "lucide-react";
import { getTMDBImageUrl } from "@/lib/tmdb";
import { motion, AnimatePresence } from "framer-motion";

interface HeroCarouselProps {
  items: any[];
}

export default function HeroCarousel({ items }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    const timer = setInterval(nextSlide, 8000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex];
  // Data fallback logic
  const meta = currentItem.metadata || currentItem;
  const backdropUrl = getTMDBImageUrl(meta.backdrop_path || meta.poster_path, "original");
  const year = (meta.release_date || "").split("-")[0];
  const rating = meta.vote_average ? meta.vote_average.toFixed(1) : "0.0";

  return (
    <div className="relative w-full h-[85vh] md:h-[90vh] overflow-hidden bg-black">
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Zooming Background */}
          <motion.div 
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 10, ease: "linear" }}
            className="absolute inset-0"
          >
            <Image
              src={backdropUrl}
              alt={meta.title || "Background"}
              fill
              priority
              className="object-cover opacity-60"
            />
          </motion.div>

          {/* Heavy Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/10 to-transparent z-10" />

          {/* Content */}
          <div className="absolute inset-0 flex items-center px-6 md:px-16 lg:px-24 z-20">
            <div className="max-w-4xl pt-20 md:pt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6"
              >
                <div className="flex items-center gap-1.5 text-yellow-500 bg-yellow-500/10 px-2 md:px-3 py-1 rounded-full border border-yellow-500/20 font-black text-xs md:text-sm">
                  <Star size={14} fill="currentColor" />
                  {rating}
                </div>
                {year && (
                  <div className="flex items-center gap-1.5 text-gray-400 font-bold text-xs md:text-sm">
                    <Calendar size={14} />
                    {year}
                  </div>
                )}
                <div className="bg-red-600 text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-lg">
                  TRENDING NOW
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, type: "spring" }}
                className="text-4xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter leading-[0.9] mb-4 md:mb-6 uppercase"
              >
                {meta.title}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="text-gray-300 text-xs md:text-lg max-w-2xl line-clamp-3 md:line-clamp-4 font-medium opacity-80 mb-6 md:mb-10 leading-relaxed"
              >
                {meta.overview}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5 }}
                className="flex flex-wrap items-center gap-3 md:gap-4 mb-8"
              >
                <Link
                  href={`/watch/${currentItem.id}?type=${currentItem.type !== 'movie' ? 'tv' : 'movie'}`}
                  className="bg-white text-black px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3 font-black text-sm md:text-base transition-all hover:bg-red-600 hover:text-white active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] group"
                >
                  <Play fill="currentColor" size={18} className="md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
                  WATCH NOW
                </Link>
                <Link
                  href={`/watch/${currentItem.id}?type=${currentItem.type !== 'movie' ? 'tv' : 'movie'}`}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 text-white px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3 font-black text-sm md:text-base transition-all hover:bg-white/10 active:scale-95"
                >
                  <Info size={18} className="md:w-5 md:h-5" />
                  DETAILS
                </Link>
              </motion.div>

              {/* Modern Pagination Dots (Now inside content flow) */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-2"
              >
                {items.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setDirection(index > currentIndex ? 1 : -1);
                      setCurrentIndex(index);
                    }}
                    className={`h-1 rounded-full transition-all duration-700 ${
                      index === currentIndex ? "w-10 md:w-12 bg-red-600 shadow-[0_0_15px_rgba(229,9,20,0.5)]" : "w-3 md:w-4 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
