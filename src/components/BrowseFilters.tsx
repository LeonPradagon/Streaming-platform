"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Grid, List as ListIcon, X } from 'lucide-react';

interface BrowseFiltersProps {
  currentQ: string;
  currentType: string;
  currentSort: string;
  currentView: string;
  currentGenre?: string;
  currentCountry?: string;
  currentYear?: string;
}

const TYPES = [
  { value: 'all', label: 'Semua' },
  { value: 'movie', label: 'Film' },
  { value: 'tv', label: 'Series' },
  { value: 'anime', label: 'Anime' },
  { value: 'drakor', label: 'Drakor' },
  { value: 'drachin', label: 'Drachin' },
  { value: 'donghua', label: 'Donghua' },
  { value: 'variety', label: 'Variety' },
];

const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction", "Thriller", "War"
];

const SORTS = [
  { value: 'populer', label: 'Populer' },
  { value: 'terbaru', label: 'Terbaru' },
  { value: 'rating', label: 'Rating Tertinggi' },
  { value: 'az', label: 'A-Z' },
];

const COUNTRIES = [
  { value: 'all', label: 'Semua Negara' },
  { value: 'us', label: 'Barat' },
  { value: 'kr', label: 'Korea' },
  { value: 'cn', label: 'China' },
  { value: 'jp', label: 'Jepang' },
  { value: 'th', label: 'Thailand' },
  { value: 'id', label: 'Indonesia' },
];

const YEARS = ['all', ...Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() - i))];

export default function BrowseFilters({ currentQ, currentType, currentSort, currentView, currentGenre, currentCountry, currentYear }: BrowseFiltersProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(currentQ);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(currentView as 'grid' | 'list' || 'grid');

  const buildUrl = (params: Record<string, string>) => {
    const searchParams = new URLSearchParams();
    const allParams = {
      q: currentQ,
      type: currentType,
      genre: currentGenre,
      sort: currentSort,
      view: currentView,
      country: currentCountry,
      year: currentYear,
      ...params,
    };
    Object.entries(allParams).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== 'terbaru' && value !== '' && value !== 'grid') {
        searchParams.set(key, value);
      }
    });
    return `/browse?${searchParams.toString()}`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ q: searchQuery }));
  };

  const clearSearch = () => {
    setSearchQuery('');
    router.push(buildUrl({ q: '' }));
  };

  return (
    <div className="space-y-4">
      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] md:min-w-[300px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul film, series, anime..." 
            className="w-full bg-black/40 border border-white/20 rounded-full px-11 py-2.5 text-sm text-white focus:outline-none focus:border-red-600 transition-colors pr-10"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={clearSearch} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </form>

        {/* Filter Toggle */}
        <button 
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`flex items-center gap-2 border px-6 py-2.5 rounded-full text-sm font-bold transition uppercase tracking-tight ${
            isFilterOpen ? 'bg-red-600 border-red-600 text-white shadow-[0_0_20px_rgba(229,9,20,0.3)]' : 'bg-black/40 border-white/20 text-white hover:bg-white/10'
          }`}
        >
          <Filter size={16} /> {isFilterOpen ? 'Tutup Filter' : 'Filter Lanjut'}
        </button>
        
        {/* View Toggle */}
        <div className="flex bg-black/40 border border-white/20 rounded-full p-1">
          <button 
            onClick={() => router.push(buildUrl({ view: 'grid' }))}
            className={`p-2 rounded-full transition ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            <Grid size={16} />
          </button>
          <button 
            onClick={() => router.push(buildUrl({ view: 'list' }))}
            className={`p-2 rounded-full transition ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            <ListIcon size={16} />
          </button>
        </div>
      </div>

      {/* Expanded Filters */}
      {isFilterOpen && (
        <div className="bg-[#141414] p-8 rounded-[2.5rem] animate-fadeIn border border-white/5 space-y-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[100px] -z-10" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            
            {/* Genre Filter - NEW */}
            <div className="lg:col-span-3">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mb-4 block">Eksplorasi Genre</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => router.push(buildUrl({ genre: '' }))}
                  className={`px-5 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                    !currentGenre 
                      ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' 
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Semua Genre
                </button>
                {GENRES.map(g => (
                  <button
                    key={g}
                    onClick={() => router.push(buildUrl({ genre: g }))}
                    className={`px-5 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                      currentGenre === g 
                        ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' 
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mb-4 block">Kategori</label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => router.push(buildUrl({ type: t.value }))}
                    className={`px-5 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                      (currentType || 'all') === t.value 
                        ? 'bg-white text-black border-white shadow-lg' 
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Country Filter */}
            <div>
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mb-4 block">Negara</label>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => router.push(buildUrl({ country: c.value }))}
                    className={`px-5 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                      (currentCountry || 'all') === c.value 
                        ? 'bg-white text-black border-white shadow-lg' 
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mb-4 block">Urutan</label>
              <div className="flex flex-wrap gap-2">
                {SORTS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => router.push(buildUrl({ sort: s.value }))}
                    className={`px-5 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                      (currentSort || 'populer') === s.value 
                        ? 'bg-white text-black border-white shadow-lg' 
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <div className="pt-8 border-t border-white/5 flex justify-between items-center">
            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Gunakan filter untuk hasil lebih spesifik</p>
            <button
              onClick={() => {
                setSearchQuery('');
                router.push('/browse');
              }}
              className="text-[10px] text-gray-500 hover:text-red-500 font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 group"
            >
              <X size={14} className="group-hover:rotate-90 transition-transform" /> Reset Pencarian
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
