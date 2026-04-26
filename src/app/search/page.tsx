"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import MovieCard from "@/components/MovieCard";
import { Search as SearchIcon, X, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);

  // Fetch trending for initial state
  useEffect(() => {
    const fetchTrending = async () => {
      const { data } = await supabase
        .from("contents")
        .select("*")
        .eq("status", "approved")
        .order("popularity", { ascending: false })
        .limit(10);
      setTrending(data || []);
    };
    fetchTrending();
  }, []);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from("contents")
      .select("*")
      .eq("status", "approved")
      .ilike("title", `%${searchQuery}%`)
      .limit(24);
    
    setResults(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-32 px-6 md:px-12 lg:px-24 pb-20">
      {/* Search Header */}
      <div className="max-w-4xl mx-auto mb-16 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase">
            Cari Konten <span className="text-red-600">Favorit</span>
          </h1>
          <p className="text-gray-500 font-bold tracking-widest text-xs uppercase">
            Cari ribuan film, drakor, dan anime secara instan
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-indigo-600 rounded-[2rem] blur opacity-20 group-focus-within:opacity-40 transition duration-500" />
          <div className="relative flex items-center bg-white/5 border border-white/10 rounded-[2rem] px-8 py-6 backdrop-blur-3xl">
            <SearchIcon className="text-gray-500 mr-4" size={24} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik judul film, series, atau aktor..."
              className="bg-transparent border-none outline-none text-white text-xl md:text-2xl font-bold w-full placeholder:text-gray-700"
            />
            {query && (
              <button onClick={() => setQuery("")} className="p-2 hover:bg-white/10 rounded-full transition-all">
                <X size={20} className="text-gray-400" />
              </button>
            )}
            {loading && <Loader2 className="animate-spin text-red-600 ml-4" size={24} />}
          </div>
        </motion.div>
      </div>

      {/* Results or Trending */}
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {query.trim() === "" ? (
            <motion.div
              key="trending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-red-500" />
                <h2 className="text-xl font-black uppercase tracking-widest text-white">Sedang Populer</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {trending.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <MovieCard item={item} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles size={20} className="text-yellow-500" />
                  <h2 className="text-xl font-black uppercase tracking-widest text-white">Hasil Pencarian</h2>
                </div>
                <p className="text-gray-500 font-bold text-sm">{results.length} ditemukan</p>
              </div>

              {results.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {results.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <MovieCard item={item} />
                    </motion.div>
                  ))}
                </div>
              ) : !loading && (
                <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                  <p className="text-gray-500 font-bold text-xl uppercase tracking-tighter">Ups! Tidak ada hasil untuk "{query}"</p>
                  <p className="text-gray-700 text-sm mt-2">Coba kata kunci lain atau periksa ejaan Anda.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
