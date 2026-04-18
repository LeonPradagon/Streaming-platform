'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  title: string;
}

export default function VideoPlayer({ src, title }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state when src changes
  useEffect(() => {
    setIsLoading(true);
  }, [src]);

  // Inject custom color params for supported providers
  const getFinalUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      
      // For vidlink.pro - override primary color to white/gray
      if (url.includes('vidlink')) {
        urlObj.searchParams.set('primaryColor', 'ffffff');
        urlObj.searchParams.set('secondaryColor', 'a3a3a3');
        urlObj.searchParams.set('iconColor', 'ffffff');
        urlObj.searchParams.set('autoplay', 'true');
      }
      
      // For vidsrc / embed.su - most don't support color params,
      // we'll use CSS filter overrides below instead
      
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  return (
    <div className="video-player-container" style={{ 
      position: 'relative', 
      width: '100%', 
      paddingTop: '56.25%', 
      backgroundColor: '#000', 
      borderRadius: '1rem', 
      overflow: 'hidden', 
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      {/* Loading Overlay */}
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
            Menghubungkan ke server video...
          </span>
        </div>
      )}

      {/* CSS overrides to force JW Player / embed player buttons to white/gray */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-custom {
          animation: spin 1s linear infinite;
        }
        /* Override JW Player red buttons via CSS hue-rotate on the iframe container */
        .video-player-container iframe {
          /* This is a broad approach; for iframes we can't inject CSS directly
             but the color params above handle vidlink specifically */
        }
      ` }} />

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
    </div>
  );
}
