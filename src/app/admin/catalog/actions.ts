'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';

export async function deleteContent(id: string) {
  const supabase = await createClient();
  
  // Get title for logging
  const { data: content } = await supabase
    .from('contents')
    .select('title')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('contents')
    .delete()
    .eq('id', id);

  if (!error) {
    await logAudit('DELETE_CONTENT', id, { title: content?.title });
    revalidatePath('/admin/catalog');
    revalidatePath('/admin/approve');
    return { success: true };
  }

  return { success: false, error: error.message };
}

export async function updateContentStatus(id: string, status: 'pending' | 'approved') {
  const supabase = await createClient();

  const { error } = await supabase
    .from('contents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (!error) {
    await logAudit('UPDATE_CONTENT_STATUS', id, { status });
    revalidatePath('/admin/catalog');
    revalidatePath('/admin/approve');
    return { success: true };
  }

  return { success: false, error: error.message };
}

export async function bulkDeleteContent(ids: string[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('contents')
    .delete()
    .in('id', ids);

  if (!error) {
    await logAudit('BULK_DELETE_CONTENT', ids.join(','), { count: ids.length });
    revalidatePath('/admin/catalog');
    revalidatePath('/admin/approve');
    return { success: true };
  }

  return { success: false, error: error.message };
}
