import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen pt-28 px-4 md:px-12 lg:px-20 animate-fade-in relative z-10 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-4 w-full md:w-auto">
          <div className="h-10 md:h-14 w-64 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-6 w-96 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8 mt-8">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-[2/3] w-full bg-white/5 rounded-2xl animate-pulse" />
            <div className="h-4 w-3/4 bg-white/5 rounded-md animate-pulse" />
            <div className="h-3 w-1/2 bg-white/5 rounded-md animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
