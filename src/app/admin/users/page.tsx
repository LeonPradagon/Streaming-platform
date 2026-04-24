import { createClient } from '@/lib/supabase/server';
import { 
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

  // ⚡ PERFORMANCE: Parallel fetch profiles + current user
  const [profilesResult, authResult] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    supabase.auth.getUser(),
  ]);

  const profiles = profilesResult.data;
  const currentUser = authResult.data?.user;

  // Only fetch current profile if user exists
  const { data: currentProfile } = currentUser 
    ? await supabase.from('profiles').select('role').eq('id', currentUser.id).single()
    : { data: null };

  const isSuperAdmin = currentProfile?.role === 'super_admin';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Manajemen Admin</h2>
          <p className="text-zinc-500 font-medium">Kelola hak akses dan peran administrator sistem.</p>
        </div>
        {!isSuperAdmin && (
          <div className="glass px-5 py-3 rounded-2xl flex items-center gap-3 border border-red-500/20 shadow-xl shadow-red-500/5">
            <Lock size={18} className="text-red-500" />
            <span className="text-xs font-black text-red-500 uppercase tracking-widest">Limited Access (Moderator)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {profiles?.map((profile) => (
          <div key={profile.id} className="glass group relative overflow-hidden p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-all">
            {/* Role Badge Background Decoration */}
            <div className="absolute -top-6 -right-6 opacity-[0.03] rotate-[-15deg] group-hover:rotate-0 transition-transform duration-700 pointer-events-none">
              {profile.role === 'super_admin' ? <ShieldCheck size={160} /> : <Shield size={160} />}
            </div>

            <div className="flex gap-6 relative z-10">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xl transition-all duration-500 ${
                profile.role === 'super_admin' 
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 group-hover:bg-yellow-500 group-hover:text-black group-hover:scale-110' 
                  : 'bg-white/5 border-white/5 text-zinc-500 group-hover:text-white'
              }`}>
                {profile.role === 'super_admin' ? <ShieldCheck size={32} /> : <Shield size={32} />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-black text-white truncate">{profile.full_name}</h3>
                  {profile.id === currentUser?.id && (
                    <span className="px-1.5 py-0.5 bg-white/10 rounded-md text-[10px] font-black text-zinc-400 border border-white/5 uppercase tracking-tighter">ME</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium truncate">
                  <Mail size={14} className="text-zinc-600" /> {profile.id.slice(0, 16)}...
                </div>
                
                <div className="mt-6">
                  <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[2px] mb-1">Role Assigned</div>
                  <div className={`text-sm font-black tracking-tight ${
                    profile.role === 'super_admin' ? 'text-yellow-500' : 'text-zinc-400'
                  }`}>
                    {profile.role === 'super_admin' ? 'Super Administrator' : 'Moderator / Editor'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center relative z-10">
              <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                <Calendar size={14} /> Registered {new Date(profile.created_at).toLocaleDateString()}
              </div>

              {isSuperAdmin && profile.id !== currentUser?.id && (
                <div className="flex gap-3">
                  <form action={async () => {
                    'use server';
                    await updateUserRole(profile.id, profile.role === 'super_admin' ? 'moderator' : 'super_admin');
                  }}>
                    <button className="px-4 py-2 rounded-xl bg-white/5 text-white font-black text-[10px] uppercase tracking-widest border border-white/5 hover:bg-sky-500 hover:text-black hover:border-sky-500 transition-all">
                      Switch Role
                    </button>
                  </form>
                  <form action={async () => {
                    'use server';
                    await deleteUser(profile.id);
                  }}>
                    <button className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all">
                      <Trash2 size={18} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        ))}

        {isSuperAdmin && (
          <div className="border-2 border-dashed border-white/5 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 text-center hover:bg-white/[0.02] transition-colors cursor-default group">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 group-hover:scale-110 group-hover:text-zinc-400 transition-all duration-500">
              <UserPlus size={40} />
            </div>
            <div>
              <div className="font-black text-white text-lg tracking-tight">Tambah Admin Baru?</div>
              <div className="text-zinc-600 text-sm font-medium max-w-[200px]">Minta kolega mendaftar di halaman pendaftaran umum.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
