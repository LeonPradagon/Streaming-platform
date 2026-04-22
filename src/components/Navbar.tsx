"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, User, Settings, LogOut, Menu, X, Play } from "lucide-react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SearchModal from "./SearchModal";

export default function Navbar({ brandName }: { brandName: string }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Movies", path: "/browse?type=movie" },
    { name: "TV Shows", path: "/browse?type=tv" },
    { name: "Trending", path: "/trending" },
    { name: "My List", path: "/profile?tab=watchlist" },
  ];

  return (
    <>
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav
          className={`pointer-events-auto transition-all duration-500 w-full max-w-[1200px] flex items-center justify-between px-4 md:px-6 py-2.5 rounded-full ${
            isScrolled
              ? "bg-[#141414]/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/10"
              : "bg-transparent border-transparent shadow-none"
          }`}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group mr-4 md:mr-8">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg shadow-red-500/30">
              <Play className="text-white ml-1" size={16} fill="currentColor" />
            </div>
            <span className="text-xl md:text-2xl font-bold tracking-tight text-white group-hover:text-red-500 transition-colors">
              {brandName || "Netix"}
            </span>
          </Link>

          {/* Desktop Navigation Grouping */}
          <div className="hidden lg:flex items-center justify-between flex-1">
            <div className="flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.path ||
                  (pathname === "/" && link.path === "/");
                return (
                  <Link
                    key={link.name}
                    href={link.path}
                    className={`text-[15px] font-medium transition-all px-4 py-2 rounded-full ${
                      isActive
                        ? "bg-white text-black shadow-sm font-semibold"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {/* Search Icon */}
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="w-[38px] h-[38px] rounded-full bg-zinc-800/80 flex items-center justify-center text-gray-300 hover:text-white hover:bg-zinc-700 transition-colors shadow-sm border border-white/10"
              >
                <Search size={18} strokeWidth={2.5} />
              </button>

              {/* Profile Button */}
              <div className="relative group">
                <button
                  className="flex items-center gap-2 outline-none bg-red-600 text-white px-5 py-2.5 rounded-full hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 transform hover:scale-[1.02]"
                  onMouseEnter={() => setIsProfileOpen(true)}
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                >
                  <User size={16} />
                  <span className="text-sm font-semibold tracking-wide">Profile</span>
                </button>

                {isProfileOpen && (
                  <div
                    onMouseLeave={() => setIsProfileOpen(false)}
                    className="absolute right-0 mt-3 w-48 origin-top-right z-50 pt-1"
                  >
                    <div className="bg-[#141414]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 flex flex-col gap-1 overflow-hidden font-medium">
                      <Link
                        href="/profile"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <User size={16} /> Profile
                      </Link>
                      <Link
                        href="/profile?tab=settings"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <Settings size={16} /> Settings
                      </Link>
                      <div className="h-px bg-white/10 my-1"></div>
                      <button
                        onClick={async () => {
                          localStorage.removeItem("streaming_watchlist");
                          const supabase = createClient();
                          await supabase.auth.signOut();
                          window.location.href = "/";
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-white/10 transition-colors"
                      >
                        <LogOut size={16} /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Menu Toggle & Right Area */}
          <div className="flex lg:hidden items-center gap-3">
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="w-[38px] h-[38px] rounded-full bg-zinc-800/80 flex items-center justify-center text-gray-300 shadow-sm border border-white/10"
            >
              <Search size={18} strokeWidth={2.5} />
            </button>
            <button
              className="w-[38px] h-[38px] rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg cursor-pointer"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={18} />
            </button>
          </div>
        </nav>
      </div>

      {/* Search Modal Component */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-[#0f0f0f]/95 backdrop-blur-xl flex flex-col p-6 animate-fadeIn lg:hidden">
          <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-full border border-white/10 shadow-sm">
            <Link href="/" className="flex items-center gap-2 pl-2" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                <Play className="text-white ml-1" size={16} fill="currentColor" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">
                {brandName || "Netix"}
              </span>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-3 mt-8 max-h-[80vh] overflow-y-auto hide-scrollbar">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSearchModalOpen(true);
              }}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex items-center gap-3 text-gray-400 shadow-sm backdrop-blur-sm"
            >
              <Search size={20} />
              <span className="text-lg font-medium text-left flex-1">Search movies & shows...</span>
            </button>

            <div className="flex flex-col mt-4 bg-white/5 rounded-3xl p-2 border border-white/10 shadow-sm backdrop-blur-md">
              {navLinks.map((link) => {
                const isActive = pathname === link.path || (pathname === "/" && link.path === "/");
                return (
                  <Link
                    key={link.name}
                    href={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`text-lg font-semibold py-4 px-6 rounded-2xl transition-colors ${
                      isActive 
                        ? "bg-white text-black shadow-sm my-1" 
                        : "text-gray-300 hover:text-white hover:bg-white/10 my-1"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>

            <Link
              href="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-4 text-xl font-bold text-white bg-red-600 rounded-3xl py-5 px-6 flex items-center justify-center gap-3 shadow-lg transform active:scale-95 transition-transform"
            >
              <User size={22} /> Go to Profile
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
