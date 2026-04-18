'use server';

import { createClient } from '@/lib/supabase/server';

export async function logAudit(action: string, targetId?: string, metadata?: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action,
    target_id: targetId,
    details: metadata
  });
}
