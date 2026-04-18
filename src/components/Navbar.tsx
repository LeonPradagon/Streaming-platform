"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Play, Search, Bell, User, Settings, LogOut, ChevronDown, Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export default function Navbar({ brandName }: { brandName: string }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Movies', path: '/browse?type=movie' },
    { name: 'Series', path: '/browse?type=tv' },
    { name: 'My List', path: '/profile?tab=list' },
    { name: 'Browse', path: '/browse' },
  ];

  // Mock notifications
  const notifications = [
    { id: 1, text: 'Film baru ditambahkan: One Piece', time: '2 jam lalu' },
    { id: 2, text: 'Episode baru tersedia untuk Naruto', time: '5 jam lalu' },
    { id: 3, text: 'Rekomendasi untuk Anda: Attack on Titan', time: '1 hari lalu' },
  ];

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'glass-nav py-4' : 'bg-gradient-to-b from-black/80 to-transparent py-6'
        } px-4 md:px-8 lg:px-12 flex items-center justify-between`}
      >
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary p-1.5 rounded-full text-black group-hover:scale-110 transition-transform">
              <Play size={20} fill="currentColor" />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tight uppercase">
              {brandName.split(' ')[0]}
              <span className="text-primary">{brandName.split(' ')[1] || ''}</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.path}
                className={`text-sm font-semibold transition-colors hover:text-white ${
                  pathname === link.path || (pathname === '/' && link.path === '/') 
                    ? 'text-white' 
                    : 'text-text-muted'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Search */}
          <div className="relative flex items-center">
            <form 
              onSubmit={handleSearch}
              className={`flex items-center overflow-hidden transition-all duration-300 ease-in-out border border-white/20 bg-black/40 rounded-full ${
                isSearchOpen ? 'w-48 sm:w-64 px-4 opacity-100 mr-2' : 'w-0 opacity-0 border-transparent mr-0'
              }`}
            >
              <Search size={16} className="text-gray-400 min-w-[16px]" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Judul, genre..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="bg-transparent border-none outline-none text-sm text-white px-3 py-2 w-full placeholder:text-gray-500"
                onBlur={() => {
                  setTimeout(() => setIsSearchOpen(false), 300);
                }}
              />
            </form>
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`text-white transition-opacity ${isSearchOpen ? 'hidden' : 'block'}`}
            >
              <Search size={20} />
            </button>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button 
              className="text-white relative"
              onClick={() => { setIsNotifOpen(!isNotifOpen); setIsProfileOpen(false); }}
              onBlur={() => setTimeout(() => setIsNotifOpen(false), 200)}
            >
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 bg-primary text-[10px] font-bold text-white w-4 h-4 rounded-full flex items-center justify-center">
                {notifications.length}
              </span>
            </button>

            {/* Notification Dropdown */}
            <div className={`absolute right-0 mt-3 w-72 bg-card border border-white/10 rounded-xl shadow-2xl py-2 transition-all origin-top-right z-50 ${
              isNotifOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}>
              <div className="px-4 py-2 border-b border-white/5 mb-1">
                <p className="text-sm font-bold text-white">Notifikasi</p>
              </div>
              {notifications.map(notif => (
                <div key={notif.id} className="px-4 py-3 hover:bg-white/5 cursor-pointer transition">
                  <p className="text-sm text-gray-200 leading-snug">{notif.text}</p>
                  <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                </div>
              ))}
              <div className="px-4 pt-2 pb-1 border-t border-white/5 mt-1">
                <button className="text-xs text-primary font-bold hover:underline w-full text-center py-1">
                  Tandai semua sudah dibaca
                </button>
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="relative hidden sm:block">
            <button 
              className="flex items-center gap-2"
              onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotifOpen(false); }}
              onBlur={() => setTimeout(() => setIsProfileOpen(false), 200)}
            >
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center overflow-hidden">
                <User size={18} className="text-white" />
              </div>
              <ChevronDown size={14} className={`text-white transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown */}
            <div className={`absolute right-0 mt-3 w-48 bg-card border border-white/10 rounded-xl shadow-2xl py-2 transition-all origin-top-right z-50 ${
              isProfileOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}>
              <div className="px-4 py-2 border-b border-white/5 mb-2">
                <p className="text-sm font-bold text-white">User Account</p>
              </div>
              <Link href="/profile" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5">
                <User size={16} /> Profil
              </Link>
              <Link href="/profile?tab=list" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5">
                <Play size={16} /> Daftar Saya
              </Link>
              <Link href="/profile?tab=settings" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5">
                <Settings size={16} /> Pengaturan
              </Link>
              <div className="h-px bg-white/5 my-2"></div>
              <button 
                onClick={() => {
                  // Clear session data
                  localStorage.removeItem('streaming_watchlist');
                  localStorage.removeItem('streaming_likes');
                  localStorage.removeItem('streaming_history');
                  window.location.href = '/';
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-white/5"
              >
                <LogOut size={16} /> Keluar
              </button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-white ml-2" 
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col p-6 animate-fade-in md:hidden">
          <div className="flex justify-end">
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-white bg-white/10 p-2 rounded-full">
              <X size={24} />
            </button>
          </div>
          
          <div className="flex flex-col gap-6 mt-8">
            {/* Mobile Search */}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
                setIsMobileMenuOpen(false);
                setSearchQuery('');
              }
            }} className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari film, series, anime..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3 text-white placeholder:text-gray-500 text-base focus:outline-none focus:border-primary"
              />
            </form>

            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/10">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <User size={24} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-lg text-white">User Account</p>
                <Link href="/profile" className="text-sm text-gray-400 hover:text-primary" onClick={() => setIsMobileMenuOpen(false)}>
                  Lihat Profil
                </Link>
              </div>
            </div>

            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.path}
                className="text-2xl font-bold text-gray-300 hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            
            <div className="h-px bg-white/10 my-4"></div>
            
            <Link 
              href="/profile?tab=settings"
              className="text-xl font-bold text-gray-300 hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Pengaturan
            </Link>
            <button 
              className="text-xl font-bold text-red-500 text-left"
              onClick={() => {
                localStorage.removeItem('streaming_watchlist');
                localStorage.removeItem('streaming_likes');
                localStorage.removeItem('streaming_history');
                window.location.href = '/';
              }}
            >
              Keluar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
