import { createClient } from '@/lib/supabase/server';
import { 
  BarChart3, 
  Users, 
  Film, 
  Activity,
  ArrowUpRight,
  Clock
} from 'lucide-react';

export default async function AdminOverview() {
  const supabase = await createClient();

  // ⚡ PERFORMANCE: All stat queries in parallel (was 5 serial round-trips)
  const [usersResult, contentResult, pendingResult, trafficResult, logsResult] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('contents').select('*', { count: 'exact', head: true }),
    supabase.from('contents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('watch_history').select('*', { count: 'exact', head: true }).gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    supabase.from('audit_logs').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(5),
  ]);

  const usersCount = usersResult.count;
  const contentCount = contentResult.count;
  const pendingCount = pendingResult.count;
  const trafficCount = trafficResult.count;
  const recentLogs = logsResult.data;

  return (
    <div className="flex flex-col gap-8">
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Film size={24} className="text-yellow-500" />} 
          label="Total Konten" 
          value={contentCount || 0} 
          trend="Total film & series"
        />
        <StatCard 
          icon={<Users size={24} className="text-sky-400" />} 
          label="Admin Aktif" 
          value={usersCount || 0} 
          trend="Role-based access"
        />
        <StatCard 
          icon={<Activity size={24} className="text-emerald-500" />} 
          label="Menunggu Review" 
          value={pendingCount || 0} 
          trend="Butuh tindakan"
          isAlert={Boolean(pendingCount && pendingCount > 0)}
        />
        <StatCard 
          icon={<BarChart3 size={24} className="text-violet-500" />} 
          label="Aktivitas Nonton Hari Ini" 
          value={trafficCount || 0} 
          trend="Pemutaran video harian"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Activity (Audit Logs) Preview */}
        <section className="glass p-8 rounded-3xl lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-white">Aktivitas Admin Terbaru</h3>
            <button className="text-yellow-500 font-bold text-sm hover:underline">Lihat Semua</button>
          </div>
          <div className="flex flex-col gap-4">
            {recentLogs?.map((log) => (
              <div key={log.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  log.action.includes('Approved') ? 'bg-emerald-500' : log.action.includes('Rejected') ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <div className="flex-1">
                  <div className="font-bold text-sm text-white">{log.action}</div>
                  <div className="text-xs text-zinc-500">Oleh: {log.profiles?.full_name || 'System'}</div>
                </div>
                <div className="text-xs text-zinc-600 flex items-center gap-1.5 font-medium">
                  <Clock size={14} /> {new Date(log.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {(!recentLogs || recentLogs.length === 0) && (
              <div className="text-center py-12 text-zinc-500 font-medium">Belum ada log aktivitas.</div>
            )}
          </div>
        </section>

        {/* Quick Actions / Summary */}
        <div className="flex flex-col gap-6">
          <div className="glass p-8 rounded-3xl bg-yellow-500/5 border border-yellow-500/10">
            <h4 className="text-yellow-500 font-black text-xs uppercase tracking-widest mb-6">Status Sistem</h4>
            <div className="flex flex-col gap-4">
              <StatusItem label="Database Supabase" status="Operational" />
              <StatusItem label="TMDB API" status="Operational" />
              <StatusItem label="Embed Providers" status="98.2% Up" />
            </div>
          </div>
          
          <div className="glass p-8 rounded-3xl">
            <h4 className="text-white font-black text-sm mb-6">Admin Teratas</h4>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">AD</div>
                <div className="text-sm font-bold text-zinc-300">Administrator</div>
                <div className="ml-auto text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-lg">45 actions</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, isAlert = false }: any) {
  return (
    <div className={`glass p-6 rounded-3xl flex flex-col gap-4 border transition-all ${
      isAlert ? 'border-red-500/30 bg-red-500/5' : 'border-white/5 hover:border-white/10'
    }`}>
      <div className="flex justify-between items-start">
        <div className="p-3 bg-white/5 rounded-2xl">
          {icon}
        </div>
        <ArrowUpRight size={18} className="text-zinc-600" />
      </div>
      <div>
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</div>
        <div className="text-3xl font-black text-white mt-1">{value}</div>
      </div>
      <div className={`text-xs font-bold ${isAlert ? 'text-red-500' : 'text-emerald-500'}`}>{trend}</div>
    </div>
  );
}

function StatusItem({ label, status }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium text-zinc-400">{label}</span>
      <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {status}
      </span>
    </div>
  );
}
