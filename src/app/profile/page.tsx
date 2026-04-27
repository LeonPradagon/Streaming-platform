"use client";

import { useSearchParams } from 'next/navigation';
import { User, Play, List, Settings, LogOut, ChevronRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, Suspense, useEffect } from 'react';
import MovieCard from '@/components/MovieCard';
import { useWatchlist, useHistory, WatchlistItem, HistoryItem } from '@/lib/useWatchlist';
import { showToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';

function ProfileContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'history';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [emailNotif, setEmailNotif] = useState(true);
  const [quality, setQuality] = useState('auto');
  const [displayName, setDisplayName] = useState('Anonymous');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || '');
        setDisplayName(session.user.user_metadata?.full_name || 'Member');
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', session.user.id)
          .single();
          
        if (profile?.preferences) {
          if (profile.preferences.emailNotif !== undefined) setEmailNotif(profile.preferences.emailNotif);
          if (profile.preferences.quality !== undefined) setQuality(profile.preferences.quality);
        }
      }
      setIsLoadingAuth(false);
    }
    loadProfile();
  }, []);

  const { items: watchlistItems, removeFromWatchlist } = useWatchlist();
  const { items: historyItems, clearHistory } = useHistory();

  // Convert localStorage items to MovieCard-compatible format
  const toCardItem = (item: WatchlistItem | HistoryItem) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    metadata: {
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      release_date: item.release_date,
      first_air_date: item.first_air_date,
    },
  });

  const handleSaveSettings = async () => {
    if (userId) {
      const supabase = createClient();
      await supabase.from('profiles').update({
        preferences: { emailNotif, quality }
      }).eq('id', userId);
    }
    showToast('Pengaturan berhasil disimpan!', 'success');
  };

  const handleClearHistory = () => {
    clearHistory();
    showToast('Riwayat tontonan dihapus', 'info');
  };

  return (
    <div className="min-h-screen pt-28 px-4 md:px-12 lg:px-20 animate-fade-in pb-20 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
        
        {/* Sidebar Profile */}
        <aside className="glass p-6 md:p-8 rounded-2xl h-fit border border-white/5">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center p-1 mb-4 shadow-xl shadow-primary/20">
               <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
                 <User size={40} className="text-white" />
               </div>
            </div>
            <h2 className="text-2xl font-black text-white">{displayName}</h2>
            <p className="text-primary font-bold text-sm mt-1">{userId ? (displayName === 'Admin' ? 'Super Admin' : 'Premium Member') : "Guest Mode"}</p>
            <p className="text-gray-400 text-xs mt-2">{userId ? "Member since 2024" : "Local Storage"}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{historyItems.length}</p>
              <p className="text-[11px] text-gray-400 font-semibold">Ditonton</p>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{watchlistItems.length}</p>
              <p className="text-[11px] text-gray-400 font-semibold">Daftar Saya</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex items-center justify-between px-4 py-3 rounded-lg font-semibold transition ${activeTab === 'history' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
            >
              <div className="flex items-center gap-3"><Play size={18}/> Riwayat Tonton</div>
              {activeTab === 'history' && <ChevronRight size={16}/>}
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`flex items-center justify-between px-4 py-3 rounded-lg font-semibold transition ${activeTab === 'list' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
            >
              <div className="flex items-center gap-3"><List size={18}/> Daftar Saya</div>
              {activeTab === 'list' && <ChevronRight size={16}/>}
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex items-center justify-between px-4 py-3 rounded-lg font-semibold transition ${activeTab === 'settings' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
            >
              <div className="flex items-center gap-3"><Settings size={18}/> Pengaturan</div>
              {activeTab === 'settings' && <ChevronRight size={16}/>}
            </button>
          </div>
          
          <div className="mt-12 pt-6 border-t border-white/10">
            {userId ? (
              <button 
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  showToast('Anda telah keluar', 'info');
                  window.location.reload();
                }}
                className="flex items-center gap-3 px-4 py-3 text-red-500 font-bold hover:bg-red-500/10 rounded-lg w-full transition"
              >
                <LogOut size={18} /> Keluar Akun
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <Link 
                  href="/login"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg w-full transition"
                >
                  Masuk Akun
                </Link>
                <Link 
                  href="/register"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-red-700 text-white font-bold rounded-lg w-full transition shadow-lg shadow-primary/20"
                >
                  Daftar Sekarang
                </Link>
              </div>
            )}
          </div>
        </aside>

        {/* Content Area */}
        <section className="bg-white/5 border border-white/5 rounded-2xl p-6 md:p-10">
          
          {activeTab === 'history' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3"><Play className="text-primary"/> Riwayat Terakhir Ditonton</h2>
                {historyItems.length > 0 && (
                  <button 
                    onClick={handleClearHistory}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 font-semibold transition"
                  >
                    <Trash2 size={14} /> Hapus Semua
                  </button>
                )}
              </div>
              {historyItems.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {historyItems.map((item) => (
                    <MovieCard 
                      key={item.id} 
                      item={toCardItem(item)} 
                      progress={(item as HistoryItem).progress} 
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Play size={40} className="text-gray-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Belum Ada Riwayat</h3>
                  <p className="text-gray-400 max-w-md mb-8">Anda belum menonton film atau series apapun. Mulai jelajahi koleksi kami!</p>
                  <Link href="/browse" className="bg-white text-black font-bold px-8 py-3 rounded-lg hover:bg-gray-200 transition">
                    Jelajahi Film
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === 'list' && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><List className="text-primary"/> Daftar Saya</h2>
              {watchlistItems.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {watchlistItems.map((item) => (
                    <div key={item.id} className="relative group/card">
                      <MovieCard item={toCardItem(item)} />
                      <button
                        onClick={() => {
                          removeFromWatchlist(item.id);
                          showToast(`"${item.title}" dihapus dari daftar`, 'info');
                        }}
                        className="absolute top-2 left-2 z-30 bg-red-600 text-white p-1 rounded-md opacity-0 group-hover/card:opacity-100 transition-opacity"
                        title="Hapus dari daftar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                    <List size={40} className="text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Daftar Anda Kosong</h3>
                  <p className="text-gray-400 max-w-md mb-8">Anda belum menambahkan film atau series ke daftar Anda. Temukan sesuatu yang bagus untuk ditonton!</p>
                  <Link href="/browse" className="bg-white text-black font-bold px-8 py-3 rounded-lg hover:bg-gray-200 transition">
                    Cari Film
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-fade-in max-w-2xl">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3"><Settings className="text-primary"/> Pengaturan Akun</h2>
              
              {!isLoadingAuth && !userId ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <Settings size={48} className="text-gray-500 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Login Diperlukan</h3>
                  <p className="text-gray-400 max-w-sm mb-6">Anda sedang menggunakan mode Anonymous. Silakan login untuk menyimpan pengaturan dan sinkronisasi antar perangkat.</p>
                  <div className="flex gap-4">
                    <Link href="/login" className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition">Login</Link>
                    <Link href="/register" className="px-6 py-2.5 bg-primary hover:bg-red-700 text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition">Daftar</Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-gray-400 font-bold uppercase tracking-wider">Nama Tampilan</label>
                    <input 
                      type="text" 
                      value={displayName} 
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition" 
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-gray-400 font-bold uppercase tracking-wider">Email Utama</label>
                    <input type="email" value={userEmail || "Memuat..."} disabled className="bg-black/80 border border-white/5 rounded-lg px-4 py-3 text-gray-500 cursor-not-allowed" />
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-lg font-bold mb-4">Preferensi</h3>
                    <div className="flex items-center justify-between p-4 glass rounded-lg mb-3">
                      <div>
                        <p className="font-bold">Notifikasi Email</p>
                        <p className="text-sm text-gray-400">Terima update tentang film terbaru</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEmailNotif(!emailNotif);
                          showToast(emailNotif ? 'Notifikasi email dinonaktifkan' : 'Notifikasi email diaktifkan', 'success');
                        }}
                        className={`w-12 h-6 rounded-full relative transition-colors ${emailNotif ? 'bg-primary' : 'bg-gray-600'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${emailNotif ? 'right-0.5' : 'left-0.5'}`}></div>
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 glass rounded-lg">
                      <div>
                        <p className="font-bold">Kualitas Streaming Default</p>
                        <p className="text-sm text-gray-400">Pilih resolusi otomatis untuk video</p>
                      </div>
                      <select 
                        value={quality}
                        onChange={(e) => {
                          setQuality(e.target.value);
                          showToast(`Kualitas diubah ke ${e.target.value === 'auto' ? 'Otomatis' : e.target.value}`, 'success');
                        }}
                        className="bg-black border border-white/20 rounded-md px-3 py-1 font-semibold text-sm outline-none text-white"
                      >
                        <option value="auto">Otomatis</option>
                        <option value="1080p">1080p</option>
                        <option value="720p">720p</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button 
                      onClick={handleSaveSettings}
                      className="bg-primary text-white font-bold px-8 py-3 rounded-lg hover:bg-red-700 transition"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </section>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen pt-28 px-4 md:px-12 lg:px-20 flex items-center justify-center">
        <div className="skeleton w-full max-w-4xl h-96 rounded-2xl"></div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
