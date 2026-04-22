'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Play, Subtitles } from 'lucide-react';

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

  // Reset states when src changes
  useEffect(() => {
    setIsLoading(true);
  }, [src]);

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
          if (currentTime > 10 && tmdbId) {
            const now = Date.now();
            // Throttle saves to once every 15 seconds
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
        // Ignore unparseable messages or other errors
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
      urlObj.searchParams.set('muted', '0');
      
      // vidlink.pro — inject subtitle via sub_file
      if (url.includes('vidlink')) {
        urlObj.searchParams.set('primaryColor', 'ffffff');
        urlObj.searchParams.set('secondaryColor', 'a3a3a3');
        urlObj.searchParams.set('iconColor', 'ffffff');
        
        // Vidlink's JW Player does not support sub_file well. Force default player.
        urlObj.searchParams.delete('player');
      }

      // vidsrc.pm
      if (url.includes('vidsrc')) {
        urlObj.searchParams.set('auto_play', '1');
        urlObj.searchParams.set('auto_mute', '0');
      }
      
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  return (
    <div className="video-player-container" style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%',
      backgroundColor: '#000', 
      borderRadius: 'inherit', 
      overflow: 'hidden', 
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-custom {
          animation: spin 1s linear infinite;
        }
        .play-button-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.05); }
        }
        @keyframes subtitleHintSlide {
          0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
          12% { opacity: 1; transform: translateX(-50%) translateY(0); }
          85% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
        }
        .subtitle-hint {
          animation: subtitleHintSlide 6s ease-in-out forwards;
        }
      ` }} />

      {isLoading && (
        <div style={{ 
          position: 'absolute', 
          top: 0, left: 0, width: '100%', height: '100%', 
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', 
          zIndex: 10, backgroundColor: '#0F0F0F', gap: '1rem',
          backgroundImage: backdrop ? `linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2)), url(${backdrop})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center'
        }}>
          <Loader2 className="animate-spin-custom" size={40} color="#ffffff" />
          <span style={{ color: '#a3a3a3', fontSize: '0.875rem', fontWeight: 500 }}>
            Menyiapkan player...
          </span>
        </div>
      )}

      <iframe 
        src={getFinalUrl(src)}
        title={title}
        style={{ 
          position: 'absolute', 
          top: 0, left: 0, width: '100%', height: '100%', 
          border: 'none',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease'
        }}
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; web-share; fullscreen"
        referrerPolicy="origin"
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
