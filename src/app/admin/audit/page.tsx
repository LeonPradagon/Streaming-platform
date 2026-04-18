import { createClient } from '@/lib/supabase/server';
import { 
  History, 
  User, 
  Calendar, 
  Activity,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Info
} from 'lucide-react';

export default async function AuditPage() {
  const supabase = await createClient();

  // Fetch audit logs with profile details
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name, role)')
    .order('created_at', { ascending: false });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Audit Trails</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Lacak semua tindakan administratif untuk keamanan platform.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={{ 
            padding: '0.6rem 1rem', 
            backgroundColor: 'rgba(255,255,255,0.03)', 
            border: '1px solid rgba(255,255,255,0.05)', 
            borderRadius: '0.75rem',
            color: '#f8fafc',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}>
            Download Report
          </button>
        </div>
      </div>

      <div className="glass" style={{ borderRadius: '1.5rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Timestamp</th>
              <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Admin</th>
              <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Action</th>
              <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {!logs || logs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '4rem', textAlign: 'center', color: '#475569' }}>
                  Belum ada log aktivitas yang tercatat.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.2s' }} className="hover:bg-white/[0.01]">
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{new Date(log.created_at).toLocaleDateString()}</span>
                      <span style={{ fontSize: '0.75rem', color: '#475569' }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '0.5rem', 
                        backgroundColor: 'rgba(56, 189, 248, 0.1)', 
                        color: '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 900
                      }}>
                        {log.profiles?.full_name?.charAt(0) || 'A'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{log.profiles?.full_name || 'System'}</span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{log.profiles?.role || 'Admin'}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '0.5rem',
                      backgroundColor: log.action.includes('Approved') ? 'rgba(16, 185, 129, 0.05)' : log.action.includes('Rejected') ? 'rgba(239, 68, 68, 0.05)' : 'rgba(234, 179, 8, 0.05)',
                      color: log.action.includes('Approved') ? '#10b981' : log.action.includes('Rejected') ? '#ef4444' : '#eab308',
                      fontSize: '0.85rem',
                      fontWeight: 700
                    }}>
                      {log.action.includes('Approved') ? <CheckCircle2 size={14} /> : log.action.includes('Rejected') ? <XCircle size={14} /> : <Info size={14} />}
                      {log.action}
                    </div>
                  </td>
                   <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.details ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {Object.entries(log.details).map(([k, v]) => (
                            <span key={k}><strong>{k}:</strong> {String(v)}</span>
                          ))}
                        </div>
                      ) : (
                        `Target ID: ${log.target_id || '-'}`
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
  );
}
