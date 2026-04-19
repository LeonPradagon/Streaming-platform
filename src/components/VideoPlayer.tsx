'use client';

import { useState, useEffect } from 'react';
import { Loader2, Play } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  title: string;
  backdrop?: string;
}

export default function VideoPlayer({ src, title, backdrop }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);

  // Reset loading state when src changes
  useEffect(() => {
    setIsLoading(true);
  }, [src]);

  // Inject custom color params and subtitles for supported providers
  const getFinalUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      
      // For vidlink.pro - override primary color and set Indonesia subtitles
      if (url.includes('vidlink')) {
        urlObj.searchParams.set('primaryColor', 'ffffff');
        urlObj.searchParams.set('secondaryColor', 'a3a3a3');
        urlObj.searchParams.set('iconColor', 'ffffff');
        urlObj.searchParams.set('autoplay', 'true');
        
        // Experimental: Indonesian subtitle force
        urlObj.searchParams.set('sub_lang', 'id');
        urlObj.searchParams.set('native', 'true');
        urlObj.searchParams.set('default_sub', 'id');
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
      {/* CSS overrides to force JW Player / embed player buttons to white/gray */}
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
      ` }} />

      {!isStarted ? (
        <div 
          onClick={() => setIsStarted(true)}
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 30,
            cursor: 'pointer',
            backgroundImage: backdrop ? `linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2)), url(${backdrop})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#0F0F0F'
          }}
          className="group"
        >
          <div 
            className="play-button-pulse"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              transition: 'all 0.3s ease',
            }}
          >
            <Play size={40} fill="white" color="white" style={{ marginLeft: '4px' }} />
          </div>
          <span style={{ 
            color: '#fff', 
            fontSize: '1.25rem', 
            fontWeight: 700, 
            marginTop: '1.5rem',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            letterSpacing: '0.025em'
          }}>
            Klik untuk Menonton
          </span>
          <span style={{ color: '#a3a3a3', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {title}
          </span>
        </div>
      ) : (
        <>
          {/* Loading Overlay (only shown after click) */}
          {isLoading && (
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              zIndex: 10,
              backgroundColor: '#0F0F0F',
              gap: '1rem'
            }}>
              <Loader2 className="animate-spin-custom" size={40} color="#ffffff" />
              <span style={{ color: '#a3a3a3', fontSize: '0.875rem', fontWeight: 500 }}>
                Menyiapkan player...
              </span>
            </div>
          )}

          <iframe 
            key={src}
            src={getFinalUrl(src)}
            title={title}
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              border: 'none',
              opacity: isLoading ? 0 : 1,
              transition: 'opacity 0.3s ease'
            }}
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture; web-share"
            referrerPolicy="no-referrer"
            {...(src.includes('vidlink') ? {} : { sandbox: "allow-forms allow-scripts allow-pointer-lock allow-same-origin allow-top-navigation-by-user-activation" })}
            onLoad={() => setIsLoading(false)}
          ></iframe>
        </>
      )}
    </div>
  );
}
