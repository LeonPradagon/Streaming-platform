"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Grid, List as ListIcon, X } from 'lucide-react';

interface BrowseFiltersProps {
  currentQ: string;
  currentType: string;
  currentSort: string;
  currentView: string;
}

const TYPES = [
  { value: 'all', label: 'Semua' },
  { value: 'movie', label: 'Film' },
  { value: 'tv', label: 'Series' },
  { value: 'anime', label: 'Anime' },
  { value: 'drakor', label: 'Drakor' },
];

const SORTS = [
  { value: 'terbaru', label: 'Terbaru' },
  { value: 'rating', label: 'Rating Tertinggi' },
  { value: 'az', label: 'A-Z' },
];

export default function BrowseFilters({ currentQ, currentType, currentSort, currentView }: BrowseFiltersProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(currentQ);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(currentView as 'grid' | 'list' || 'grid');

  const buildUrl = (params: Record<string, string>) => {
    const searchParams = new URLSearchParams();
    const allParams = {
      q: currentQ,
      type: currentType,
      sort: currentSort,
      view: currentView,
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
            className="w-full bg-black/40 border border-white/20 rounded-full px-11 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors pr-10"
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
          className={`flex items-center gap-2 border px-4 py-2.5 rounded-full text-sm font-bold transition ${
            isFilterOpen ? 'bg-primary border-primary text-white' : 'bg-black/40 border-white/20 text-white hover:bg-white/10'
          }`}
        >
          <Filter size={16} /> Filter
        </button>
        
        {/* View Toggle */}
        <div className="flex bg-black/40 border border-white/20 rounded-full p-1">
          <button 
            onClick={() => router.push(buildUrl({ view: 'grid' }))}
            className={`p-1.5 rounded-full transition ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Grid size={16} />
          </button>
          <button 
            onClick={() => router.push(buildUrl({ view: 'list' }))}
            className={`p-1.5 rounded-full transition ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <ListIcon size={16} />
          </button>
        </div>
      </div>

      {/* Expanded Filters */}
      {isFilterOpen && (
        <div className="glass p-5 rounded-2xl animate-fade-in border border-white/5 space-y-4">
          {/* Type Filter */}
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Kategori</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => router.push(buildUrl({ type: t.value }))}
                  className={`px-4 py-2 rounded-full text-sm font-bold border transition ${
                    currentType === t.value 
                      ? 'bg-primary border-primary text-white' 
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2 block">Urutkan</label>
            <div className="flex flex-wrap gap-2">
              {SORTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => router.push(buildUrl({ sort: s.value }))}
                  className={`px-4 py-2 rounded-full text-sm font-bold border transition ${
                    currentSort === s.value 
                      ? 'bg-primary border-primary text-white' 
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear All */}
          <button
            onClick={() => {
              setSearchQuery('');
              router.push('/browse');
            }}
            className="text-sm text-gray-400 hover:text-white font-semibold underline underline-offset-4"
          >
            Reset Filter
          </button>
        </div>
      )}
    </div>
  );
}
