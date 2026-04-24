"use client";

import { useState, useEffect } from 'react';
import { 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  Activity, 
  Zap, 
  History,
  Terminal,
  Clock,
  XCircle,
  Subtitles,
  Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { adminAlert } from '@/lib/swal';

export default function ScraperAdmin() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; current_item: string } | null>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/scraper/health');
      const data = await res.json();
      if (data.providers) setProviders(data.providers);
    } catch (err) {
      console.error('Failed to fetch provider health');
    }
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('scraper_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setLogs(data);
      const latest = data[0];
      if (latest && latest.status === 'running') {
        if (latest.progress) setProgress(latest.progress);
        setActiveTask(latest.task_name);
        setIsLoading(true);
      } else if (latest && latest.status !== 'running') {
        setProgress(null);
        setActiveTask(null);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchHealth();
    
    const healthInterval = setInterval(fetchHealth, 30000);
    const logsInterval = setInterval(() => {
      fetchLogs();
    }, 2000);
    
    const channel = supabase
      .channel('scraper-status')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'scraper_logs' 
      }, (payload) => {
        const updatedLog = payload.new as any;
        if (updatedLog && updatedLog.status === 'running') {
          setProgress(updatedLog.progress);
        } else {
          setProgress(null);
        }
        fetchLogs();
      })
      .subscribe();

    return () => {
      clearInterval(healthInterval);
      clearInterval(logsInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const runTask = async (taskType: string) => {
    if (isLoading) return;
    
    const confirm = await adminAlert.confirm(
      'Konfirmasi Tugas', 
      `Jalankan ${taskType}? Proses ini berjalan di background.`,
      'Ya, Jalankan'
    );
    if (!confirm.isConfirmed) return;

    setIsLoading(true);
    setActiveTask(taskType);
    adminAlert.loading('Memulai tugas...', 'Sistem sedang mempersiapkan scraper.');
    
    try {
      const response = await fetch('/api/scraper/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskType })
      });
      
      const result = await response.json();
      adminAlert.close();
      
      if (result.success) {
        adminAlert.success('Tugas Dimulai!', 'Monitor progress bar untuk status terbaru.');
        fetchLogs();
      } else {
        adminAlert.error('Gagal!', result.error || 'Terjadi kesalahan.');
        setIsLoading(false);
        setActiveTask(null);
      }
    } catch (err) {
      adminAlert.error('Error Connection', 'Gagal menghubungi server scraper.');
      setIsLoading(false);
      setActiveTask(null);
    }
  };

  const stopTask = async () => {
    const confirm = await adminAlert.confirm(
      'Hentikan Paksa?', 
      'Apakah Anda yakin ingin menghentikan paksa scraper yang sedang berjalan?',
      'Ya, Hentikan'
    );
    if (!confirm.isConfirmed) return;

    try {
      adminAlert.loading('Menghentikan...', 'Mengirim sinyal abort ke server');
      const res = await fetch('/api/scraper/stop', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to stop scraper');
      
      adminAlert.success('Berhasil', 'Scraper berhasil dihentikan secara paksa.');
      fetchLogs(); // Segera refresh log untuk melihat status 'failed'
    } catch (err: any) {
      adminAlert.error('Gagal', err.message);
    }
  };

  return (
    <div className="flex flex-col gap-10 animate-fade-in">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Zap className="text-yellow-500" size={32} /> Control Tower Scraper
          </h2>
          <p className="text-zinc-500 font-medium mt-1">Otomasi sinkronisasi metadata, link stream, dan subtitle.</p>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl w-fit">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Core Engine Active</span>
        </div>
      </div>

      {/* Control Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <ControlCard 
          title="Deep Discovery"
          desc="Cari film baru dengan TMDB tracker. Melanjutkan state terakhir."
          icon={<Play size={24} />}
          onClick={() => runTask('scrape')}
          loading={activeTask === 'scrape'}
          color="rgba(234, 179, 8, 1)"
          bg="rgba(234, 179, 8, 0.1)"
        />
        <ControlCard 
          title="Trending"
          desc="Ambil konten viral TMDB minggu ini secara instan ke database."
          icon={<Zap size={24} />}
          onClick={() => runTask('trending')}
          loading={activeTask === 'trending'}
          color="rgba(244, 63, 94, 1)"
          bg="rgba(244, 63, 94, 0.1)"
        />
        <ControlCard 
          title="Metadata Sync"
          desc="Sinkronkan ulang Genre, Seasons & Images untuk konten lama."
          icon={<RefreshCw size={24} />}
          onClick={() => runTask('sync')}
          loading={activeTask === 'sync'}
          color="rgba(56, 189, 248, 1)"
          bg="rgba(56, 189, 248, 0.1)"
        />
        <ControlCard 
          title="Health Check"
          desc="Validasi link stream apakah masih aktif atau sudah broken."
          icon={<Activity size={24} />}
          onClick={() => runTask('validate')}
          loading={activeTask === 'validate'}
          color="rgba(16, 185, 129, 1)"
          bg="rgba(16, 185, 129, 0.1)"
        />
        <ControlCard 
          title="Subtitles"
          desc="Auto-fetch subtitle Indo/Eng untuk seluruh katalog."
          icon={<Subtitles size={24} />}
          onClick={() => runTask('subtitles')}
          loading={activeTask === 'subtitles'}
          color="rgba(139, 92, 246, 1)"
          bg="rgba(139, 92, 246, 0.1)"
        />
      </div>

      {/* Real-time Progress Bar */}
      {progress && (
        <div className="glass p-10 rounded-3xl border border-yellow-500/20 bg-yellow-500/5 animate-in slide-in-from-top duration-700 shadow-2xl shadow-yellow-500/5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                  <RefreshCw className="animate-spin text-yellow-500" size={24} />
                  Executing Pipeline...
                </h3>
                <button 
                  onClick={stopTask}
                  className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-red-500/5 active:scale-95"
                >
                  <XCircle size={14} /> Force Stop
                </button>
              </div>
              <p className="text-sm text-zinc-400 mt-2 font-medium flex items-center gap-2">
                Processing: <span className="text-yellow-500 font-black truncate max-w-[300px]">{progress.current_item || 'Scanning...'}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-5xl font-black text-yellow-500 tabular-nums">
                {Math.round((progress.current / (progress.total || 1)) * 100)}%
              </span>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[3px] mt-1">
                {progress.current} / {progress.total} Items
              </p>
            </div>
          </div>
          
          <div className="w-full h-6 bg-black/40 rounded-2xl overflow-hidden border border-white/5 p-1.5 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-300 rounded-xl transition-all duration-700 ease-out shadow-[0_0_20px_rgba(234,179,8,0.4)]"
              style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Histori Log */}
        <section className="glass rounded-3xl overflow-hidden border border-white/5 lg:col-span-2 shadow-xl">
          <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="text-xl font-black text-white flex items-center gap-3">
              <History size={24} className="text-zinc-500" /> Histori Aktivitas
            </h3>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">Latest 10 logs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-zinc-500 text-[10px] font-black uppercase tracking-[2px] border-b border-white/5">
                  <th className="px-8 py-5">Tugas</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Item</th>
                  <th className="px-8 py-5">Mulai</th>
                  <th className="px-8 py-5">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-5">
                      <div className="font-black text-sm text-zinc-300 group-hover:text-yellow-500 transition-colors uppercase tracking-tight">{log.task_name}</div>
                      {log.error_message && <div className="text-[10px] font-bold text-red-500/80 mt-1 max-w-[200px] truncate">{log.error_message}</div>}
                    </td>
                    <td className="px-8 py-5">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-sm font-black text-zinc-400 tabular-nums">
                        {log.summary?.items_added !== undefined ? `+${log.summary.items_added}` : log.items_count || 0}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs text-zinc-600 font-black uppercase tracking-tighter">
                      {new Date(log.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-[10px] text-zinc-700 font-black uppercase tracking-widest">
                        <Clock size={14} /> {log.finished_at ? 'Completed' : 'Running'}
                      </div>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-zinc-600 font-bold italic italic">Belum ada aktivitas scraper tercatat.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Status Panel */}
        <div className="flex flex-col gap-8">
          <div className="glass p-8 rounded-3xl border border-white/5 shadow-xl">
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[3px] mb-8">Service Integrations</h4>
            <div className="space-y-6">
               {providers.length > 0 ? (
                 providers.map((p) => (
                   <ProviderStatus key={p.name} name={p.name} status={p.status} delay={p.delay} isHealthy={p.isHealthy} />
                 ))
               ) : (
                 <div className="flex flex-col gap-4">
                    {[1,2,3].map(i => <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />)}
                 </div>
               )}
            </div>
            <button 
              onClick={() => setShowDebug(true)}
              className="w-full mt-10 py-4 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-2xl border border-white/5 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            >
               <Terminal size={18} /> Console Debug
            </button>
          </div>

          <div className="glass p-8 rounded-3xl border border-yellow-500/10 bg-yellow-500/[0.02]">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Info size={16} className="text-yellow-500" />
                </div>
                <h4 className="text-xs font-black text-yellow-500 uppercase tracking-[2px]">Admin Guide</h4>
             </div>
             <p className="text-xs text-zinc-500 font-medium leading-relaxed">
               Gunakan <span className="text-zinc-300 font-bold">Deep Discovery</span> untuk memperluas katalog. 
               <span className="text-zinc-300 font-bold">Health Check</span> sangat krusial untuk menjaga kualitas user experience dengan mematikan link broken secara otomatis.
             </p>
          </div>
        </div>
      </div>

      {/* Debug Console Modal */}
      {showDebug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="glass w-full max-w-4xl h-[85vh] rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)]">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-yellow-500 rounded-lg">
                  <Terminal size={20} className="text-black" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Debugger Terminal</h3>
              </div>
              <button 
                onClick={() => setShowDebug(false)}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-all flex items-center justify-center"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 font-mono text-sm bg-black/40">
              <div className="space-y-6">
                {logs.map((log) => (
                  <div key={log.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-yellow-500/20 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-yellow-500 font-black text-xs uppercase tracking-widest">[{new Date(log.created_at).toLocaleTimeString()}] {log.task_name}</span>
                      <StatusBadge status={log.status} />
                    </div>
                    {log.error_message ? (
                      <div className="text-red-400 bg-red-400/5 p-4 rounded-xl border border-red-400/10 text-xs font-bold font-sans">
                        STDOUT: {log.error_message}
                      </div>
                    ) : (
                      <div className="text-emerald-400 text-xs font-bold">{'>>>'} Operation stream success. {log.items_count || 0} entities processed.</div>
                    )}
                    {log.summary && (
                      <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5 overflow-x-auto">
                        <pre className="text-[10px] text-zinc-500 leading-relaxed font-mono">
                          {JSON.stringify(log.summary, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-8 py-5 border-t border-white/5 bg-black/60 text-center">
              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[4px]">
                Active Socket Tunnel | Real-time Stream
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlCard({ title, desc, icon, onClick, loading, color, bg }: any) {
  return (
    <div className="glass p-8 rounded-[2rem] border border-white/5 flex flex-col gap-6 relative overflow-hidden group shadow-lg hover:shadow-2xl transition-all duration-500">
      <div 
        className="absolute -right-8 -top-8 opacity-[0.03] group-hover:opacity-[0.1] group-hover:scale-125 transition-all duration-700 pointer-events-none"
        style={{ color }}
      >
        {icon && typeof icon === 'object' ? <icon.type {...icon.props} size={160} /> : null}
      </div>
      <div className="p-4 rounded-2xl w-fit border shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
           style={{ backgroundColor: bg, borderColor: `rgba(${color.match(/\d+/g)?.join(',')}, 0.2)`, color }}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-black text-white group-hover:text-yellow-500 transition-colors uppercase tracking-tight leading-tight">{title}</h3>
        <p className="text-xs text-zinc-500 mt-3 font-medium leading-relaxed group-hover:text-zinc-400 transition-colors">{desc}</p>
      </div>
      <button 
        onClick={onClick}
        disabled={loading}
        className={`mt-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[2px] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 ${
          loading ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:bg-yellow-500 group-hover:scale-[1.02]'
        }`}
      >
        {loading ? <RefreshCw className="animate-spin" size={16} /> : <><Play size={16} fill="currentColor" /> Run Now</>}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    running: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-sm ${styles[status]}`}>
      {status}
    </span>
  );
}

function ProviderStatus({ name, status, delay, isHealthy }: any) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full shadow-sm transition-all duration-500 ${isHealthy ? 'bg-emerald-500 group-hover:shadow-emerald-500/50 group-hover:scale-125' : 'bg-red-500'}`} />
        <span className="text-xs font-black text-zinc-400 group-hover:text-white transition-colors uppercase tracking-tight">{name}</span>
      </div>
      <div className="text-right">
        <div className={`text-[10px] font-black uppercase tracking-widest ${isHealthy ? 'text-emerald-500' : 'text-red-500'}`}>{status}</div>
        <div className="text-[9px] text-zinc-600 font-bold">{delay}</div>
      </div>
    </div>
  );
}
