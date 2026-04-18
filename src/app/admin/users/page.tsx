import { createClient } from '@/lib/supabase/server';
import { 
  Users, 
  Shield, 
  ShieldCheck, 
  Trash2, 
  UserPlus,
  Mail,
  Calendar,
  Lock
} from 'lucide-react';
import { updateUserRole, deleteUser } from './actions';

export default async function UserManagement() {
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  // Get current user to show permissions
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUser?.id)
    .single();

  const isSuperAdmin = currentProfile?.role === 'super_admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.5px' }}>Manajemen Admin</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Kelola hak akses dan peran administrator sistem.</p>
        </div>
        {!isSuperAdmin && (
          <div className="glass" style={{ padding: '0.75rem 1.25rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <Lock size={16} color="#ef4444" />
            <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>Limited Access (Moderator)</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {profiles?.map((profile) => (
          <div key={profile.id} className="glass" style={{ 
            padding: '2rem', 
            borderRadius: '1.5rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Role Badge Background */}
            <div style={{ 
              position: 'absolute', 
              top: '-10px', 
              right: '-10px', 
              opacity: 0.05,
              transform: 'rotate(-10deg)'
            }}>
              {profile.role === 'super_admin' ? <ShieldCheck size={120} /> : <Shield size={120} />}
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '1.5rem', 
                backgroundColor: 'rgba(255,255,255,0.03)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: profile.role === 'super_admin' ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(255,255,255,0.05)'
              }}>
                {profile.role === 'super_admin' ? <ShieldCheck size={32} color="#eab308" /> : <Shield size={32} color="#94a3b8" />}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{profile.full_name}</h3>
                  {profile.id === currentUser?.id && (
                    <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#94a3b8' }}>YOU</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  <Mail size={12} /> {profile.id.slice(0, 16)}...
                </div>
                
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px' }}>Peran</div>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 700, 
                    color: profile.role === 'super_admin' ? '#eab308' : '#94a3b8',
                    marginTop: '0.2rem'
                  }}>
                    {profile.role === 'super_admin' ? 'Super Administrator' : 'Moderator / Editor'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ 
              marginTop: '2rem', 
              paddingTop: '1.5rem', 
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', fontSize: '0.8rem' }}>
                <Calendar size={14} /> Terdaftar {new Date(profile.created_at).toLocaleDateString()}
              </div>

              {isSuperAdmin && profile.id !== currentUser?.id && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <form action={async () => {
                    'use server';
                    await updateUserRole(profile.id, profile.role === 'super_admin' ? 'moderator' : 'super_admin');
                  }}>
                    <button style={{ 
                      backgroundColor: 'rgba(56, 189, 248, 0.1)', 
                      color: '#38bdf8', 
                      border: 'none', 
                      padding: '0.5rem 1rem', 
                      borderRadius: '0.75rem', 
                      fontSize: '0.8rem', 
                      fontWeight: 700, 
                      cursor: 'pointer' 
                    }}>
                      Switch Role
                    </button>
                  </form>
                  <form action={async () => {
                    'use server';
                    await deleteUser(profile.id);
                  }}>
                    <button style={{ 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                      color: '#ef4444', 
                      border: 'none', 
                      padding: '0.5rem', 
                      borderRadius: '0.75rem', 
                      cursor: 'pointer' 
                    }}>
                      <Trash2 size={18} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        ))}

        {isSuperAdmin && (
          <div style={{ 
            border: '2px dashed rgba(255,255,255,0.05)', 
            borderRadius: '1.5rem', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '1rem',
            minHeight: '200px',
            color: '#475569'
          }}>
            <UserPlus size={40} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#94a3b8' }}>Tambah Admin Baru?</div>
              <div style={{ fontSize: '0.8rem' }}>Minta mereka mendaftar di halaman /register</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
