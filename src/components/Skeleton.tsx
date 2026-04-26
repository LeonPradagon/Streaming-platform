import React from 'react';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/5 rounded-md ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="flex flex-col w-full gap-3">
      <Skeleton className="w-full aspect-[2/3] rounded-2xl border border-white/5" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function RowSkeleton({ title }: { title?: string }) {
  return (
    <div className="py-8 space-y-6">
      {title && <Skeleton className="h-8 w-48 ml-4 md:ml-12" />}
      <div className="flex gap-4 overflow-hidden px-4 md:px-12">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="min-w-[160px] md:min-w-[220px] lg:min-w-[240px]">
            <CardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[60vh] md:h-[85vh] bg-[#0a0a0a]">
      <div className="absolute inset-0 flex items-center px-6 md:px-16 lg:px-24">
        <div className="max-w-3xl space-y-6">
          <Skeleton className="h-12 w-64 md:w-96" />
          <Skeleton className="h-24 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-14 w-40 rounded-xl" />
            <Skeleton className="h-14 w-40 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
