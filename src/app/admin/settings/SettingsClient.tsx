'use client';

import { useState, useTransition } from 'react';
import { 
  Globe, 
  Cpu, 
  Database,
  RefreshCw,
  Save,
  Zap,
  Info,
  Palette
} from 'lucide-react';
import { updateSettings, purgeCache } from './actions';
import { adminAlert } from '@/lib/swal';

export default function SettingsClient({ initialSiteConfig, initialScraperConfig }: { 
  initialSiteConfig: any, 
  initialScraperConfig: any 
}) {
  const [isPending, startTransition] = useTransition();

  async function handleSaveGeneral(formData: FormData) {
    startTransition(async () => {
      const title = formData.get('title') as string;
      const maintenance = formData.get('maintenance') === 'on';
      const registrations = formData.get('registrations') === 'on';
      const primaryColor = formData.get('primary_color') as string;
      const navbarColor = formData.get('navbar_color') as string;

      const result = await updateSettings('site_config', { 
        title, 
        maintenance_mode: maintenance, 
        allow_registrations: registrations,
        primary_color: primaryColor,
        navbar_color: navbarColor
      });

      if (result.success) {
        adminAlert.success('Berhasil!', 'Pengaturan umum telah diperbarui.');
      } else {
        adminAlert.error('Gagal!', result.error || 'Terjadi kesalahan saat menyimpan pengaturan.');
      }
    });
  }

  async function handleSaveScraper(formData: FormData) {
    startTransition(async () => {
      const videospider = formData.get('videospider') === 'on';
      const superembed = formData.get('superembed') === 'on';
      const autoApprove = formData.get('auto_approve') === 'on';
      const autoScrape = formData.get('auto_scrape') === 'on';
      const scraperSecret = formData.get('scraper_secret') as string;
      const discoveryPages = parseInt(formData.get('discovery_pages') as string) || 3;

      const result = await updateSettings('scraper_config', { 
        videospider_enabled: videospider, 
        superembed_enabled: superembed, 
        auto_approve: autoApprove,
        auto_scrape_enabled: autoScrape,
        scraper_secret: scraperSecret,
        discovery_pages: discoveryPages
      });

      if (result.success) {
        adminAlert.success('Berhasil!', 'Pengaturan scraper telah diperbarui.');
      } else {
        adminAlert.error('Gagal!', result.error || 'Terjadi kesalahan.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* General Settings */}
        <section className="glass p-8 rounded-3xl flex flex-col gap-8 border border-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
              <Globe size={24} className="text-yellow-500" />
            </div>
            <h3 className="text-xl font-black text-white">Konfigurasi Umum</h3>
          </div>

          <form action={handleSaveGeneral} className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-[2px]">Judul Situs</label>
              <input 
                name="title"
                defaultValue={initialSiteConfig.title}
                className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold focus:outline-none focus:border-yellow-500/50 focus:bg-white/10 transition-all shadow-inner"
                placeholder="Nama Platform Anda"
              />
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-[2px] flex items-center gap-2">
                  <Palette size={14} /> Warna Utama
                </label>
                <div className="flex gap-4 items-center bg-white/5 p-2 rounded-2xl border border-white/5">
                  <input 
                    type="color" 
                    name="primary_color" 
                    defaultValue={initialSiteConfig.primary_color || '#eab308'}
                    className="w-12 h-12 border-none rounded-xl bg-transparent cursor-pointer overflow-hidden p-0"
                  />
                  <span className="text-xs font-mono text-zinc-400 font-bold">{initialSiteConfig.primary_color || '#eab308'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-[2px] flex items-center gap-2">
                  <Palette size={14} /> Warna Navbar
                </label>
                <div className="flex gap-4 items-center bg-white/5 p-2 rounded-2xl border border-white/5">
                  <input 
                    type="color" 
                    name="navbar_color" 
                    defaultValue={initialSiteConfig.navbar_color || '#38bdf8'}
                    className="w-12 h-12 border-none rounded-xl bg-transparent cursor-pointer overflow-hidden p-0"
                  />
                  <span className="text-xs font-mono text-zinc-400 font-bold">{initialSiteConfig.navbar_color || '#38bdf8'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-red-500/5 rounded-2xl border border-red-500/10">
              <div className="min-w-0">
                <div className="font-black text-sm text-red-500 uppercase tracking-wider mb-0.5">Mode Perawatan</div>
                <div className="text-xs text-zinc-500 font-medium">Matikan akses publik ke seluruh situs.</div>
              </div>
              <input 
                type="checkbox" 
                name="maintenance" 
                defaultChecked={initialSiteConfig.maintenance_mode}
                className="w-6 h-6 accent-red-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
              <div className="min-w-0">
                <div className="font-black text-sm text-white uppercase tracking-wider mb-0.5">Izinkan Pendaftaran</div>
                <div className="text-xs text-zinc-500 font-medium">Buka/tutup akses ke halaman registrasi.</div>
              </div>
              <input 
                type="checkbox" 
                name="registrations" 
                defaultChecked={initialSiteConfig.allow_registrations}
                className="w-6 h-6 accent-yellow-500 cursor-pointer"
              />
            </div>

            <button 
              type="submit" 
              disabled={isPending} 
              className="mt-4 w-full py-5 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-[2px] rounded-2xl shadow-xl shadow-yellow-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isPending ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
              {isPending ? 'Menyimpan...' : 'Simpan Konfigurasi Umum'}
            </button>
          </form>
        </section>

        {/* System & Scraper Controls */}
        <div className="flex flex-col gap-8">
          
          <section className="glass p-8 rounded-3xl flex flex-col gap-8 border border-white/5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-sky-500/10 rounded-2xl border border-sky-500/20">
                <Cpu size={24} className="text-sky-400" />
              </div>
              <h3 className="text-xl font-black text-white">Kontrol Scraper</h3>
            </div>

            <form action={handleSaveScraper} className="flex flex-col gap-6">
              <div className="flex justify-between items-center px-2 py-4 border-b border-white/5 group">
                <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">VideoSpider Provider</span>
                <input type="checkbox" name="videospider" defaultChecked={initialScraperConfig.videospider_enabled} className="w-5 h-5 accent-sky-400" />
              </div>
              <div className="flex justify-between items-center px-2 py-4 border-b border-white/5 group">
                <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">SuperEmbed Provider</span>
                <input type="checkbox" name="superembed" defaultChecked={initialScraperConfig.superembed_enabled} className="w-5 h-5 accent-sky-400" />
              </div>

              <div className="p-5 bg-sky-500/5 rounded-2xl border border-sky-500/10 flex gap-4">
                <Zap size={24} className="text-sky-400 shrink-0" />
                <div className="flex-1">
                  <div className="font-black text-sm text-sky-400 uppercase tracking-widest mb-1">Auto-Approve Content</div>
                  <div className="text-xs text-zinc-500 font-medium leading-relaxed">Secara otomatis menyetujui konten hasil scraping tanpa review admin.</div>
                </div>
                <input type="checkbox" name="auto_approve" defaultChecked={initialScraperConfig.auto_approve} className="w-6 h-6 accent-sky-400 cursor-pointer" />
              </div>

              {/* Automation Section */}
              <div className="p-6 bg-violet-500/5 rounded-2xl border border-violet-500/10 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                   <RefreshCw size={24} className={`text-violet-400 ${initialScraperConfig.auto_scrape_enabled ? 'animate-spin-slow' : ''}`} />
                   <div className="flex-1">
                      <div className="font-black text-sm text-violet-400 uppercase tracking-widest mb-0.5">Otomatisasi Scraper</div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Running via server-less cron</div>
                   </div>
                   <input type="checkbox" name="auto_scrape" defaultChecked={initialScraperConfig.auto_scrape_enabled} className="w-6 h-6 accent-violet-400 cursor-pointer" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Secret Key</label>
                      <input 
                        name="scraper_secret"
                        type="password"
                        placeholder="••••••••"
                        defaultValue={initialScraperConfig.scraper_secret}
                        className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all" 
                      />
                   </div>
                   <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Discovery Pages</label>
                      <input 
                        name="discovery_pages"
                        type="number"
                        min="1"
                        max="20"
                        defaultValue={initialScraperConfig.discovery_pages || 3}
                        className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all" 
                      />
                   </div>
                </div>

                {initialScraperConfig.auto_scrape_enabled && (
                  <div className="p-4 bg-black/50 rounded-xl border border-violet-500/20 border-dashed">
                    <div className="text-[9px] font-black text-violet-400 uppercase tracking-[2px] mb-2">Cron Trigger Endpoint</div>
                    <code className="text-[10px] text-zinc-500 font-mono break-all selection:bg-violet-500 selection:text-white">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/scraper/run?secret=${initialScraperConfig.scraper_secret || 'YOUR_KEY'}` : 'Loading...'}
                    </code>
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                disabled={isPending} 
                className="w-full py-4 bg-white/5 hover:bg-sky-500 hover:text-black border border-sky-500/20 text-sky-400 font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <Save size={18} /> Simpan Pengaturan Scraper
              </button>
            </form>
          </section>

          <section className="glass p-8 rounded-3xl flex flex-col gap-6 border border-white/5 bg-zinc-900/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                <Database size={24} className="text-zinc-400" />
              </div>
              <h3 className="text-xl font-black text-white">Pemeliharaan Data</h3>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={async () => {
                  const result = await adminAlert.confirm('Bersihkan Cache?', 'Ini akan memaksa sistem memuat data terbaru dari TMDB & Provider.', 'Ya, Bersihkan');
                  if (result.isConfirmed) {
                    adminAlert.loading('Membersihkan...');
                    const res = await purgeCache();
                    adminAlert.close();
                    if (res.success) adminAlert.success('Selesai!', 'Cache global berhasil dibersihkan.');
                  }
                }}
                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
              >
                <RefreshCw size={18} /> Bersihkan Cache Global
              </button>
              
              <div className="flex gap-3 p-4 bg-white/[0.02] rounded-xl border border-white/5">
                <Info size={16} className="text-zinc-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                  Menghapus cache akan me-reset data yang tersimpan sementara di server. Berguna jika terjadi ketidaksinkronan data atau perubahan konfigurasi API yang mendadak.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
