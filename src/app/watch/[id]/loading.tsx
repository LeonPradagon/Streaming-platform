import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] pt-20 md:pt-24 pb-20">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-10">
        {/* Player Skeleton */}
        <div className="aspect-video w-full bg-white/5 rounded-3xl animate-pulse mb-8" />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-10 w-2/3 bg-white/5 rounded-xl animate-pulse" />
            <div className="flex gap-4">
              <div className="h-6 w-20 bg-white/5 rounded-md animate-pulse" />
              <div className="h-6 w-20 bg-white/5 rounded-md animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-white/5 rounded-md animate-pulse" />
              <div className="h-4 w-full bg-white/5 rounded-md animate-pulse" />
              <div className="h-4 w-2/3 bg-white/5 rounded-md animate-pulse" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-8 w-40 bg-white/5 rounded-xl animate-pulse" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 w-full bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
