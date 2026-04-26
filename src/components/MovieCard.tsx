"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Star, Info } from "lucide-react";
import { getTMDBImageUrl } from "@/lib/tmdb";
import { motion } from "framer-motion";

interface MovieCardProps {
  item: any;
}

export default function MovieCard({ item }: MovieCardProps) {
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
      <Link href={`/watch/${id}?type=${type}`} className="block">
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

          {/* Play Icon Overlay (Modern 2025) */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              whileHover={{ scale: 1, opacity: 1 }}
              className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(229,9,20,0.6)]"
            >
              <Play size={24} fill="white" className="text-white ml-1" />
            </motion.div>
          </div>

          {/* Top Badges */}
          <div className="absolute top-3 left-3 z-30 flex flex-col gap-2">
            {isTV && (
              <div className={`backdrop-blur-xl border px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white shadow-2xl ${
                isOngoing 
                  ? 'bg-emerald-600/40 border-emerald-500/30 text-emerald-400' 
                  : 'bg-indigo-600/40 border-indigo-500/30 text-indigo-400'
              }`}>
                {isOngoing ? 'Ongoing' : 'Tamat'}
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
