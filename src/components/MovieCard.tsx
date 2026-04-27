"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Star, Info } from "lucide-react";
import { getTMDBImageUrl } from "@/lib/tmdb";
import { motion } from "framer-motion";

interface MovieCardProps {
  item: any;
  progress?: number;
  isNew?: boolean;
  rank?: number;
}

export default function MovieCard({ item, progress, isNew, rank }: MovieCardProps) {
  // Safe metadata extraction
  const metadata = item.metadata || item;
  const id = item.id;
  const title = item.title || metadata.title || metadata.name;
  const posterPath = metadata.poster_path || metadata.backdrop_path;
  const rating = typeof metadata.vote_average === 'number' ? metadata.vote_average : parseFloat(metadata.vote_average || "0");
  const year = (metadata.release_date || metadata.first_air_date || "").split("-")[0];
  const type = item.type || (metadata.first_air_date ? "tv" : "movie");

  const posterUrl = getTMDBImageUrl(posterPath, "w342");
  
  // Ongoing logic
  const ongoingStatuses = ["returning series", "ongoing", "in production"];
  const isOngoing = item.tv_status && ongoingStatuses.includes(item.tv_status.toLowerCase());
  const isTV = type !== "movie";

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="group relative"
    >
      {/* Rank Number (for Trending) */}
      {rank !== undefined && (
        <div className="absolute -left-4 md:-left-8 bottom-12 md:bottom-20 z-0 opacity-20 pointer-events-none select-none">
          <span className="text-8xl md:text-[12rem] font-black italic leading-none text-transparent stroke-white stroke-2" style={{ WebkitTextStroke: "2px rgba(255,255,255,0.3)" }}>
            {rank}
          </span>
        </div>
      )}

      <Link href={`/watch/${id}?type=${type}`} className="block relative z-10">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[1.5rem] bg-white/5 border border-white/10 shadow-xl transition-all duration-500 group-hover:border-red-600/50 group-hover:shadow-red-600/20">
          {/* Poster Image */}
          <Image
            src={posterUrl}
            alt={title || "Movie Thumbnail"}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 15vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1"
            loading="lazy"
          />

          {/* Progress Bar (at the bottom of image) */}
          {progress !== undefined && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 backdrop-blur-sm z-30 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-red-600 shadow-[0_0_10px_rgba(229,9,20,0.8)]"
              />
            </div>
          )}

          {/* Play Icon Overlay (Modern 2025) */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
            <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(229,9,20,0.6)] scale-50 group-hover:scale-100 transition-transform duration-300">
              <Play size={24} fill="white" className="text-white ml-1" />
            </div>
          </div>

          {/* Top Badges */}
          <div className="absolute top-3 left-3 z-30 flex flex-col gap-2">
            {isNew && (
              <div className="bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg shadow-lg">
                NEW
              </div>
            )}
            {isTV && isOngoing && (
              <div className="backdrop-blur-xl border px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-emerald-400 shadow-2xl bg-emerald-600/40 border-emerald-500/30">
                Ongoing
              </div>
            )}
          </div>

          {/* Quality Badge */}
          <div className="absolute top-3 right-3 z-30">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white">
              {item.quality || 'HD'}
            </div>
          </div>

          {/* Bottom Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        {/* Info Area (Below Card) */}
        <div className="mt-4 space-y-1 px-1">
          <h3 className="text-sm md:text-base font-black text-white/90 line-clamp-1 group-hover:text-red-500 transition-colors uppercase tracking-tight">
            {title}
          </h3>
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
            <span className="tracking-widest">{year}</span>
            <div className="flex items-center gap-1 text-yellow-500/80">
              <Star size={10} fill="currentColor" />
              <span>{rating > 0 ? rating.toFixed(1) : "N/A"}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

