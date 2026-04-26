"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import MovieCard from "./MovieCard";

interface ContentRowProps {
  title: string;
  items: any[];
  isNewRow?: boolean;
  platformColor?: string;
  icon?: ReactNode;
  isTrendingRow?: boolean; // Controls whether ranking numbers show up
  viewAllHref?: string;
}

export default function ContentRow({
  title,
  items,
  isNewRow,
  isTrendingRow,
  platformColor,
  icon,
  viewAllHref,
}: ContentRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isMoved, setIsMoved] = useState(false);

  const handleScroll = (direction: "left" | "right") => {
    setIsMoved(true);
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.8;
      rowRef.current.scrollTo({
        left:
          direction === "left"
            ? scrollLeft - scrollAmount
            : scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative group/section w-full px-4 md:px-10 lg:px-14 max-w-[2000px] mx-auto mb-10 mt-4 z-10">
      {/* Title Area - Elegant Minimal */}
      <div className="px-2 md:px-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && <div className="text-red-600 drop-shadow-[0_0_10px_rgba(229,9,20,0.5)]">{icon}</div>}
          <h2 className="text-base md:text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2 font-sans hover:text-red-500 cursor-pointer transition-colors italic">
            {title}
          </h2>
        </div>
        {/* Simple "See All" link style */}
        {viewAllHref && (
          <Link href={viewAllHref} className="text-[10px] md:text-xs font-black text-gray-500 hover:text-white transition-all hover:bg-white/5 px-4 py-2 rounded-full border border-white/5 uppercase tracking-widest flex items-center gap-2">
            View All <ChevronRight size={14} className="opacity-50" />
          </Link>
        )}
      </div>

      <div className="relative group/row">
        {/* Left Arrow */}
        <button
          className={`absolute top-0 bottom-6 left-0 from-black/80 via-black/40 to-transparent w-10 md:w-16 z-40 flex items-center justify-center transition-all duration-300 opacity-0 group-hover/row:opacity-100 ${!isMoved ? "hidden" : ""}`}
          onClick={() => handleScroll("left")}
          aria-label="Scroll left"
        >
          <div className="bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 hover:border-white/30 transition-colors shadow-lg hover:bg-white/10">
            <ChevronLeft
              className="text-white drop-shadow"
              size={32}
              strokeWidth={1.5}
            />
          </div>
        </button>

        <div
          ref={rowRef}
          className="flex lg:grid-flow-col auto-cols-max gap-3 sm:gap-4 md:gap-5 overflow-x-auto overflow-y-hidden no-scrollbar px-2 md:px-4 py-2 snap-x snap-mandatory scroll-smooth"
        >
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="w-[32vw] sm:w-[22vw] md:w-[16vw] lg:w-[12vw] xl:w-[10vw] flex-shrink-0 snap-start"
            >
              <MovieCard
                item={item}
                isNew={isNewRow && idx < 5}
                progress={undefined}
                rank={isTrendingRow ? idx + 1 : undefined}
              />
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <button
          className="absolute top-0 bottom-6 right-0 from-black/80 via-black/40 to-transparent w-10 md:w-16 z-40 flex items-center justify-center transition-all duration-300 opacity-0 group-hover/row:opacity-100"
          onClick={() => handleScroll("right")}
          aria-label="Scroll right"
        >
          <div className="bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/10 hover:border-white/30 transition-colors shadow-lg hover:bg-white/10">
            <ChevronRight
              className="text-white drop-shadow"
              size={32}
              strokeWidth={1.5}
            />
          </div>
        </button>
      </div>
    </div>
  );
}
