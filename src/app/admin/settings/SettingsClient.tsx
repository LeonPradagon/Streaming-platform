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
  CheckCircle2,
  Palette
} from 'lucide-react';
import { updateSettings, purgeCache } from './actions';
import { adminAlert } from '@/lib/swal';

export default function SettingsClient({ initialSiteConfig, initialScraperConfig }: { 
  initialSiteConfig: any, 
  initialScraperConfig: any 
}) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem' }}>
        
        {/* General Settings */}
        <section className="glass" style={{ padding: '2rem', borderRadius: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: '0.75rem' }}>
              <Globe size={20} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Konfigurasi Umum</h3>
          </div>

          <form action={handleSaveGeneral} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>Judul Situs</label>
              <input 
                name="title"
                defaultValue={initialSiteConfig.title}
                style={{ 
                  padding: '0.75rem 1rem', 
                  backgroundColor: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '0.75rem', 
                  color: 'white',
                  fontSize: '0.95rem'
                }} 
              />
            </div>

            {/* Color Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Palette size={14} /> Warna Utama
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="color" 
                    name="primary_color" 
                    defaultValue={initialSiteConfig.primary_color || '#eab308'}
                    style={{ width: '40px', height: '40px', border: 'none', borderRadius: '0.5rem', backgroundColor: 'transparent', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>{initialSiteConfig.primary_color || '#eab308'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   Warna Logo/Navbar
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="color" 
                    name="navbar_color" 
                    defaultValue={initialSiteConfig.navbar_color || '#38bdf8'}
                    style={{ width: '40px', height: '40px', border: 'none', borderRadius: '0.5rem', backgroundColor: 'transparent', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace' }}>{initialSiteConfig.navbar_color || '#38bdf8'}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '1rem', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Mode Perawatan</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Matikan akses publik ke situs.</div>
              </div>
              <input type="checkbox" name="maintenance" defaultChecked={initialSiteConfig.maintenance_mode} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Izinkan Pendaftaran Admin</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Buka/tutup halaman registrasi.</div>
              </div>
              <input type="checkbox" name="registrations" defaultChecked={initialSiteConfig.allow_registrations} />
            </div>

            <button type="submit" disabled={isPending} style={{ 
              marginTop: '1rem',
              padding: '1rem', 
              backgroundColor: 'var(--primary)', 
              color: '#0f172a', 
              border: 'none', 
              borderRadius: '0.75rem', 
              fontWeight: 800, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.5rem',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1
            }}>
              <Save size={18} /> {isPending ? 'Menyimpan...' : 'Simpan Perubahan Umum'}
            </button>
          </form>
        </section>

        {/* System & Scraper Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <section className="glass" style={{ padding: '2rem', borderRadius: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.5rem', backgroundColor: 'rgba(56, 189, 248, 0.1)', borderRadius: '0.75rem' }}>
                <Cpu size={20} color="#38bdf8" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Kontrol Scraper</h3>
            </div>

            <form action={handleSaveScraper} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>VideoSpider Provider</span>
                <input type="checkbox" name="videospider" defaultChecked={initialScraperConfig.videospider_enabled} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>SuperEmbed Provider</span>
                <input type="checkbox" name="superembed" defaultChecked={initialScraperConfig.superembed_enabled} />
              </div>

              <div style={{ padding: '1rem', backgroundColor: 'rgba(56, 189, 248, 0.05)', borderRadius: '1rem', border: '1px solid rgba(56, 189, 248, 0.1)', display: 'flex', gap: '0.75rem' }}>
                <Zap size={20} color="#38bdf8" style={{ marginTop: '0.2rem' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>Auto-Approve Content</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Secara otomatis menyetujui konten hasil scraping.</div>
                </div>
                <input type="checkbox" name="auto_approve" defaultChecked={initialScraperConfig.auto_approve} />
              </div>

              {/* Automation Section */}
              <div style={{ padding: '1.5rem', backgroundColor: 'rgba(139, 92, 246, 0.05)', borderRadius: '1rem', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                   <RefreshCw size={18} color="#a78bfa" className={initialScraperConfig.auto_scrape_enabled ? 'animate-spin-slow' : ''} />
                   <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#a78bfa' }}>Otomatisasi Scraper</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Jalankan rutin scraping tanpa intervensi manual.</div>
                   </div>
                   <input type="checkbox" name="auto_scrape" defaultChecked={initialScraperConfig.auto_scrape_enabled} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '1rem' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>Scraper Secret Key</label>
                      <input 
                        name="scraper_secret"
                        type="password"
                        placeholder="Masukkan kode rahasia..."
                        defaultValue={initialScraperConfig.scraper_secret}
                        style={{ padding: '0.6rem 0.8rem', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.5rem', color: 'white', fontSize: '0.85rem' }} 
                      />
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>Halaman</label>
                      <input 
                        name="discovery_pages"
                        type="number"
                        min="1"
                        max="20"
                        defaultValue={initialScraperConfig.discovery_pages || 3}
                        style={{ padding: '0.6rem 0.8rem', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.5rem', color: 'white', fontSize: '0.85rem' }} 
                      />
                   </div>
                </div>

                {initialScraperConfig.auto_scrape_enabled && (
                  <div style={{ padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '0.75rem', border: '1px dashed rgba(139, 92, 246, 0.3)' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a78bfa', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cron Trigger URL</div>
                    <code style={{ fontSize: '0.7rem', color: '#cbd5e1', wordBreak: 'break-all', opacity: 0.8 }}>
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/scraper/run?secret=${initialScraperConfig.scraper_secret || 'KODE_ANDA'}` : 'Loading...'}
                    </code>
                  </div>
                )}
              </div>

              <button type="submit" disabled={isPending} style={{ 
                padding: '1rem', 
                backgroundColor: 'rgba(56, 189, 248, 0.1)', 
                color: '#38bdf8', 
                border: '1px solid rgba(56, 189, 248, 0.2)', 
                borderRadius: '0.75rem', 
                fontWeight: 800, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.5rem',
                cursor: 'pointer'
              }}>
                <Save size={18} /> Simpan Pengaturan Scraper
              </button>
            </form>
          </section>

          <section className="glass" style={{ padding: '2rem', borderRadius: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.5rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: '0.75rem' }}>
                <Database size={20} color="#8b5cf6" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Pemeliharaan Data</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                onClick={async () => {
                  const result = await adminAlert.confirm('Bersihkan Cache?', 'Ini akan memaksa browser & server memuat data terbaru.', 'Ya, Bersihkan');
                  if (result.isConfirmed) {
                    adminAlert.loading('Membersihkan...');
                    const res = await purgeCache();
                    adminAlert.close();
                    if (res.success) adminAlert.success('Selesai!', 'Cache global berhasil dibersihkan.');
                  }
                }}
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  backgroundColor: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '1rem', 
                  color: 'white', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={18} /> Bersihkan Cache Global
              </button>
              
              <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '1rem' }}>
                <Info size={16} color="#64748b" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                  Membersihkan cache akan memaksa server untuk mengambil data terbaru dari TMDb dan Provider di setiap request.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
