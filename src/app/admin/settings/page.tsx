import { createClient } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'Admin Settings | CMS',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  
  // ⚡ PERFORMANCE: Parallel fetch both configs
  const [siteResult, scraperResult] = await Promise.all([
    supabase.from('settings').select('*').eq('key', 'site_config').single(),
    supabase.from('settings').select('*').eq('key', 'scraper_config').single(),
  ]);

  const siteConfig = siteResult.data?.value || {
    title: 'Platform Anda',
    maintenance_mode: false,
    allow_registrations: true,
    primary_color: '#eab308',
    navbar_color: '#38bdf8'
  };

  const scraperConfig = scraperResult.data?.value || {
    videospider_enabled: true,
    superembed_enabled: true,
    auto_approve: false,
    auto_scrape_enabled: false,
    scraper_secret: '',
    discovery_pages: 3
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black text-white tracking-tight">Pengaturan Sistem</h1>
        <p className="text-zinc-500 font-medium">Konfigurasikan perilaku global dan tampilan platform Anda.</p>
      </div>

      <SettingsClient 
        initialSiteConfig={siteConfig} 
        initialScraperConfig={scraperConfig} 
      />
    </div>
  );
}
