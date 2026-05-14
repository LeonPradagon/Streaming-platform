import { createClient } from '@/lib/supabase/server';
import { NETWORK_CONFIGS } from '@/lib/tmdb';
import { 
  BarChart3, 
  Users, 
  Film, 
  Activity,
  ArrowUpRight,
  Clock,
  Tv,
  Radio,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

export default async function AdminOverview() {
  const supabase = await createClient();

  // ⚡ PERFORMANCE: All stat queries in parallel
  const [usersResult, contentResult, pendingResult, trafficResult, logsResult, ...platformResults] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('contents').select('*', { count: 'exact', head: true }),
    supabase.from('contents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('watch_history').select('*', { count: 'exact', head: true }).gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    supabase.from('audit_logs').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(5),
    // Platform counts
    ...NETWORK_CONFIGS.map(net =>
      supabase.from('contents').select('*', { count: 'exact', head: true }).eq('platform', net.slug).eq('status', 'approved')
    ),
    // "other" / unclassified count
    supabase.from('contents').select('*', { count: 'exact', head: true }).eq('platform', 'other').eq('status', 'approved'),
  ]);

  const usersCount = usersResult.count;
  const contentCount = contentResult.count;
  const pendingCount = pendingResult.count;
  const trafficCount = trafficResult.count;
  const recentLogs = logsResult.data;

  // Build platform stats
  const platformStats = NETWORK_CONFIGS.map((net, idx) => ({
    ...net,
    count: platformResults[idx]?.count || 0,
  }));
  const otherCount = platformResults[NETWORK_CONFIGS.length]?.count || 0;
  const totalClassified = platformStats.reduce((sum, p) => sum + p.count, 0);
  const totalApproved = totalClassified + otherCount;
  const classificationRate = totalApproved > 0 ? Math.round((totalClassified / totalApproved) * 100) : 0;

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

      {/* Network Distribution Widget */}
      <section className="glass p-8 rounded-3xl border border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
              <Radio size={20} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Distribusi Network</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Platform content breakdown</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Classification Rate */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
              classificationRate >= 80 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : classificationRate >= 50 
                  ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
              <TrendingUp size={14} />
              {classificationRate}% Terklasifikasi
            </div>
            <Link 
              href="/admin/networks"
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-zinc-400 hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest"
            >
              Kelola Network →
            </Link>
          </div>
        </div>

        {/* Platform Bars */}
        <div className="space-y-4">
          {platformStats.map(p => {
            const percentage = totalApproved > 0 ? (p.count / totalApproved) * 100 : 0;
            return (
              <div key={p.slug} className="group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black tabular-nums" style={{ color: p.color }}>{p.count}</span>
                    <span className="text-[10px] font-bold text-zinc-600 tabular-nums w-12 text-right">{percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-700 group-hover:opacity-100 opacity-80"
                    style={{ 
                      width: `${Math.max(percentage, 0.5)}%`, 
                      backgroundColor: p.color,
                      boxShadow: `0 0 12px ${p.color}40`
                    }} 
                  />
                </div>
              </div>
            );
          })}

          {/* Unclassified */}
          {otherCount > 0 && (
            <div className="group mt-2 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-700 text-white font-black text-xs shrink-0">
                    <AlertTriangle size={14} />
                  </div>
                  <span className="text-sm font-bold text-zinc-500">Belum Terklasifikasi</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-zinc-500 tabular-nums">{otherCount}</span>
                  <span className="text-[10px] font-bold text-zinc-600 tabular-nums w-12 text-right">
                    {totalApproved > 0 ? ((otherCount / totalApproved) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full bg-zinc-600"
                  style={{ width: `${totalApproved > 0 ? Math.max((otherCount / totalApproved) * 100, 0.5) : 0}%` }} 
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Activity (Audit Logs) Preview */}
        <section className="glass p-8 rounded-3xl lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-white">Aktivitas Admin Terbaru</h3>
            <Link href="/admin/audit" className="text-yellow-500 font-bold text-sm hover:underline">Lihat Semua</Link>
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
          
          {/* Quick Network Stats */}
          <div className="glass p-8 rounded-3xl">
            <h4 className="text-white font-black text-sm mb-6 flex items-center gap-2">
              <Tv size={16} className="text-red-500" /> Top Networks
            </h4>
            <div className="flex flex-col gap-3">
              {platformStats
                .sort((a, b) => b.count - a.count)
                .slice(0, 4)
                .map(p => (
                  <div key={p.slug} className="flex items-center gap-3">
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[10px] shrink-0"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <div className="text-sm font-bold text-zinc-400 flex-1">{p.name}</div>
                    <div className="text-xs font-black px-2 py-1 rounded-lg" style={{ color: p.color, backgroundColor: `${p.color}15` }}>
                      {p.count}
                    </div>
                  </div>
                ))}
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
