"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertCircle, RefreshCcw, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface VideoPlayerProps {
  src: string;
  title: string;
  backdrop?: string;
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  nextEpisodeUrl?: string;
}

export default function VideoPlayer({
  src,
  title,
  backdrop,
  tmdbId,
  mediaType,
  season,
  episode,
  nextEpisodeUrl,
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [subtitle, setSubtitle] = useState<{
    url: string;
    language: string;
  } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const [showSubtitleToast, setShowSubtitleToast] = useState(false);

  // Reset loading when source changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setKey((prev) => prev + 1);
  }, [src]);

  // --- AD BLOCKING LOGIC (Invisible) ---
  useEffect(() => {
    const originalOpen = window.open;
    // @ts-ignore
    window.open = function (...args) {
      console.log("[Anti-Ad] Blocked window.open:", args);
      return null;
    };

    const handleBlur = () => {
      setTimeout(() => {
        window.focus();
        if (document.fullscreenElement) {
          (document.fullscreenElement as HTMLElement).focus();
        }
      }, 100);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Guard against ad redirects
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // @ts-ignore
      window.open = originalOpen;
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleReload = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setKey((prev) => prev + 1);
  }, []);

  // Timeout to detect "stuck" loading
  useEffect(() => {
    if (!isLoading) return;

    // After 8 seconds, force-show the iframe even if onLoad hasn't fired
    // (many embed providers don't trigger onLoad correctly)
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 8000);

    // After 30 seconds, show the error state
    const errorTimer = setTimeout(() => {
      setHasError(true);
      setIsLoading(false);
    }, 30000);

    return () => {
      clearTimeout(fallbackTimer);
      clearTimeout(errorTimer);
    };
  }, [isLoading, key]);

  // Fetch subtitles
  useEffect(() => {
    if (tmdbId) {
      const fetchSubtitle = async () => {
        try {
          const res = await fetch(
            `/api/subtitles?tmdb_id=${tmdbId}&type=${mediaType || "movie"}${season ? `&season=${season}` : ""}${episode ? `&episode=${episode}` : ""}`,
          );
          const data = await res.json();
          if (data.url) {
            setSubtitle({
              url: data.url,
              language: data.language === "id" ? "Indonesian" : "English",
            });
          }
        } catch (err) {
          console.error("[VideoPlayer] Subtitle fetch failed:", err);
        }
      };
      fetchSubtitle();
    }
  }, [tmdbId, mediaType, season, episode]);

  // Handle progress tracking from iframe postMessage
  useEffect(() => {
    let lastSaveTime = 0;
    const handleMessage = async (e: MessageEvent) => {
      try {
        let payload = e.data;
        if (typeof payload === "string") {
          payload = JSON.parse(payload);
        }

        if (payload?.type === "MEDIA_DATA" && payload?.data) {
          const { duration, currentTime } = payload.data;
          // Video is playing — definitely not loading
          setIsLoading(false);
          setHasError(false);

          if (currentTime > 10 && tmdbId) {
            const now = Date.now();
            if (now - lastSaveTime > 15000) {
              lastSaveTime = now;
              const { createClient } = await import("@/lib/supabase/client");
              const supabase = createClient();
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (session) {
                const { data: content } = await supabase
                  .from("contents")
                  .select("id")
                  .eq("tmdb_id", tmdbId)
                  .single();
                if (content) {
                  await supabase.from("watch_history").upsert(
                    {
                      user_id: session.user.id,
                      content_id: content.id,
                      progress_time: Math.floor(currentTime),
                      duration: Math.floor(duration),
                    },
                    { onConflict: "user_id,content_id" },
                  );
                }
              }
            }
          }
        }
      } catch (err) {
        // Ignore unparseable messages from cross-origin iframes
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [tmdbId]);

  // Handle subtitle toast visibility
  useEffect(() => {
    if (!isLoading && subtitle) {
      setShowSubtitleToast(true);
      const timer = setTimeout(() => {
        setShowSubtitleToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, subtitle]);

  // Build final iframe URL with provider-specific params
  const getFinalUrl = (url: string) => {
    try {
      const urlObj = new URL(url);

      // VidLink.pro specific params
      if (url.includes("vidlink")) {
        urlObj.searchParams.set("primaryColor", "E50914");
        urlObj.searchParams.set("secondaryColor", "ffffff");
        urlObj.searchParams.set("iconColor", "ffffff");
        urlObj.searchParams.set("autoplay", "1");
      }

      // VidSrc & MoviesAPI.to specific params
      if (url.includes("vidsrc") || url.includes("moviesapi.to")) {
        urlObj.searchParams.set("autoplay", "1");
      }

      // Subtitle injection (provider-agnostic)
      if (subtitle?.url) {
        urlObj.searchParams.set("sub", subtitle.url);
        urlObj.searchParams.set("subtitle", subtitle.url);
      }

      return urlObj.toString();
    } catch {
      return url;
    }
  };

  return (
    <div className="video-player-container relative w-full h-full bg-black rounded-inherit overflow-hidden group">
      {/* Actual iframe — always mounted, visibility controlled by CSS */}
      <iframe
        key={key}
        ref={iframeRef}
        src={getFinalUrl(src)}
        title={title}
        className="absolute inset-0 w-full h-full border-none z-10"
        style={{
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.5s ease-in-out",
          backgroundColor: "#000",
        }}
        allow="autoplay; encrypted-media; picture-in-picture; web-share; fullscreen; clipboard-write"
        referrerPolicy="origin"
        onLoad={() => {
          setIsLoading(false);
        }}
        allowFullScreen
      />

      {/* Subtitle Status Toast */}
      <AnimatePresence>
        {subtitle && !isLoading && showSubtitleToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-6 left-6 z-30 bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3 shadow-2xl pointer-events-none"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              Subtitles Active: {subtitle.language}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next Episode Button Overlay */}
      {nextEpisodeUrl && !isLoading && (
        <div className="absolute top-6 right-6 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Link
            href={nextEpisodeUrl}
            className="flex items-center gap-2 bg-white/10 hover:bg-white text-white hover:text-black backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 transition-all font-black text-[10px] uppercase tracking-widest shadow-2xl"
          >
            Next Episode <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && !hasError && (
          <motion.div
            key="loading"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0F0F0F]"
          >
            <motion.div
              className="absolute inset-0 opacity-30 bg-cover bg-center"
              style={{
                backgroundImage: backdrop
                  ? `linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4)), url(${backdrop})`
                  : "none",
              }}
              animate={{ scale: [1, 1.05] }}
              transition={{
                duration: 10,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            />

            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[#E50914] blur-2xl opacity-20 animate-pulse" />
                <Loader2
                  className="animate-spin text-[#E50914] relative z-10"
                  size={56}
                  strokeWidth={3}
                />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-white font-black tracking-[4px] text-xs uppercase animate-pulse">
                  Menyiapkan Film...
                </span>
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                  {title}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Overlay */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0F0F0F]"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-8 px-8 text-center max-w-sm"
            >
              <div className="w-20 h-20 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center">
                <AlertCircle className="text-zinc-500" size={40} />
              </div>
              <div className="space-y-3">
                <h3 className="text-white font-black text-xl tracking-tight">
                  Koneksi Agak Lambat?
                </h3>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                  Beberapa server membutuhkan waktu ekstra. Coba segarkan
                  player atau ganti server di samping.
                </p>
              </div>
              <button
                onClick={handleReload}
                className="flex items-center gap-3 bg-white text-black px-10 py-4 rounded-full font-black text-sm hover:scale-105 transition-all active:scale-95 shadow-xl"
              >
                <RefreshCcw size={18} /> COBA LAGI
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .video-player-container {
          aspect-ratio: 16 / 9;
        }
        @media (max-width: 768px) {
          .video-player-container {
            aspect-ratio: 16 / 10;
          }
        }
      `}</style>
    </div>
  );
}
