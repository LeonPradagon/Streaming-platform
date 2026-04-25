import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('*').eq('key', 'site_config').single();
  const allowRegistrations = data?.value?.allow_registrations !== false; // Default true

  if (!allowRegistrations) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#060d17',
        padding: '2rem'
      }}>
        <div className="glass" style={{ padding: '3rem', borderRadius: '2rem', textAlign: 'center', maxWidth: '400px' }}>
          <XCircle size={64} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
          <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 900, marginBottom: '1rem' }}>Registrasi Ditutup</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Pendaftaran akun baru saat ini sedang dinonaktifkan oleh pemilik sistem.</p>
          <Link href="/login" style={{ display: 'inline-block', marginTop: '2rem', color: 'var(--primary)', fontWeight: 700 }}>Kembali ke Login</Link>
        </div>
      </div>
    );
  }

  return <RegisterForm />;
}
