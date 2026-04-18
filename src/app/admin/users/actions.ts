'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';

export async function updateUserRole(profileId: string, role: 'super_admin' | 'moderator') {
  const supabase = await createClient();

  // Get current user to check permission (only super_admin can change roles)
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUser?.id)
    .single();

  if (currentProfile?.role !== 'super_admin') {
    return { success: false, error: 'Hanya Super Admin yang dapat mengubah role.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (!error) {
    await logAudit('UPDATE_USER_ROLE', profileId, { new_role: role });
    revalidatePath('/admin/users');
    return { success: true };
  }

  return { success: false, error: error.message };
}

export async function deleteUser(profileId: string) {
  const supabase = await createClient();

  // Get current user to check permission
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUser?.id)
    .single();

  if (currentProfile?.role !== 'super_admin') {
    return { success: false, error: 'Hanya Super Admin yang dapat menghapus user.' };
  }

  // Note: We can only delete the profile easily. 
  // To delete from auth.users, we usually need the Supabase Admin API which requires service_role key.
  // For now, we delete from profiles and log it.
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', profileId);

  if (!error) {
    await logAudit('DELETE_USER_PROFILE', profileId);
    revalidatePath('/admin/users');
    return { success: true };
  }

  return { success: false, error: error.message };
}
