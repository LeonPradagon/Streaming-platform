'use client';

import { useState, useTransition, useEffect } from 'react';
import { 
  Globe, 
  Cpu, 
  Database,
  RefreshCw,
  Save,
  Zap,
  Info,
  Palette,
  ShieldAlert,
  Server,
  Settings2,
  CheckCircle2,
  Layout
} from 'lucide-react';
import { updateSettings, purgeCache } from './actions';
import { adminAlert } from '@/lib/swal';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsClient({ initialSiteConfig, initialScraperConfig }: { 
  initialSiteConfig: any, 
  initialScraperConfig: any 
}) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'general' | 'scraper' | 'maintenance'>('general');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        adminAlert.success('Updated!', 'General settings saved.');
      } else {
        adminAlert.error('Failed!', result.error || 'Something went wrong.');
      }
    });
  }

  async function handleSaveScraper(formData: FormData) {
    startTransition(async () => {
      const vidlink = formData.get('vidlink') === 'on';
      const moviesapito = formData.get('moviesapito') === 'on';
      const videasy = formData.get('videasy') === 'on';
      const autoApprove = formData.get('auto_approve') === 'on';
      const autoScrape = formData.get('auto_scrape') === 'on';
      const scraperSecret = formData.get('scraper_secret') as string;
      const discoveryPages = parseInt(formData.get('discovery_pages') as string) || 3;

      const result = await updateSettings('scraper_config', { 
        vidlink_enabled: vidlink,
        moviesapito_enabled: moviesapito,
        videasy_enabled: videasy, 
        auto_approve: autoApprove,
        auto_scrape_enabled: autoScrape,
        scraper_secret: scraperSecret,
        discovery_pages: discoveryPages
      });

      if (result.success) {
        adminAlert.success('Updated!', 'Scraper settings saved.');
      } else {
        adminAlert.error('Failed!', result.error || 'Something went wrong.');
      }
    });
  }

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${
        activeTab === id 
          ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(229,9,20,0.3)] scale-105' 
          : 'bg-white/5 text-gray-500 hover:bg-white/10'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-12">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-4 p-2 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-xl w-fit">
        <TabButton id="general" label="Site Config" icon={Globe} />
        <TabButton id="scraper" label="Scraper Engine" icon={Cpu} />
        <TabButton id="maintenance" label="Maintenance" icon={Database} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Branding Section */}
              <section className="glass p-10 rounded-[2.5rem] flex flex-col gap-10 border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-600/10 rounded-2xl border border-red-600/20 text-red-500">
                    <Layout size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Branding & Identity</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">General platform appearance</p>
                  </div>
                </div>

                <form action={handleSaveGeneral} className="flex flex-col gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Platform Title</label>
                    <input 
                      name="title"
                      defaultValue={initialSiteConfig.title}
                      className="w-full px-6 py-5 bg-black/40 border border-white/5 rounded-2xl text-white font-bold focus:outline-none focus:border-red-600/50 transition-all text-lg"
                      placeholder="e.g. NETIX Premium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Palette size={14} className="text-red-500" /> Accent Color
                      </label>
                      <div className="flex gap-4 items-center bg-black/40 p-3 rounded-2xl border border-white/5">
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                          <input 
                            type="color" 
                            name="primary_color" 
                            defaultValue={initialSiteConfig.primary_color || '#eab308'}
                            className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                          />
                        </div>
                        <span className="text-xs font-mono text-white font-black">{initialSiteConfig.primary_color || '#eab308'}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Palette size={14} className="text-blue-500" /> Navbar Color
                      </label>
                      <div className="flex gap-4 items-center bg-black/40 p-3 rounded-2xl border border-white/5">
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                          <input 
                            type="color" 
                            name="navbar_color" 
                            defaultValue={initialSiteConfig.navbar_color || '#38bdf8'}
                            className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                          />
                        </div>
                        <span className="text-xs font-mono text-white font-black">{initialSiteConfig.navbar_color || '#38bdf8'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-red-600/5 rounded-3xl border border-red-600/10 flex items-center justify-between group">
                    <div className="space-y-1">
                      <div className="font-black text-xs text-red-500 uppercase tracking-widest">Maintenance Mode</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Disable public access immediately</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" name="maintenance" defaultChecked={initialSiteConfig.maintenance_mode} className="sr-only peer" />
                      <div className="w-12 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isPending} 
                    className="mt-4 w-full py-5 bg-white text-black hover:bg-red-600 hover:text-white font-black text-[11px] uppercase tracking-[3px] rounded-2xl shadow-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {isPending ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                    {isPending ? 'Processing...' : 'Deploy Global Configuration'}
                  </button>
                </form>
              </section>

              {/* Access Section */}
              <div className="space-y-8">
                <section className="glass p-10 rounded-[2.5rem] border border-white/5 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600/10 rounded-2xl border border-indigo-600/20 text-indigo-500">
                      <ShieldAlert size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">Access Control</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">User permission logic</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-6 bg-white/[0.03] rounded-3xl border border-white/5">
                        <div className="space-y-1">
                          <div className="font-black text-xs text-white uppercase tracking-widest">Allow Registrations</div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase">Toggle public sign-up page</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" name="registrations" defaultChecked={initialSiteConfig.allow_registrations} className="sr-only peer" />
                          <div className="w-12 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                     </div>
                  </div>
                </section>
                
                <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-red-600 to-indigo-600 text-white flex flex-col gap-4 relative overflow-hidden shadow-2xl">
                  <Zap className="absolute -right-8 -bottom-8 w-48 h-48 opacity-20" />
                  <h4 className="text-2xl font-black uppercase tracking-tighter leading-none">Standard 2025<br />Activated.</h4>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">All global styles are synchronized with premium assets.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scraper' && (
            <section className="glass p-10 rounded-[2.5rem] border border-white/5 max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 text-yellow-500">
                  <Settings2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Scraper Engine Pipeline</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Manage sources & automation</p>
                </div>
              </div>

              <form action={handleSaveScraper} className="space-y-10">
                {/* Providers Grid */}
                <div className="space-y-6">
                   <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] ml-1">Streaming Providers</h4>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { id: 'vidlink', name: 'VidLink PRO', desc: 'Main stable source' },
                        { id: 'moviesapito', name: 'MoviesAPI', desc: 'Secondary metadata' },
                        { id: 'videasy', name: 'Videasy NET', desc: 'Fast load engine' }
                      ].map(p => (
                        <div key={p.id} className="p-5 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-between group hover:border-white/10 transition-all">
                           <div className="space-y-1">
                              <div className="text-xs font-black text-white uppercase tracking-widest">{p.name}</div>
                              <div className="text-[9px] text-gray-500 font-bold uppercase">{p.desc}</div>
                           </div>
                           <input type="checkbox" name={p.id} defaultChecked={initialScraperConfig[`${p.id}_enabled`] !== false} className="w-5 h-5 accent-yellow-500" />
                        </div>
                      ))}
                   </div>
                </div>

                {/* Automation & Advanced */}
                <div className="space-y-8">
                  <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] ml-1">Logic & Automation</h4>
                  
                  <div className="p-8 bg-black/40 rounded-[2rem] border border-white/5 space-y-8">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                           <CheckCircle2 size={20} />
                         </div>
                         <div className="space-y-0.5">
                           <div className="text-xs font-black text-white uppercase tracking-widest">Auto-Approve Content</div>
                           <p className="text-[9px] text-gray-500 font-bold uppercase">Skip manual review queue</p>
                         </div>
                       </div>
                       <input type="checkbox" name="auto_approve" defaultChecked={initialScraperConfig.auto_approve} className="w-6 h-6 accent-emerald-500" />
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    <div className="flex flex-col md:flex-row gap-8">
                       <div className="flex-1 space-y-3">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Discovery Secret</label>
                          <input 
                            name="scraper_secret"
                            type="password"
                            defaultValue={initialScraperConfig.scraper_secret}
                            className="w-full px-5 py-4 bg-black/60 border border-white/5 rounded-2xl text-white font-bold focus:outline-none focus:border-yellow-500/50 transition-all"
                            placeholder="SECRET_KEY_HERE"
                          />
                       </div>
                       <div className="w-full md:w-40 space-y-3">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Scan Pages</label>
                          <input 
                            name="discovery_pages"
                            type="number"
                            defaultValue={initialScraperConfig.discovery_pages || 3}
                            className="w-full px-5 py-4 bg-black/60 border border-white/5 rounded-2xl text-white font-bold focus:outline-none focus:border-yellow-500/50 transition-all"
                          />
                       </div>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isPending} 
                  className="w-full py-5 bg-yellow-500 text-black hover:bg-yellow-400 font-black text-[11px] uppercase tracking-[3px] rounded-[1.5rem] shadow-2xl transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <RefreshCw size={20} className={isPending ? 'animate-spin' : ''} />
                  {isPending ? 'Syncing...' : 'Save Scraper Protocol'}
                </button>
              </form>
            </section>
          )}

          {activeTab === 'maintenance' && (
            <div className="max-w-2xl mx-auto space-y-10">
              <section className="glass p-10 rounded-[2.5rem] border border-white/5 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-gray-400">
                    <Server size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">System Health</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Routine maintenance tasks</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                      <span className="text-[11px] font-black text-white uppercase tracking-widest">Global Cache Cache</span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                      Clearing cache will force the application to fetch fresh data from TMDB and Database. Use this if you see outdated metadata or broken images.
                    </p>
                    <button 
                      onClick={async () => {
                        const confirm = await adminAlert.confirm('Purge Cache?', 'This action will reset global transient data.', 'Confirm Purge');
                        if (confirm.isConfirmed) {
                          adminAlert.loading('Purging...');
                          const res = await purgeCache();
                          adminAlert.close();
                          if (res.success) adminAlert.success('Success!', 'Cache purged successfully.');
                        }
                      }}
                      className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Execute Cache Purge
                    </button>
                  </div>
                </div>
              </section>

              <div className="flex gap-4 p-8 bg-yellow-500/5 rounded-[2rem] border border-yellow-500/10">
                <Info size={24} className="text-yellow-500 shrink-0" />
                <p className="text-xs text-gray-500 font-bold leading-relaxed uppercase tracking-tighter">
                  Warning: All maintenance actions are irreversible and affect all users immediately. Proceed with caution.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
