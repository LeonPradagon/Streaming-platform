"use client";

import { useState, useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

let toastListeners: ((toast: ToastMessage) => void)[] = [];

// Global function to show toast from anywhere
export function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  const toast: ToastMessage = { id: Date.now().toString(), text, type };
  toastListeners.forEach(fn => fn(toast));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 3000);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] flex flex-col gap-3">
      {toasts.map(toast => (
        <div 
          key={toast.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-xl animate-fade-in text-sm font-bold ${
            toast.type === 'success' 
              ? 'bg-green-600/90 border-green-500/40 text-white' 
              : toast.type === 'error'
              ? 'bg-red-600/90 border-red-500/40 text-white'
              : 'bg-white/10 border-white/20 text-white'
          }`}
        >
          {toast.type === 'success' && <Check size={18} />}
          {toast.type === 'error' && <X size={18} />}
          <span>{toast.text}</span>
          <button 
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="ml-2 opacity-60 hover:opacity-100 transition"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
