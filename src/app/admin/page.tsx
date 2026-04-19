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

  // Fetch Stats
  const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: contentCount } = await supabase.from('contents').select('*', { count: 'exact', head: true });
  const { count: pendingCount } = await supabase.from('contents').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: trafficCount } = await supabase.from('watch_history').select('*', { count: 'exact', head: true }).gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString());
  
  // Recent Logs
  const { data: recentLogs } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
        <StatCard 
          icon={<Film size={24} color="#eab308" />} 
          label="Total Konten" 
          value={contentCount || 0} 
          trend="Total film & series"
        />
        <StatCard 
          icon={<Users size={24} color="#38bdf8" />} 
          label="Admin Aktif" 
          value={usersCount || 0} 
          trend="Role-based access"
        />
        <StatCard 
          icon={<Activity size={24} color="#10b981" />} 
          label="Menunggu Review" 
          value={pendingCount || 0} 
          trend="Butuh tindakan"
          isAlert={Boolean(pendingCount && pendingCount > 0)}
        />
        <StatCard 
          icon={<BarChart3 size={24} color="#8b5cf6" />} 
          label="Aktivitas Nonton Hari Ini" 
          value={trafficCount || 0} 
          trend="Pemutaran video harian"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        {/* Recent Activity (Audit Logs) Preview */}
        <section className="glass" style={{ padding: '2rem', borderRadius: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Aktivitas Admin Terbaru</h3>
            <button style={{ backgroundColor: 'transparent', border: 'none', color: '#eab308', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Lihat Semua</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentLogs?.map((log) => (
              <div key={log.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem', 
                padding: '1rem', 
                backgroundColor: 'rgba(255,255,255,0.02)', 
                borderRadius: '1rem' 
              }}>
                <div style={{ 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  backgroundColor: log.action.includes('Approved') ? '#10b981' : log.action.includes('Rejected') ? '#ef4444' : '#eab308' 
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{log.action}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Oleh: {log.profiles?.full_name || 'System'}</div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={14} /> {new Date(log.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {(!recentLogs || recentLogs.length === 0) && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>Belum ada log aktivitas.</div>
            )}
          </div>
        </section>

        {/* Quick Actions / Summary */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass" style={{ padding: '2rem', borderRadius: '1.5rem', backgroundColor: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.1)' }}>
            <h4 style={{ color: '#eab308', fontWeight: 900, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Status Sistem</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <StatusItem label="Database Supabase" status="Operational" />
              <StatusItem label="TMDB API" status="Operational" />
              <StatusItem label="Embed Providers" status="98.2% Up" />
            </div>
          </div>
          
          <div className="glass" style={{ padding: '2rem', borderRadius: '1.5rem' }}>
            <h4 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '1.5rem' }}>Admin Teratas</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#475569' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Administrator</div>
                <div style={{ marginLeft: 'auto', color: '#10b981', fontSize: '0.8rem' }}>45 actions</div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, isAlert = false }: any) {
  return (
    <div className="glass" style={{ 
      padding: '1.5rem', 
      borderRadius: '1.5rem', 
      border: isAlert ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '1rem' }}>
          {icon}
        </div>
        <ArrowUpRight size={18} color="#475569" />
      </div>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>{label}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.2rem' }}>{value}</div>
      </div>
      <div style={{ fontSize: '0.8rem', color: isAlert ? '#ef4444' : '#10b981', fontWeight: 600 }}>{trend}</div>
    </div>
  );
}

function StatusItem({ label, status }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{label}</span>
      <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>● {status}</span>
    </div>
  );
}
