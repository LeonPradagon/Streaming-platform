"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, User, Settings, LogOut, Menu, X, Play, ChevronDown, Globe, Film } from "lucide-react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SearchModal from "./SearchModal";

const GENRES = [
  "Aksi", "Petualangan", "Animasi", "Komedi", "Kejahatan", "Dokumenter", "Drama", "Keluarga", "Fantasi", "Sejarah", "Horor", "Musik", "Misteri", "Romansa", "Sci-Fi", "Thriller", "War"
];

const COUNTRIES = [
  { name: "Korea", code: "KR" },
  { name: "China", code: "CN" },
  { name: "Jepang", code: "JP" },
  { name: "Thailand", code: "TH" },
  { name: "Indonesia", code: "ID" },
  { name: "Barat", code: "US" },
];

export default function Navbar({ brandName }: { brandName: string }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [pathname]);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Movies", path: "/browse?type=movie" },
    { name: "TV Shows", path: "/browse?type=tv" },
    { name: "Trending", path: "/trending" },
  ];

  return (
    <>
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <nav
          className={`pointer-events-auto transition-all duration-500 w-full max-w-[1400px] flex items-center justify-between px-4 md:px-8 py-2.5 rounded-full ${
            isScrolled
              ? "bg-[#141414]/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/10"
              : "bg-transparent border-transparent shadow-none"
          }`}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group mr-4 md:mr-12">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg shadow-red-500/30">
              <Play className="text-white ml-1" size={16} fill="currentColor" />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tighter text-white group-hover:text-red-500 transition-colors uppercase italic">
              {brandName || "Netix"}
            </span>
          </Link>

          {/* Desktop Navigation Grouping */}
          <div className="hidden lg:flex items-center justify-between flex-1">
            <div className="flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.path || (pathname === "/" && link.path === "/");
                return (
                  <Link
                    key={link.name}
                    href={link.path}
                    className={`text-[14px] font-bold transition-all px-4 py-2 rounded-full uppercase tracking-tight ${
                      isActive
                        ? "bg-white text-black shadow-sm"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}

              {/* Genres Dropdown */}
              <div className="relative group/dropdown">
                <button
                  onMouseEnter={() => setActiveDropdown('genres')}
                  className={`flex items-center gap-1.5 text-[14px] font-bold transition-all px-4 py-2 rounded-full uppercase tracking-tight ${
                    activeDropdown === 'genres' ? "bg-white/10 text-white" : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Genres <ChevronDown size={14} className={`transition-transform duration-300 ${activeDropdown === 'genres' ? 'rotate-180' : ''}`} />
                </button>
                
                {activeDropdown === 'genres' && (
                  <div 
                    onMouseLeave={() => setActiveDropdown(null)}
                    className="absolute top-full left-0 mt-2 w-[480px] bg-[#141414]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 grid grid-cols-3 gap-1 z-50 animate-fadeIn"
                  >
                    {GENRES.map(genre => (
                      <Link
                        key={genre}
                        href={`/browse?genre=${genre.toLowerCase()}`}
                        className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-400 hover:bg-white/10 hover:text-white rounded-lg transition-colors font-medium"
                      >
                        <Film size={12} className="opacity-50" /> {genre}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Countries Dropdown */}
              <div className="relative group/dropdown">
                <button
                  onMouseEnter={() => setActiveDropdown('countries')}
                  className={`flex items-center gap-1.5 text-[14px] font-bold transition-all px-4 py-2 rounded-full uppercase tracking-tight ${
                    activeDropdown === 'countries' ? "bg-white/10 text-white" : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Countries <ChevronDown size={14} className={`transition-transform duration-300 ${activeDropdown === 'countries' ? 'rotate-180' : ''}`} />
                </button>
                
                {activeDropdown === 'countries' && (
                  <div 
                    onMouseLeave={() => setActiveDropdown(null)}
                    className="absolute top-full left-0 mt-2 w-56 bg-[#141414]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 z-50 animate-fadeIn"
                  >
                    {COUNTRIES.map(country => (
                      <Link
                        key={country.name}
                        href={`/browse?country=${country.code.toLowerCase()}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-400 hover:bg-white/10 hover:text-white rounded-xl transition-colors font-semibold"
                      >
                        <Globe size={14} className="opacity-50" /> {country.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Icon */}
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="w-[42px] h-[42px] rounded-full bg-zinc-800/80 flex items-center justify-center text-gray-300 hover:text-white hover:bg-zinc-700 transition-colors shadow-sm border border-white/10"
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
                  <span className="text-sm font-bold uppercase tracking-tight">
                    {isLoadingAuth ? "..." : user ? "Profile" : "Login"}
                  </span>
                </button>

                {isProfileOpen && (
                  <div
                    onMouseLeave={() => setIsProfileOpen(false)}
                    className="absolute right-0 mt-3 w-56 origin-top-right z-50 pt-1"
                  >
                    <div className="bg-[#141414]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 flex flex-col gap-1 overflow-hidden font-medium">
                      {user ? (
                        <>
                          <div className="px-4 py-2 text-[11px] text-gray-500 font-bold uppercase tracking-widest border-b border-white/5 mb-1">Account</div>
                          <Link
                            href="/profile"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <User size={16} /> Dashboard
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
                              const supabase = createClient();
                              await supabase.auth.signOut();
                              window.location.reload();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-white/10 transition-colors font-bold"
                          >
                            <LogOut size={16} /> Logout
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href="/login"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors font-bold"
                          >
                            Login
                          </Link>
                          <Link
                            href="/register"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            Register
                          </Link>
                        </>
                      )}
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
              className="w-[40px] h-[40px] rounded-full bg-zinc-800/80 flex items-center justify-center text-gray-300 shadow-sm border border-white/10"
            >
              <Search size={18} strokeWidth={2.5} />
            </button>
            <button
              className="w-[40px] h-[40px] rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg cursor-pointer"
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
        <div className="fixed inset-0 z-[60] bg-[#0f0f0f]/98 backdrop-blur-2xl flex flex-col p-6 animate-fadeIn lg:hidden">
          <div className="flex justify-between items-center bg-zinc-900/80 p-3 rounded-full border border-white/10 shadow-sm">
            <Link href="/" className="flex items-center gap-2 pl-2" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                <Play className="text-white ml-1" size={16} fill="currentColor" />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white uppercase italic">
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

          <div className="flex flex-col gap-4 mt-8 max-h-[80vh] overflow-y-auto hide-scrollbar">
            <div className="flex flex-col bg-white/5 rounded-3xl p-2 border border-white/10 shadow-sm">
              {navLinks.map((link) => {
                const isActive = pathname === link.path || (pathname === "/" && link.path === "/");
                return (
                  <Link
                    key={link.name}
                    href={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`text-lg font-bold py-4 px-6 rounded-2xl transition-colors uppercase tracking-tight ${
                      isActive 
                        ? "bg-white text-black shadow-sm" 
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>

            {/* Mobile Categories Group */}
            <div className="grid grid-cols-2 gap-3 mt-2">
               <div className="flex flex-col bg-white/5 rounded-3xl p-4 border border-white/10">
                  <h3 className="text-gray-500 text-[11px] font-bold uppercase tracking-widest mb-3 px-1 text-center">Top Genres</h3>
                  <div className="flex flex-col gap-1">
                    {GENRES.slice(0, 5).map(g => (
                       <Link key={g} href={`/browse?genre=${g.toLowerCase()}`} onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-gray-300 py-1.5 hover:text-white text-center">{g}</Link>
                    ))}
                  </div>
               </div>
               <div className="flex flex-col bg-white/5 rounded-3xl p-4 border border-white/10">
                  <h3 className="text-gray-500 text-[11px] font-bold uppercase tracking-widest mb-3 px-1 text-center">Countries</h3>
                  <div className="flex flex-col gap-1">
                    {COUNTRIES.map(c => (
                       <Link key={c.name} href={`/browse?country=${c.code.toLowerCase()}`} onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-gray-300 py-1.5 hover:text-white text-center">{c.name}</Link>
                    ))}
                  </div>
               </div>
            </div>

            <Link
              href="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-4 text-xl font-bold text-white bg-red-600 rounded-3xl py-5 px-6 flex items-center justify-center gap-3 shadow-lg"
            >
              <User size={22} /> {user ? "My Dashboard" : "Login to Account"}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
