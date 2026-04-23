"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Plus, User } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", path: "/", icon: Home },
    { name: "Search", path: "/browse", icon: Search },
    { name: "My List", path: "/profile?tab=watchlist", icon: Plus },
    { name: "Profile", path: "/profile", icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-white/10 px-6 py-3 flex justify-between items-center pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon;
        // Check if path matches (exact for home, startsWith for others)
        const isActive = item.path === "/" 
          ? pathname === "/" 
          : pathname.startsWith(item.path.split("?")[0]);

        return (
          <Link
            key={item.name}
            href={item.path}
            className={`flex flex-col items-center gap-1 transition-colors ${
              isActive ? "text-primary" : "text-gray-400 hover:text-white"
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-bold">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
