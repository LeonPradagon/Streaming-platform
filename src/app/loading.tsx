"use client";

import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center space-y-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <Loader2 className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
      </div>
      <div className="text-white font-medium tracking-widest text-sm animate-pulse">
        LOADING<span className="animate-bounce">...</span>
      </div>
    </div>
  );
}
