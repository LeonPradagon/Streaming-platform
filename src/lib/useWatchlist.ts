"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface WatchlistItem {
  id: string;
  title: string;
  type: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  addedAt: number;
}

export interface HistoryItem extends WatchlistItem {
  watchedAt: number;
  progress: number; // 0-100
}

const WATCHLIST_KEY = 'streaming_watchlist';
const LIKES_KEY = 'streaming_likes';
const HISTORY_KEY = 'streaming_history';

function getStorageArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStorageArray<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ==================== WATCHLIST ====================
export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    const local = getStorageArray<WatchlistItem>(WATCHLIST_KEY);
    setItems(local);
    
    // Sync from DB if logged in
    async function syncDb() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from('watchlist').select('content_id, contents(*)').eq('user_id', session.user.id);
        if (data) {
          const dbItems = (data as any[]).map(d => {
            const content = Array.isArray(d.contents) ? d.contents[0] : d.contents;
            return {
              id: content.id,
              title: content.title,
              type: content.type,
              poster_path: content.poster_path,
              vote_average: typeof content.vote_average === 'number' ? content.vote_average : parseFloat(content.vote_average || '0'),
              release_date: content.release_date,
              addedAt: new Date(content.created_at || Date.now()).getTime()
            };
          });
          setItems(dbItems);
          setStorageArray(WATCHLIST_KEY, dbItems);
        }
      }
    }
    syncDb();
  }, []);

  const isInWatchlist = useCallback((id: string) => {
    return items.some(item => item.id === id);
  }, [items]);

  const addToWatchlist = useCallback(async (item: WatchlistItem) => {
    const current = getStorageArray<WatchlistItem>(WATCHLIST_KEY);
    if (current.some(i => i.id === item.id)) return false;
    const updated = [{ ...item, addedAt: Date.now() }, ...current];
    setStorageArray(WATCHLIST_KEY, updated);
    setItems(updated);
    
    // Sync to DB
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('watchlist').upsert({ user_id: session.user.id, content_id: item.id }, { onConflict: 'user_id,content_id' });
    }
    return true;
  }, []);

  const removeFromWatchlist = useCallback(async (id: string) => {
    const current = getStorageArray<WatchlistItem>(WATCHLIST_KEY);
    const updated = current.filter(i => i.id !== id);
    setStorageArray(WATCHLIST_KEY, updated);
    setItems(updated);
    
    // Remove from DB
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('watchlist').delete().match({ user_id: session.user.id, content_id: id });
    }
  }, []);

  const toggleWatchlist = useCallback((item: WatchlistItem) => {
    if (isInWatchlist(item.id)) {
      removeFromWatchlist(item.id);
      return false; // removed
    } else {
      addToWatchlist(item);
      return true; // added
    }
  }, [isInWatchlist, addToWatchlist, removeFromWatchlist]);

  return { items, isInWatchlist, addToWatchlist, removeFromWatchlist, toggleWatchlist };
}

// ==================== LIKES ====================
export function useLikes() {
  const [likedIds, setLikedIds] = useState<string[]>([]);

  useEffect(() => {
    setLikedIds(getStorageArray<string>(LIKES_KEY));
  }, []);

  const isLiked = useCallback((id: string) => {
    return likedIds.includes(id);
  }, [likedIds]);

  const toggleLike = useCallback((id: string) => {
    const current = getStorageArray<string>(LIKES_KEY);
    let updated: string[];
    if (current.includes(id)) {
      updated = current.filter(i => i !== id);
    } else {
      updated = [id, ...current];
    }
    setStorageArray(LIKES_KEY, updated);
    setLikedIds(updated);
    return updated.includes(id);
  }, []);

  return { likedIds, isLiked, toggleLike };
}

// ==================== HISTORY ====================
export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setItems(getStorageArray<HistoryItem>(HISTORY_KEY));
  }, []);

  const addToHistory = useCallback((item: Omit<HistoryItem, 'watchedAt'>) => {
    const current = getStorageArray<HistoryItem>(HISTORY_KEY);
    // Remove existing entry for same id (we'll re-add on top)
    const filtered = current.filter(i => i.id !== item.id);
    const updated = [{ ...item, watchedAt: Date.now() }, ...filtered].slice(0, 50); // keep last 50
    setStorageArray(HISTORY_KEY, updated);
    setItems(updated);
  }, []);

  const clearHistory = useCallback(() => {
    setStorageArray(HISTORY_KEY, []);
    setItems([]);
  }, []);

  return { items, addToHistory, clearHistory };
}
