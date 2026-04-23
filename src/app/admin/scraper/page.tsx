"use client";

import { useState, useEffect } from 'react';
import { 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Zap, 
  History,
  Terminal,
  Clock,
  ExternalLink,
  XCircle,
  Subtitles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLATFORM_COLORS } from '@/lib/tmdb';
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
      // If the latest log is running, update the progress state
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
    
    // Polling health every 30 seconds
    const healthInterval = setInterval(fetchHealth, 30000);
    
    // Polling logs every 2 seconds if a task is running (fallback for realtime)
    const logsInterval = setInterval(() => {
      fetchLogs();
    }, 2000);
    
    // Subscribe to real-time updates for scraper_logs
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
        fetchLogs(); // Always refresh list on any change
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
      `Apakah Anda yakin ingin menjalankan ${taskType}? Ini mungkin memakan waktu beberapa menit.`,
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
        adminAlert.success('Tugas Dimulai!', 'Cek progress bar di bawah untuk status real-time.');
        fetchLogs(); // Immediately refresh to show the new 'running' task in history
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

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black flex items-center gap-3">
          <Zap className="text-yellow-500" /> Control Tower Scraper
        </h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-green-500 uppercase tracking-wider">System Ready</span>
        </div>
      </div>

      {/* Control Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <ControlCard 
          title="Deep Discovery"
          desc="Cari film baru dengan tracker halaman. Melanjutkan dari scrape terakhir."
          icon={<Play size={24} />}
          onClick={() => runTask('scrape')}
          loading={activeTask === 'scrape'}
          color="#eab308"
        />
        <ControlCard 
          title="Trending Now"
          desc="Ambil konten yang sedang viral di TMDB minggu ini secara instan."
          icon={<Zap size={24} />}
          onClick={() => runTask('trending')}
          loading={activeTask === 'trending'}
          color="#f43f5e"
        />
        <ControlCard 
          title="Metadata Sync"
          desc="Sinkronkan ulang Genre & Seasons untuk semua konten lama."
          icon={<RefreshCw size={24} />}
          onClick={() => runTask('sync')}
          loading={activeTask === 'sync'}
          color="#38bdf8"
        />
        <ControlCard 
          title="Health Check"
          desc="Validasi link video apakah masih aktif atau sudah diblokir."
          icon={<Activity size={24} />}
          onClick={() => runTask('validate')}
          loading={activeTask === 'validate'}
          color="#10b981"
        />
        <ControlCard 
          title="Sync Subtitles"
          desc="Unduh otomatis subtitle Indonesia/English untuk semua film di database."
          icon={<Subtitles size={24} />}
          onClick={() => runTask('subtitles')}
          loading={activeTask === 'subtitles'}
          color="#8b5cf6"
        />
      </div>

      {/* Real-time Progress Bar */}
      {progress && (
        <div className="glass p-8 rounded-2xl border border-primary/20 bg-primary/5 animate-in slide-in-from-top duration-500">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <RefreshCw className="animate-spin text-primary" size={20} />
                Sedang Memproses...
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Memproses: <span className="text-primary font-bold">{progress.current_item || 'Menghitung...'}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-primary">
                {Math.round((progress.current / (progress.total || 1)) * 100)}%
              </span>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                {progress.current} / {progress.total} Item
              </p>
            </div>
          </div>
          
          <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
            <div 
              className="h-full bg-gradient-to-r from-primary to-yellow-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(234,179,8,0.3)]"
              style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area: Logs and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        
        {/* Histori Log */}
        <section className="glass rounded-2xl overflow-hidden border border-white/5">
          <div className="p-6 border-b border-white/5 bg-white/2">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <History size={20} className="text-gray-400" /> Histori Aktivitas
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-xs font-black uppercase tracking-widest border-b border-white/5">
                  <th className="px-6 py-4">Tugas</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Mulai</th>
                  <th className="px-6 py-4">Durasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/2 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-white group-hover:text-primary transition-colors">{log.task_name}</div>
                      {log.error_message && <div className="text-[10px] text-red-500 mt-1 max-w-[200px] truncate">{log.error_message}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-gray-400">
                        {log.summary?.items_added !== undefined ? `+${log.summary.items_added}` : log.items_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-semibold">
                      {new Date(log.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock size={12} /> {log.finished_at ? 'Selesai' : 'Running...'}
                      </div>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">Belum ada aktivitas scraper tercatat.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Status Panel */}
        <div className="flex flex-col gap-6">
          <div className="glass p-6 rounded-2xl border border-white/5">
            <h4 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Integrasi Provider</h4>
            <div className="space-y-4">
               {providers.length > 0 ? (
                 providers.map((p) => (
                   <ProviderStatus key={p.name} name={p.name} status={p.status} delay={p.delay} isHealthy={p.isHealthy} />
                 ))
               ) : (
                 <div className="text-xs text-gray-500 italic animate-pulse">Checking status...</div>
               )}
            </div>
            <button 
              onClick={() => setShowDebug(true)}
              className="w-full mt-6 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
            >
               <Terminal size={14} /> Buka Debug Console
            </button>
          </div>

          <div className="glass p-6 rounded-2xl border border-white/5 bg-primary/5">
             <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-2">Tips Scraper</h4>
             <p className="text-xs text-gray-400 leading-relaxed">
               Gunakan <b>Full Discovery</b> hanya saat malam hari atau saat traffic rendah untuk mengurangi beban TMDB API. 
               <b>Health Check</b> disarankan dilakukan 2 hari sekali.
             </p>
          </div>
        </div>
      </div>

      {/* Debug Console Modal */}
      {showDebug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass w-full max-w-4xl max-h-[80vh] rounded-3xl border border-white/10 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-3">
                <Terminal className="text-primary" />
                <h3 className="text-xl font-black">Scraper Debug Console</h3>
              </div>
              <button 
                onClick={() => setShowDebug(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <XCircle className="text-gray-500 hover:text-white" size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-black/40 font-mono text-sm">
              <div className="space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-primary font-bold">[{new Date(log.created_at).toLocaleTimeString()}] {log.task_name}</span>
                      <StatusBadge status={log.status} />
                    </div>
                    {log.error_message ? (
                      <div className="text-red-400 bg-red-400/5 p-3 rounded border border-red-400/10 mt-2">
                        ERROR: {log.error_message}
                      </div>
                    ) : (
                      <div className="text-green-400">Task completed successfully. Item processed: {log.items_count || 0}</div>
                    )}
                    {log.summary && (
                      <pre className="text-[10px] text-gray-500 mt-2 opacity-60">
                        {JSON.stringify(log.summary, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-white/2 border-t border-white/10 text-center">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                Showing latest {logs.length} operations. Real-time updates active.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlCard({ title, desc, icon, onClick, loading, color }: any) {
  return (
    <div className="glass p-6 rounded-2xl border border-white/5 flex flex-col gap-4 relative overflow-hidden group">
      <div 
        className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity"
        style={{ color }}
      >
        {icon}
      </div>
      <div className="p-3 bg-white/5 rounded-xl w-fit" style={{ color }}>
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-1 leading-relaxed">{desc}</p>
      </div>
      <button 
        onClick={onClick}
        disabled={loading}
        className={`mt-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
          loading ? 'bg-gray-700 cursor-not-allowed' : 'bg-white text-black hover:bg-primary hover:text-white group-hover:scale-[1.02]'
        }`}
      >
        {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Jalankan Sekarang'}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    running: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    success: 'bg-green-500/10 text-green-500 border-green-500/20',
    failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return (
    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter border ${styles[status]}`}>
      {status}
    </span>
  );
}

function ProviderStatus({ name, status, delay, isHealthy }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs font-bold text-gray-300">{name}</span>
      </div>
      <div className="text-right">
        <div className={`text-[10px] font-bold ${isHealthy ? 'text-green-500' : 'text-red-500'}`}>{status}</div>
        <div className="text-[9px] text-gray-500">{delay}</div>
      </div>
    </div>
  );
}
