"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getTMDBImageUrl } from '@/lib/tmdb';
import Link from 'next/link';
import Image from 'next/image';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}



export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'unset';
      setQuery('');
      setResults([]);
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      
      setLoading(true);
      
      // Sanitize query to prevent LIKE wildcard abuse
      const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
      
      const { data } = await supabase
        .from('contents')
        .select('*')
        .eq('status', 'approved')
        .ilike('title', `%${sanitizedQuery}%`)
        .order('created_at', { ascending: false })
        .limit(8);
        
      setResults(data || []);
      setLoading(false);
    };

    const debounceTimer = setTimeout(() => {
      fetchResults();
    }, 400);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/browse?q=${encodeURIComponent(query.trim())}`);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col"
        >
          {/* Header Search */}
          <div className="pt-8 md:pt-16 px-6 md:px-12 lg:px-24 flex items-center border-b border-white/10 pb-6 relative z-10">
            <Search className="text-gray-400 w-8 h-8 md:w-10 md:h-10" />
            <form onSubmit={handleSubmit} className="flex-1 px-4">
              <input
                ref={inputRef}
                type="text"
                placeholder="Cari judul, genre, pemeran..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border-none text-2xl md:text-5xl text-white font-bold outline-none placeholder:text-gray-600"
              />
            </form>
            <button 
              onClick={onClose}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
            >
              <X className="w-8 h-8 text-white group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-24 py-8">
            {loading ? (
              <div className="flex justify-center items-center mt-20 text-primary">
                <Loader2 className="w-12 h-12 animate-spin" />
              </div>
            ) : results.length > 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6"
              >
                {results.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group"
                  >
                    <Link href={`/watch/${item.id}`} onClick={onClose} className="block relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-white/5 group-hover:border-primary/50 transition-colors">
                      <div className="relative w-full h-full">
                        <Image 
                          src={getTMDBImageUrl(item.poster_path || item.metadata?.poster_path, 'w500')} 
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                        <div className="bg-primary text-white p-3 rounded-full scale-50 group-hover:scale-100 transition-transform duration-300">
                          <Play fill="currentColor" />
                        </div>
                      </div>
                    </Link>
                    <h3 className="mt-2 text-sm text-gray-300 font-bold truncate group-hover:text-white transition-colors">{item.title}</h3>
                    <p className="text-xs text-gray-500 uppercase">{item.type || 'Movie'}</p>
                  </motion.div>
                ))}
              </motion.div>
            ) : query.length > 0 ? (
              <div className="text-center mt-20 text-gray-500 text-xl">
                Tidak menemukan hasil untuk &quot;{query}&quot;
              </div>
            ) : (
              <div className="text-center mt-20 text-gray-600 text-lg md:text-2xl font-semibold">
                Ketikkan sesuatu untuk mencari konten favorit Anda
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
