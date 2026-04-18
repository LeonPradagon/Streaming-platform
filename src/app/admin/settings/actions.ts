'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';

export async function updateSettings(key: string, value: any) {
  const supabase = await createClient();

  // Basic permission check
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  if (profile?.role !== 'super_admin') {
    return { success: false, error: 'Hanya Super Admin yang dapat mengubah pengaturan.' };
  }

  // Get existing settings if any to merge if it's a JSON
  // (Optional: depending on how granular we want to be, but for now we replace the whole value for the key)
  
  const { error } = await supabase
    .from('settings')
    .upsert({ 
      key, 
      value, 
      updated_at: new Date().toISOString() 
    });

  if (!error) {
    await logAudit('UPDATE_SITE_SETTINGS', key, value);
    revalidatePath('/admin/settings');
    revalidatePath('/', 'layout'); // Revalidate everything for title/color changes
    return { success: true };
  }

  return { success: false, error: error.message };
}

export async function purgeCache() {
  const supabase = await createClient();
  
  // Basic permission check
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  if (profile?.role !== 'super_admin') {
    return { success: false, error: 'Hanya Super Admin yang dapat menghapus cache.' };
  }

  // Placeholder logic for purging cache
  // In a real app, this might clear Redis or specific DB caches
  await logAudit('PURGE_CACHE', 'global');
  revalidatePath('/', 'layout');
  
  return { success: true };
}
