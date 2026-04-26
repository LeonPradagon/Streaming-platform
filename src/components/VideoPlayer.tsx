"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertCircle, RefreshCcw, ChevronRight, ServerCrash } from "lucide-react";
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
  externalSubtitle?: string;
}

export default function VideoPlayer({
  src,
  title,
  backdrop,
  tmdbId,
  mediaType,
  season,
  episode,
  externalSubtitle,
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);

  // Reset loading when source changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setIframeReady(false);
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
    setIframeReady(false);
    setKey((prev) => prev + 1);
  }, []);

  // Timeout to detect "stuck" loading
  useEffect(() => {
    if (!isLoading) return;

    // After 6 seconds, show the iframe (many providers don't fire onLoad)
    const fallbackTimer = setTimeout(() => {
      setIframeReady(true);
      setIsLoading(false);
    }, 6000);

    // After 20 seconds of no content, show a soft warning (not error)
    const errorTimer = setTimeout(() => {
      setHasError(true);
      setIsLoading(false);
    }, 20000);

    return () => {
      clearTimeout(fallbackTimer);
      clearTimeout(errorTimer);
    };
  }, [isLoading, key]);

  // Timeout to detect "stuck" loading

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
          setIframeReady(true);

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

  // Handle progress tracking from iframe postMessage

  // Build final iframe URL with provider-specific params
  const getFinalUrl = (url: string) => {
    try {
      const urlObj = new URL(url);

      // Videasy specific: Set theme color to match NETIX (Red)
      if (url.includes('videasy')) {
        urlObj.searchParams.set('color', 'E50914');
        urlObj.searchParams.set('autoplay', '1');
        if (externalSubtitle) {
          urlObj.searchParams.set('sub', externalSubtitle);
          urlObj.searchParams.set('sub_url', externalSubtitle);
          urlObj.searchParams.set('subtitle_url', externalSubtitle);
        }
      }

      // VidLink specific: Auto Subtitle & Styling
      if (url.includes('vidlink')) {
        urlObj.searchParams.set('autoplay', '1');
        urlObj.searchParams.set('sub_lang', 'Indonesian');
        urlObj.searchParams.set('primaryColor', 'E50914');
        urlObj.searchParams.set('secondaryColor', 'ffffff');
        urlObj.searchParams.set('iconColor', 'ffffff');
      }

      // MoviesAPI specific: Append scraped subtitle
      if (url.includes('moviesapi.to')) {
        if (externalSubtitle) {
          urlObj.searchParams.set('sub', externalSubtitle);
        }
      }

      return urlObj.toString();
    } catch {
      return url;
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden group">
      {/* Actual iframe — always mounted */}
      <iframe
        key={key}
        ref={iframeRef}
        src={getFinalUrl(src)}
        title={title}
        className="absolute inset-0 w-full h-full border-none z-10"
        style={{
          opacity: iframeReady ? 1 : 0,
          transition: "opacity 0.5s ease-in-out",
          backgroundColor: "#000",
          colorScheme: "dark",
        }}
        allow="autoplay; encrypted-media; picture-in-picture; web-share; fullscreen; clipboard-write"
        referrerPolicy="no-referrer"
        onLoad={() => {
          setIsLoading(false);
          setTimeout(() => setIframeReady(true), 300);
        }}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        allowFullScreen
      />

      {/* Black base layer to prevent any white flash */}
      <div 
        className="absolute inset-0 z-[5] bg-black pointer-events-none" 
        style={{ opacity: iframeReady ? 0 : 1, transition: 'opacity 0.5s ease-in-out' }} 
      />



      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && !hasError && (
          <motion.div
            key="loading"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black"
          >
            <motion.div
              className="absolute inset-0 opacity-20 bg-cover bg-center"
              style={{
                backgroundImage: backdrop
                  ? `linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.5)), url(${backdrop})`
                  : "none",
                filter: "blur(8px)",
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
                <div className="absolute inset-0 bg-[#E50914] blur-2xl opacity-25 animate-pulse" />
                <Loader2 className="animate-spin text-[#E50914] relative z-10" size={52} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-white font-black tracking-[4px] text-xs uppercase animate-pulse">
                  Menyiapkan Film...
                </span>
                <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest max-w-[240px] truncate text-center">
                  {title}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error / Slow Connection Overlay */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-6 px-8 text-center max-w-sm"
            >
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                <ServerCrash className="text-zinc-500" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-white font-black text-lg tracking-tight">
                  Server Tidak Merespon
                </h3>
                <p className="text-zinc-500 text-xs font-medium leading-relaxed">
                  Coba muat ulang atau pilih server lain.
                </p>
              </div>
              <button
                onClick={handleReload}
                className="flex items-center gap-2.5 bg-[#E50914] hover:bg-red-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:scale-105 transition-all active:scale-95 shadow-lg shadow-red-500/20"
              >
                <RefreshCcw size={16} /> Muat Ulang
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

