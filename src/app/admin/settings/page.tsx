import { createClient } from '@/lib/supabase/server';
import { 
  Settings, 
  Globe, 
  ShieldAlert, 
  Cpu, 
  Database,
  RefreshCw,
  Save,
  Zap,
  Info
} from 'lucide-react';
import { updateSettings, purgeCache } from './actions';

import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'Admin Settings | CMS',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  
  // Fetch site config
  const { data: siteData } = await supabase
    .from('settings')
    .select('*')
    .eq('key', 'site_config')
    .single();

  // Fetch scraper config
  const { data: scraperData } = await supabase
    .from('settings')
    .select('*')
    .eq('key', 'scraper_config')
    .single();

  const siteConfig = siteData?.value || {
    title: 'Platform Anda',
    maintenance_mode: false,
    allow_registrations: true,
    primary_color: '#eab308',
    navbar_color: '#38bdf8'
  };

  const scraperConfig = scraperData?.value || {
    videospider_enabled: true,
    superembed_enabled: true,
    auto_approve: false
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem' }}>Pengaturan Sistem</h1>
        <p style={{ color: '#94a3b8' }}>Konfigurasikan perilaku global dan tampilan platform Anda.</p>
      </div>

      <SettingsClient 
        initialSiteConfig={siteConfig} 
        initialScraperConfig={scraperConfig} 
      />
    </div>
  );
}
