'use client';

import { Hammer, Cog, ShieldAlert } from 'lucide-react';

export default function MaintenanceMode({ siteTitle }: { siteTitle: string }) {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#060d17',
      backgroundImage: 'radial-gradient(circle at top left, var(--primary-glow), transparent 40%), radial-gradient(circle at bottom right, rgba(56, 189, 248, 0.05), transparent 40%)',
      padding: '2rem',
      color: 'white',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div className="glass" style={{ 
        padding: '4rem 3rem', 
        borderRadius: '3rem', 
        maxWidth: '600px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--card-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem'
      }}>
        <div style={{ position: 'relative' }}>
          <div style={{ 
            width: '120px', 
            height: '120px', 
            backgroundColor: 'rgba(234, 179, 8, 0.1)', 
            borderRadius: '2rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--primary)',
            animation: 'pulse 2s infinite'
          }}>
            <Hammer size={60} />
          </div>
          <div style={{ 
            position: 'absolute', 
            top: -10, 
            right: -10, 
            padding: '0.5rem', 
            backgroundColor: '#ef4444', 
            borderRadius: '50%',
            color: 'white',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
          }}>
            <ShieldAlert size={20} />
          </div>
        </div>

        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-1px' }}>
            Situs Sedang <span style={{ color: 'var(--primary)' }}>Maintenance</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Halo pecinta film! Kami sedang melakukan beberapa peningkatan pada <strong>{siteTitle}</strong> untuk memberikan pengalaman menonton yang lebih baik. Kami akan segera kembali!
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          backgroundColor: 'rgba(255,255,255,0.02)', 
          padding: '1.5rem', 
          borderRadius: '1.5rem',
          alignItems: 'center'
        }}>
          <Cog className="animate-spin" size={24} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
            Proses pemeliharaaan sedang berlangsung...
          </span>
        </div>

        <style jsx global>{`
          @keyframes pulse {
            0% { transform: scale(1); filter: drop-shadow(0 0 0px var(--primary)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 15px var(--primary-glow)); }
            100% { transform: scale(1); filter: drop-shadow(0 0 0px var(--primary)); }
          }
          .animate-spin {
            animation: spin 3s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
