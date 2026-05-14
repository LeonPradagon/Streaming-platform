"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, User, Menu, X, Play, Flame, Compass, 
  Library, ChevronDown, Globe, Film, Star, LogOut, Settings, Tv, Radio
} from "lucide-react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { NETWORK_CONFIGS } from "@/lib/tmdb";

const GENRES = [
  { label: "Aksi", value: "Action" },
  { label: "Petualangan", value: "Adventure" },
  { label: "Animasi", value: "Animation" },
  { label: "Komedi", value: "Comedy" },
  { label: "Kejahatan", value: "Crime" },
  { label: "Dokumenter", value: "Documentary" },
  { label: "Drama", value: "Drama" },
  { label: "Keluarga", value: "Family" },
  { label: "Fantasi", value: "Fantasy" },
  { label: "Sejarah", value: "History" },
  { label: "Horor", value: "Horror" },
  { label: "Musik", label_id: "Music", value: "Music" },
  { label: "Misteri", value: "Mystery" },
  { label: "Romansa", value: "Romance" },
  { label: "Sci-Fi", value: "Science Fiction" },
  { label: "Thriller", value: "Thriller" },
  { label: "War", value: "War" }
];

const COUNTRIES = [
  { name: "Korea", code: "KR" },
  { name: "China", code: "CN" },
  { name: "Jepang", code: "JP" },
  { name: "Thailand", code: "TH" },
  { name: "Indonesia", code: "ID" },
  { name: "Barat", code: "US" },
];

export default function Navbar({ brandName = "NETIX" }: { brandName?: string }) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const { scrollY } = useScroll();
  const supabase = createClient();

  // Split title for dual-tone (Logo)
  const titleParts = brandName.split(" ");
  const firstPart = titleParts[0];
  const secondPart = titleParts.slice(1).join(" ");

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest > previous && latest > 150) {
      setIsHidden(true);
    } else {
      setIsHidden(false);
    }
    setIsScrolled(latest > 50);
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const navLinks = [
    { name: "Home", href: "/", icon: <Play size={18} /> },
    { name: "Trending", href: "/trending", icon: <Flame size={18} /> },
    { name: "Browse", href: "/browse", icon: <Compass size={18} /> },
  ];

  return (
    <>
      <motion.nav
        variants={{
          visible: { y: 0, opacity: 1 },
          hidden: { y: -100, opacity: 0 },
        }}
        animate={isHidden ? "hidden" : "visible"}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ${
          isScrolled ? "py-3 px-4 md:px-12" : "py-6 px-4 md:px-16"
        }`}
      >
        <div className={`max-w-7xl mx-auto transition-all duration-700 rounded-2xl md:rounded-full ${
          isScrolled 
            ? "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] px-6" 
            : "bg-transparent px-0"
        } flex items-center justify-between h-16`}>
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(229,9,20,0.4)] group-hover:scale-110 transition-transform duration-500">
              <Play fill="white" className="text-white ml-0.5" size={20} />
            </div>
            <span className="text-2xl font-black text-white tracking-tighter hidden sm:block">
              {firstPart}<span className="text-red-600">{secondPart ? ` ${secondPart}` : ""}</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`relative px-4 py-2 rounded-full text-[13px] font-black uppercase tracking-wider transition-all duration-300 ${
                  pathname === link.href ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {pathname === link.href && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-white/10 rounded-full border border-white/10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{link.name}</span>
              </Link>
            ))}

            {/* Genres Dropdown */}
            <div className="relative" onMouseLeave={() => setActiveDropdown(null)}>
              <button
                onMouseEnter={() => setActiveDropdown("genres")}
                className="px-4 py-2 text-[13px] font-black uppercase tracking-wider text-gray-400 hover:text-white flex items-center gap-1 transition-all"
              >
                Genres <ChevronDown size={14} className={`transition-transform duration-300 ${activeDropdown === "genres" ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {activeDropdown === "genres" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 w-[480px] pt-3 z-50 pointer-events-auto"
                  >
                    <div className="bg-black/90 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl p-4 grid grid-cols-3 gap-1">
                    {GENRES.map(genre => (
                      <Link
                        key={genre.value}
                        href={`/browse?genre=${genre.value}`}
                        className="flex items-center gap-3 px-4 py-3 text-[13px] text-gray-400 hover:bg-white/10 hover:text-white rounded-xl transition-all font-bold group/item"
                        onClick={() => setActiveDropdown(null)}
                      >
                        <Film size={14} className="opacity-40 group-hover/item:opacity-100 transition-opacity" /> {genre.label}
                      </Link>
                    ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Network Dropdown */}
            <div className="relative" onMouseLeave={() => setActiveDropdown(null)}>
              <button
                onMouseEnter={() => setActiveDropdown("network")}
                className={`px-4 py-2 text-[13px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                  pathname.startsWith("/network") ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Network <ChevronDown size={14} className={`transition-transform duration-300 ${activeDropdown === "network" ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {activeDropdown === "network" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full -left-20 w-[420px] pt-3 z-50 pointer-events-auto"
                  >
                    <div className="bg-black/90 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl p-4 space-y-1">
                      {NETWORK_CONFIGS.map(net => (
                        <Link
                          key={net.slug}
                          href={`/network/${net.slug}`}
                          className="flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-white/5 transition-all group/net"
                          onClick={() => setActiveDropdown(null)}
                        >
                          {/* Brand color indicator */}
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg transition-transform group-hover/net:scale-110"
                            style={{ backgroundColor: net.color, boxShadow: `0 0 20px ${net.color}40` }}
                          >
                            {net.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-black text-white uppercase tracking-wide">{net.name}</div>
                            <div className="text-[10px] text-gray-500 font-medium truncate">{net.description}</div>
                          </div>
                          <ChevronDown size={14} className="text-gray-600 -rotate-90 group-hover/net:text-white transition-colors shrink-0" />
                        </Link>
                      ))}
                      <div className="border-t border-white/5 pt-2 mt-2">
                        <Link
                          href="/network"
                          className="flex items-center justify-center gap-2 px-4 py-3 text-[11px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-all hover:bg-white/5 rounded-xl"
                          onClick={() => setActiveDropdown(null)}
                        >
                          <Radio size={12} /> Lihat Semua Network
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-2 md:gap-4">
            <Link 
              href="/search" 
              className="p-2.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-90"
            >
              <Search size={20} strokeWidth={2.5} />
            </Link>
            


            {user ? (
              <div className="relative" onMouseEnter={() => setActiveDropdown('profile')} onMouseLeave={() => setActiveDropdown(null)}>
                <button className="flex items-center gap-2 group p-1">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-indigo-600 p-[2px] transition-transform group-hover:scale-105">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                      <User size={18} className="text-white" />
                    </div>
                  </div>
                </button>
                <AnimatePresence>
                  {activeDropdown === 'profile' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full right-0 mt-2 w-56 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-1.5"
                    >
                      <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-gray-400 hover:bg-white/10 hover:text-white rounded-xl transition-all">
                        <User size={16} /> My Profile
                      </Link>
                      <Link href="/profile?tab=settings" className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-gray-400 hover:bg-white/10 hover:text-white rounded-xl transition-all">
                        <Settings size={16} /> Settings
                      </Link>
                      <div className="h-px bg-white/5 my-1" />
                      <button 
                        onClick={() => supabase.auth.signOut()}
                        className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <LogOut size={16} /> Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link 
                href="/login" 
                className="bg-white text-black px-6 py-2.5 rounded-full text-[13px] font-black hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] uppercase tracking-widest"
              >
                Login
              </Link>
            )}

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2.5 rounded-full bg-white/5 text-white transition-all active:scale-90"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[95] bg-black md:hidden flex flex-col pt-32 px-8 gap-4 overflow-y-auto pb-32"
          >
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center justify-between p-6 rounded-3xl border text-xl font-black uppercase tracking-tighter ${
                  pathname === link.href ? "bg-red-600 border-red-500 text-white shadow-2xl shadow-red-600/30" : "bg-white/5 border-white/10 text-gray-400"
                }`}
              >
                {link.name}
                {link.icon}
              </Link>
            ))}

            {/* Network Section - Mobile */}
            <div className="mt-6">
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4 ml-2">Network</h4>
              <div className="grid grid-cols-2 gap-2">
                {NETWORK_CONFIGS.map(net => (
                  <Link
                    key={net.slug}
                    href={`/network/${net.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl active:scale-95 transition-all"
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0"
                      style={{ backgroundColor: net.color }}
                    >
                      {net.name.charAt(0)}
                    </div>
                    <span className="text-[11px] font-black uppercase text-gray-300 tracking-wide truncate">{net.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Genres Section - Mobile */}
            <div className="mt-6">
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4 ml-2">Pilih Genre</h4>
              <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[30vh] pr-2 custom-scrollbar">
                {GENRES.map(genre => (
                  <Link
                    key={genre.value}
                    href={`/browse?genre=${genre.value}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 p-4 bg-white/5 border border-white/5 rounded-2xl text-[11px] font-black uppercase text-gray-400 active:bg-red-600 active:text-white transition-all"
                  >
                    <Film size={12} /> {genre.label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
