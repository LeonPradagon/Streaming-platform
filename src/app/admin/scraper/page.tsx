"use client";

import { useState, useEffect } from 'react';
import { 
  Play, 
  RefreshCw, 
  Activity, 
  Zap, 
  History,
  Terminal,
  Clock,
  XCircle,
  Subtitles,
  Info,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { adminAlert } from '@/lib/swal';
import { motion, AnimatePresence } from 'framer-motion';

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
      .limit(15);
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
    const logsInterval = setInterval(fetchLogs, 3000);
    
    const channel = supabase
      .channel('scraper-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scraper_logs' }, (payload) => {
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
      `Jalankan ${taskType}? Proses ini berjalan secara otomatis di background.`,
      'Ya, Jalankan'
    );
    if (!confirm.isConfirmed) return;

    setIsLoading(true);
    setActiveTask(taskType);
    
    let currentState = {};
    let isRunning = true;
    let accumulatedSummary = { items_processed: 0, items_added: 0, items_failed: 0 };
    let totalItemsEstimated = 100;

    try {
      while (isRunning) {
        const response = await fetch('/api/scraper/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: taskType, state: currentState })
        });
        
        if (!response.ok) break;

        const data = await response.json();
        if (data.total) totalItemsEstimated = data.total;
        if (data.summary) {
          accumulatedSummary.items_processed += data.summary.items_processed || 0;
        }

        if (data.hasMore && data.nextState) {
          currentState = data.nextState;
          await new Promise(resolve => setTimeout(resolve, 800));
        } else {
          isRunning = false;
          adminAlert.success('Selesai', `Tugas ${taskType} berhasil diselesaikan.`);
        }
        fetchLogs();
      }
    } catch (err) {
      adminAlert.error('Error', 'Koneksi terputus.');
    } finally {
      setIsLoading(false);
      setActiveTask(null);
      setProgress(null);
    }
  };

  const stopTask = async () => {
    const confirm = await adminAlert.confirm('Berhenti?', 'Hentikan paksa scraper?', 'Ya');
    if (!confirm.isConfirmed) return;
    try { await fetch('/api/scraper/stop', { method: 'POST' }); } catch(e) {}
    window.location.reload();
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Premium Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-600 rounded-2xl shadow-[0_0_20px_rgba(229,9,20,0.4)]">
              <ShieldCheck className="text-white" size={32} />
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Scraper <span className="text-red-600">Command</span></h2>
          </div>
          <p className="text-gray-500 font-bold tracking-widest text-[10px] uppercase ml-1">Automated Content Engine v4.0</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">System Healthy</span>
          </div>
          <button onClick={fetchHealth} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <RefreshCw size={18} className="text-gray-400" />
          </button>
        </div>
      </motion.div>

      {/* Futuristic Control Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { id: 'scrape', title: 'Discovery', desc: 'Scan TMDB for new arrivals', icon: Play, color: '#eab308' },
          { id: 'trending', title: 'Trending', desc: 'Sync viral weekly content', icon: Zap, color: '#f43f5e' },
          { id: 'sync', title: 'Metadata', desc: 'Refresh info & images', icon: RefreshCw, color: '#38bdf8' },
          { id: 'validate', title: 'Health', desc: 'Verify streaming links', icon: Activity, color: '#10b981' },
          { id: 'subtitles', title: 'Subtitles', desc: 'Auto-fetch indo subs', icon: Subtitles, color: '#8b5cf6' },
        ].map((task, idx) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <ControlCard 
              {...task}
              onClick={() => runTask(task.id)}
              loading={activeTask === task.id}
            />
          </motion.div>
        ))}
      </div>

      {/* Glowing Progress Bar */}
      <AnimatePresence>
        {progress && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 backdrop-blur-3xl relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] -z-10" />
              <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="animate-spin text-red-500" size={24} />
                    <h3 className="text-2xl font-black uppercase tracking-tighter">System Processing...</h3>
                  </div>
                  <p className="text-gray-500 font-bold text-xs uppercase tracking-widest truncate max-w-md">
                    Target: <span className="text-white">{progress.current_item || 'Indexing...'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-6xl font-black text-white tracking-tighter tabular-nums">
                    {Math.round((progress.current / (progress.total || 1)) * 100)}%
                  </span>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{progress.current} / {progress.total} ITEMS</span>
                    <button onClick={stopTask} className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1">
                      <XCircle size={14} /> Stop Engine
                    </button>
                  </div>
                </div>
              </div>
              <div className="h-4 w-full bg-white/5 rounded-full p-1 border border-white/5 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                  className="h-full bg-gradient-to-r from-red-600 via-red-500 to-indigo-500 rounded-full shadow-[0_0_20px_rgba(229,9,20,0.5)]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Activity Logs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
              <History className="text-gray-600" /> Activity Stream
            </h3>
            <div className="h-px flex-1 mx-6 bg-white/5" />
            <button onClick={() => setShowDebug(true)} className="flex items-center gap-2 text-[10px] font-black text-gray-500 hover:text-white transition-colors uppercase tracking-widest">
              <Terminal size={14} /> Open Debugger
            </button>
          </div>
          
          <div className="rounded-[2rem] border border-white/5 overflow-hidden bg-white/[0.02]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <th className="px-8 py-5">Task Name</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Summary</th>
                  <th className="px-8 py-5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="group hover:bg-white/5 transition-all">
                    <td className="px-8 py-5">
                      <div className="font-black text-white/80 group-hover:text-red-500 transition-colors uppercase tracking-tighter">{log.task_name}</div>
                      {log.error_message && <div className="text-[10px] text-red-500/60 font-bold truncate max-w-[200px] mt-1">{log.error_message}</div>}
                    </td>
                    <td className="px-8 py-5">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-xs font-black text-gray-400 tabular-nums uppercase">
                        {log.summary?.items_added ? `+${log.summary.items_added} items` : 'No items added'}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right text-[10px] font-black text-gray-600 uppercase tracking-tighter">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Health */}
        <div className="space-y-8">
          <div className="p-8 rounded-[2.5rem] border border-white/10 bg-white/[0.02] space-y-8 backdrop-blur-xl">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Integrations Health</h3>
            <div className="space-y-6">
              {providers.map((p) => (
                <div key={p.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${p.isHealthy ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                    <span className="text-xs font-black text-gray-400 group-hover:text-white transition-colors uppercase tracking-tight">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-[10px] font-black uppercase ${p.isHealthy ? 'text-emerald-500' : 'text-red-500'}`}>{p.status}</div>
                    <div className="text-[9px] text-gray-600 font-bold">{p.delay}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <h4 className="text-[10px] font-black text-white uppercase flex items-center gap-2">
                <Info size={12} className="text-red-500" /> Pro Tip
              </h4>
              <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                Deep Discovery akan melanjutkan dari page TMDB terakhir yang tersimpan di settings. Tidak perlu takut duplikasi.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Debugger Modal Overlay */}
      <AnimatePresence>
        {showDebug && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-12">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDebug(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl h-full rounded-[3rem] bg-[#0f0f0f] border border-white/10 overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-500 rounded-2xl">
                    <Terminal size={24} className="text-black" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Engine Debug Logs</h3>
                </div>
                <button onClick={() => setShowDebug(false)} className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-full transition-all">
                  <XCircle size={32} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-6 bg-black/20 custom-scrollbar">
                {logs.map((log) => (
                  <div key={log.id} className="p-8 rounded-3xl bg-white/[0.03] border border-white/5">
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Timestamp: {new Date(log.created_at).toLocaleString()}</span>
                        <h4 className="text-lg font-black text-yellow-500 uppercase tracking-tighter">{log.task_name}</h4>
                      </div>
                      <StatusBadge status={log.status} />
                    </div>
                    {log.error_message ? (
                      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                        Error: {log.error_message}
                      </div>
                    ) : (
                      <div className="text-emerald-500 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <ChevronRight size={14} /> Processed successfully
                      </div>
                    )}
                    {log.summary && (
                      <pre className="mt-6 p-6 rounded-2xl bg-black/60 text-[11px] text-gray-500 font-mono overflow-x-auto border border-white/5">
                        {JSON.stringify(log.summary, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ControlCard({ title, desc, icon: Icon, onClick, loading, color }: any) {
  return (
    <div className="p-8 rounded-[2rem] bg-white/5 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all duration-500 shadow-xl">
      <div className="absolute -right-6 -top-6 opacity-[0.02] group-hover:opacity-[0.1] transition-all duration-700">
        <Icon size={140} />
      </div>
      <div 
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-2xl transition-transform group-hover:scale-110" 
        style={{ backgroundColor: `${color}20`, color }}
      >
        <Icon size={24} />
      </div>
      <div className="space-y-2 mb-8">
        <h3 className="text-xl font-black text-white group-hover:text-red-500 transition-colors uppercase tracking-tighter leading-none">{title}</h3>
        <p className="text-[10px] font-bold text-gray-500 leading-relaxed uppercase tracking-widest">{desc}</p>
      </div>
      <button 
        onClick={onClick}
        disabled={loading}
        className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 ${
          loading ? 'bg-white/5 text-gray-600' : 'bg-white text-black hover:bg-red-600 hover:text-white'
        }`}
      >
        {loading ? <RefreshCw className="animate-spin" size={14} /> : <><Play size={14} fill="currentColor" /> Run</>}
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
    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles[status]}`}>
      {status}
    </span>
  );
}
