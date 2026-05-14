'use client';

import { Search, Filter } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { NETWORK_CONFIGS } from '@/lib/tmdb';

export default function CatalogFilters({ query, type, status }: { query: string; type: string; status: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateSearch = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    // Always reset to page 1 on filter change
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="glass" style={{ padding: '1.25rem', borderRadius: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          updateSearch('q', formData.get('q') as string);
        }}>
          <input 
            name="q"
            defaultValue={query}
            placeholder="Cari judul film atau TV series..." 
            style={{ 
              width: '100%', 
              padding: '0.75rem 1rem 0.75rem 3rem', 
              backgroundColor: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: '0.75rem',
              color: 'white',
              outline: 'none'
            }}
          />
        </form>
      </div>
      
      <select 
        style={{ padding: '0.75rem 1.5rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem', color: 'white' }}
        onChange={(e) => updateSearch('type', e.target.value)}
        defaultValue={type}
      >
        <option value="">Semua Tipe</option>
        <option value="movie">Movie</option>
        <option value="tv">TV Series</option>
        <option value="anime">Anime</option>
        <option value="drakor">Drakor</option>
        <option value="drachin">Drachin</option>
        <option value="donghua">Donghua</option>
        <option value="variety">Variety</option>
        <option value="drathai">Thai Drama</option>
        <option value="drajep">J-Drama</option>
      </select>

      <select 
        style={{ padding: '0.75rem 1.5rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem', color: 'white' }}
        onChange={(e) => updateSearch('status', e.target.value)}
        defaultValue={status}
      >
        <option value="">Semua Status</option>
        <option value="approved">Approved</option>
        <option value="pending">Pending</option>
      </select>

      <select 
        style={{ padding: '0.75rem 1.5rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem', color: 'white' }}
        onChange={(e) => updateSearch('platform', e.target.value)}
        defaultValue={searchParams.get('platform') || ''}
      >
        <option value="">Semua Platform</option>
        {NETWORK_CONFIGS.map(net => (
          <option key={net.slug} value={net.slug}>{net.name}</option>
        ))}
        <option value="other">Other / Unclassified</option>
      </select>
    </div>
  );
}
