import { createClient } from '@/lib/supabase/server';
import { 
  CheckCircle2, 
  XCircle, 
  Info,
  Clock
} from 'lucide-react';

export default async function AuditPage() {
  const supabase = await createClient();

  // Fetch audit logs with profile details
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name, role)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Audit Trails</h2>
          <p className="text-zinc-500 font-medium mt-1">Lacak semua tindakan administratif untuk keamanan platform.</p>
        </div>
        <button className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-white font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98]">
          Download Full Report
        </button>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="p-6 text-zinc-500 text-[10px] font-black uppercase tracking-widest">Timestamp</th>
                <th className="p-6 text-zinc-500 text-[10px] font-black uppercase tracking-widest">Administrator</th>
                <th className="p-6 text-zinc-500 text-[10px] font-black uppercase tracking-widest">Action</th>
                <th className="p-6 text-zinc-500 text-[10px] font-black uppercase tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!logs || logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <Clock size={48} />
                      <div className="font-bold italic">Belum ada log aktivitas yang tercatat.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-white">{new Date(log.created_at).toLocaleDateString()}</span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center text-xs font-black border border-sky-400/20 group-hover:bg-sky-400 group-hover:text-black transition-all">
                          {log.profiles?.full_name?.charAt(0) || 'A'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-zinc-200 truncate">{log.profiles?.full_name || 'System'}</span>
                          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">{log.profiles?.role || 'Admin'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                        log.action.includes('Approved') 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                          : log.action.includes('Rejected') 
                            ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                      }`}>
                        {log.action.includes('Approved') ? <CheckCircle2 size={14} strokeWidth={3} /> : log.action.includes('Rejected') ? <XCircle size={14} strokeWidth={3} /> : <Info size={14} strokeWidth={3} />}
                        {log.action}
                      </div>
                    </td>
                     <td className="px-6 py-4">
                      <div className="text-xs font-medium text-zinc-500 max-w-[300px] truncate group-hover:text-zinc-400 transition-colors">
                        {log.details ? (
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {Object.entries(log.details).map(([k, v]) => (
                              <span key={k} className="inline-block"><strong className="text-zinc-600 font-black uppercase text-[9px] mr-1">{k}:</strong> {String(v)}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="italic">Target ID: {log.target_id || '-'}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
