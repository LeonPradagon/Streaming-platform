'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Play, AlertCircle } from 'lucide-react';
import { MediaPlayer, MediaOutlet, MediaPoster, MediaCommunitySkin, MediaCaptions } from '@vidstack/react';
import { motion, AnimatePresence } from 'framer-motion';
import 'vidstack/styles/base.css';
import 'vidstack/styles/ui/buttons.css';
import 'vidstack/styles/ui/sliders.css';
import 'vidstack/styles/ui/tooltips.css';
import 'vidstack/styles/community-skin/video.css';

interface VideoPlayerProps {
  src: string;
  title: string;
  backdrop?: string;
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

export default function VideoPlayer({ src, title, backdrop, tmdbId, mediaType, season, episode }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [subtitle, setSubtitle] = useState<{ url: string, language: string } | null>(null);
  const [clicksRemaining, setClicksRemaining] = useState(1);

  // Reload handler
  const handleReload = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setClicksRemaining(1);
  }, []);

  // Timeout to detect "stuck" loading
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setHasError(true);
      }, 15000); // 15 seconds timeout
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Reset states and fetch subtitles when src or tmdbId changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    
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
  }, [src, tmdbId, mediaType, season, episode]);

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
          // When we receive media data, we know it's definitely playing
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

  // Build final iframe URL with subtitle injected
  const getFinalUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      
      urlObj.searchParams.set('autoplay', '1');
      
      // Inject Subtitle if available
      if (subtitle?.url) {
        urlObj.searchParams.set('sub.id', subtitle.url);
        urlObj.searchParams.set('sub.label', subtitle.language);
        urlObj.searchParams.set('sub.id.id', subtitle.url);
      }

      // vidlink.pro specifics
      if (url.includes('vidlink')) {
        urlObj.searchParams.set('primaryColor', 'E50914');
        urlObj.searchParams.set('secondaryColor', 'ffffff');
        urlObj.searchParams.set('iconColor', 'ffffff');
        urlObj.searchParams.delete('player');
      }

      // vidsrc.pm specifics
      if (url.includes('vidsrc')) {
        urlObj.searchParams.set('auto_play', '1');
        urlObj.searchParams.set('color', 'E50914');
      }
      
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  return (
    <div className="video-player-container relative w-full h-full bg-black rounded-inherit overflow-hidden">
      <MediaPlayer
        title={title}
        src={{ src: getFinalUrl(src), type: 'video/object' }}
        className="w-full h-full"
        load="manual"
      >
        <MediaOutlet>
          <iframe 
            src={getFinalUrl(src)}
            title={title}
            className="absolute inset-0 w-full h-full border-none z-10"
            style={{ 
              opacity: isLoading ? 0 : 1, 
              transition: 'opacity 0.5s ease',
              backgroundColor: '#000'
            }}
            allow="autoplay; encrypted-media; picture-in-picture; web-share; fullscreen; clipboard-write"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => {
              // Reliably disable loader when iframe finishes loading
              setTimeout(() => setIsLoading(false), 1500);
            }}
            allowFullScreen
          />
          {backdrop && <MediaPoster src={backdrop} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" />}
          {subtitle?.url && (
            <track
              src={subtitle.url}
              label={subtitle.language}
              srcLang={subtitle.language === 'Indonesian' ? 'id-ID' : 'en-US'}
              kind="subtitles"
              default
            />
          )}
        </MediaOutlet>
        <MediaCaptions className="vds-captions" />
        <MediaCommunitySkin />
      </MediaPlayer>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0F0F0F]">
          <div 
            className="absolute inset-0 opacity-40 bg-cover bg-center"
            style={{ backgroundImage: backdrop ? `linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4)), url(${backdrop})` : 'none' }}
          />
          {!hasError ? (
            <div className="relative z-10 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-[#E50914]" size={48} />
              <span className="text-white font-bold tracking-[2px] text-xs uppercase animate-pulse">
                Menyiapkan Video...
              </span>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center animate-in zoom-in duration-300">
              <AlertCircle className="text-zinc-500" size={48} />
              <div>
                <p className="text-white font-bold text-lg mb-2">Loading Terasa Lama?</p>
                <p className="text-zinc-400 text-sm max-w-xs">
                  Beberapa server mungkin butuh waktu lebih lama. Coba segarkan halaman atau ganti server lain.
                </p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="bg-white text-black px-8 py-3 rounded-full font-black text-sm hover:scale-105 transition-transform active:scale-95"
              >
                SEGARKAN HALAMAN
              </button>
            </div>
          )}
        </div>
      )}

      {/* Multi-Click Guard: Professional UX with Framer Motion */}
      <AnimatePresence mode="wait">
        {!isLoading && clicksRemaining > 0 && (
          <motion.div 
            key="click-guard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setClicksRemaining(prev => prev - 1);
            }}
            className="absolute inset-0 z-[100] cursor-pointer bg-black/20 backdrop-blur-[6px] flex flex-col items-center justify-center select-none"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-zinc-900/90 border border-white/10 p-10 rounded-[2.5rem] flex flex-col items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
            >
              {/* Animated Background Glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#E50914]/10 blur-[80px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#E50914]/10 blur-[80px] rounded-full pointer-events-none" />

              <div className="relative">
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-20 h-20 rounded-full bg-[#E50914] flex items-center justify-center shadow-[0_0_40px_rgba(229,9,20,0.6)]"
                >
                  <Play className="text-white fill-white ml-1.5" size={32} />
                </motion.div>
              </div>

              <div className="text-center space-y-2 relative z-10">
                <motion.p 
                  key={`title-${clicksRemaining}`}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-white font-black text-2xl tracking-tight"
                >
                  SIAP MEMUTAR
                </motion.p>
                <motion.p 
                  key={`desc-${clicksRemaining}`}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-zinc-400 text-sm font-semibold tracking-wide uppercase"
                >
                  Klik sekali untuk memulai video
                </motion.p>
              </div>

              <div className="flex gap-3 mt-2">
                <div className="h-1.5 w-32 bg-zinc-800 rounded-full overflow-hidden relative">
                  <motion.div 
                    initial={false}
                    animate={{ width: clicksRemaining === 0 ? '100%' : '0%' }}
                    className="absolute inset-0 bg-[#E50914] shadow-[0_0_10px_#E50914]"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        :root {
          --media-brand: #E50914;
          --media-focus-ring-color: #E50914;
        }
        .vds-player { 
          --media-brand: #E50914;
          --media-controls-color: #ffffff;
        }
        .vds-captions {
          --media-captions-font-size: 1.2rem;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }
      `}} />
    </div>
  );
}
