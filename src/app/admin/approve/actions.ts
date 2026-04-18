'use server';

import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export async function approveContent(contentId: string, title: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('contents')
    .update({ status: 'approved' })
    .eq('id', contentId);

  if (error) throw error;

  await logAudit(`Approved content: ${title}`, contentId);
  revalidatePath('/admin');
  revalidatePath('/admin/approve');
}

export async function approveAllContent() {
  const supabase = await createClient();

  const { error } = await supabase
    .from('contents')
    .update({ status: 'approved' })
    .eq('status', 'pending');

  if (error) throw error;

  await logAudit(`Approved all pending content`, 'bulk-approve');
  revalidatePath('/admin');
  revalidatePath('/admin/approve');
}

export async function rejectContent(contentId: string, title: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('contents')
    .delete()
    .eq('id', contentId);

  if (error) throw error;

  await logAudit(`Rejected and deleted content: ${title}`, contentId);
  revalidatePath('/admin');
  revalidatePath('/admin/approve');
}
