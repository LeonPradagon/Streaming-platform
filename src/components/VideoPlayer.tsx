'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, RefreshCcw, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface VideoPlayerProps {
  src: string;
  title: string;
  backdrop?: string;
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  season?: number;
  episode?: number;
  nextEpisodeUrl?: string;
}

export default function VideoPlayer({ src, title, backdrop, tmdbId, mediaType, season, episode, nextEpisodeUrl }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [subtitle, setSubtitle] = useState<{ url: string, language: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0); // For forcing iframe reload

  // --- AD BLOCKING LOGIC (Invisible) ---
  useEffect(() => {
    // 1. window.open override
    const originalOpen = window.open;
    // @ts-ignore
    window.open = function (...args) {
      console.log('[Anti-Ad] Blocked window.open:', args);
      return null;
    };

    // 2. Blur/Focus Auto-Kill
    const handleBlur = () => {
      // Small delay to let the popup attempt to open, then we refocus
      setTimeout(() => {
        window.focus();
        // If we were in full screen, ensure we stay there if possible
        if (document.fullscreenElement) {
          (document.fullscreenElement as HTMLElement).focus();
        }
      }, 100);
    };

    // 3. beforeunload guard
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Some ad scripts try to redirect the parent page
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // @ts-ignore
      window.open = originalOpen;
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleReload = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setKey(prev => prev + 1);
  }, []);

  // Timeout to detect "stuck" loading
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setHasError(true);
      }, 25000); // 25 seconds timeout
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Fetch subtitles
  useEffect(() => {
    if (tmdbId) {
      const fetchSubtitle = async () => {
        try {
          const res = await fetch(`/api/subtitles?tmdb_id=${tmdbId}&type=${mediaType || 'movie'}${season ? `&season=${season}` : ''}${episode ? `&episode=${episode}` : ''}`);
          const data = await res.json();
          if (data.url) {
            setSubtitle({ url: data.url, language: data.language === 'id' ? 'Indonesian' : 'English' });
          }
        } catch (err) {
          console.error('[VideoPlayer] Subtitle fetch failed:', err);
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
        if (typeof payload === 'string') {
          payload = JSON.parse(payload);
        }

        if (payload?.type === 'MEDIA_DATA' && payload?.data) {
          const { duration, currentTime } = payload.data;
          setIsLoading(false);
          
          if (currentTime > 10 && tmdbId) {
            const now = Date.now();
            if (now - lastSaveTime > 15000) {
              lastSaveTime = now;
              const { createClient } = await import('@/lib/supabase/client');
              const supabase = createClient();
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                const { data: content } = await supabase.from('contents').select('id').eq('tmdb_id', tmdbId).single();
                if (content) {
                  await supabase.from('watch_history').upsert({
                    user_id: session.user.id,
                    content_id: content.id,
                    progress_time: Math.floor(currentTime),
                    duration: Math.floor(duration),
                  }, { onConflict: 'user_id,content_id' });
                }
              }
            }
          }
        }
      } catch (err) {
        // Ignore unparseable messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tmdbId]);

  // Build final iframe URL with anti-ad params and subtitles
  const getFinalUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      
      urlObj.searchParams.set('autoplay', '1');
      
      // Comprehensive Subtitle Injection
      if (subtitle?.url) {
        // Different providers use different parameters
        urlObj.searchParams.set('sub', subtitle.url);
        urlObj.searchParams.set('sub.id', subtitle.url);
        urlObj.searchParams.set('sub.label', subtitle.language);
        urlObj.searchParams.set('subtitle', subtitle.url);
      }

      // 1. VidLink.pro Optimizations
      if (url.includes('vidlink')) {
        urlObj.searchParams.set('primaryColor', 'E50914');
        urlObj.searchParams.set('secondaryColor', 'ffffff');
        urlObj.searchParams.set('iconColor', 'ffffff');
        urlObj.searchParams.set('ads', '0'); // Internal ad-block
        urlObj.searchParams.set('player', 'jw'); // Use JWPlayer if possible for better performance
      }

      // 2. VidSrc Optimizations
      if (url.includes('vidsrc')) {
        urlObj.searchParams.set('auto_play', '1');
        urlObj.searchParams.set('color', 'E50914');
      }

      // 3. General Anti-Ad / Tracking Parameters
      urlObj.searchParams.set('iv_load_policy', '3'); // Disable annotations (for YT based embeds)
      urlObj.searchParams.set('modestbranding', '1');
      
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  return (
    <div className="video-player-container relative w-full h-full bg-black rounded-inherit overflow-hidden group">
      <AnimatePresence>
        <iframe 
          key={key}
          ref={iframeRef}
          src={getFinalUrl(src)}
          title={title}
          className="absolute inset-0 w-full h-full border-none z-10"
          style={{ 
            opacity: isLoading ? 0 : 1, 
            transition: 'opacity 0.8s ease',
            backgroundColor: '#000'
          }}
          allow="autoplay; encrypted-media; picture-in-picture; web-share; fullscreen; clipboard-write"
          referrerPolicy="no-referrer"
          onLoad={() => {
            // Give it a bit more time for the provider's internal loading
            setTimeout(() => setIsLoading(false), 2000);
          }}
          allowFullScreen
        />
      </AnimatePresence>

      {/* Subtitle Status Toast */}
      <AnimatePresence>
        {subtitle && !isLoading && (
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
        {isLoading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0F0F0F]"
          >
            <motion.div 
              className="absolute inset-0 opacity-30 bg-cover bg-center transition-transform duration-[10s]"
              style={{ 
                backgroundImage: backdrop ? `linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4)), url(${backdrop})` : 'none',
              }}
              animate={{ scale: [1, 1.05] }}
              transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
            />
            
            <div className="relative z-10 flex flex-col items-center gap-6">
              {!hasError ? (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#E50914] blur-2xl opacity-20 animate-pulse" />
                    <Loader2 className="animate-spin text-[#E50914] relative z-10" size={56} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-white font-black tracking-[4px] text-xs uppercase animate-pulse">
                      Menyiapkan Cinema...
                    </span>
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                      {title}
                    </span>
                  </div>
                </>
              ) : (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-8 px-8 text-center max-w-sm"
                >
                  <div className="w-20 h-20 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center">
                    <AlertCircle className="text-zinc-500" size={40} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-white font-black text-xl tracking-tight">Koneksi Agak Lambat?</h3>
                    <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                      Beberapa server membutuhkan waktu ekstra. Coba segarkan player atau ganti server di samping.
                    </p>
                  </div>
                  <button 
                    onClick={handleReload}
                    className="flex items-center gap-3 bg-white text-black px-10 py-4 rounded-full font-black text-sm hover:scale-105 transition-all active:scale-95 shadow-xl"
                  >
                    <RefreshCcw size={18} /> COBA LAGI
                  </button>
                </motion.div>
              )}
            </div>
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
