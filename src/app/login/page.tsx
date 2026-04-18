'use client';

import { login } from '@/app/auth/actions';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useState } from 'react';
import { Lock, Mail, Loader2, ChevronRight } from 'lucide-react';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function clientAction(formData: FormData) {
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#060d17',
      backgroundImage: 'radial-gradient(circle at top right, rgba(234, 179, 8, 0.05), transparent 40%), radial-gradient(circle at bottom left, rgba(56, 189, 248, 0.05), transparent 40%)',
      padding: '2rem'
    }}>
      <div className="glass" style={{ 
        width: '100%', 
        maxWidth: '450px', 
        padding: '3rem', 
        borderRadius: '2rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            backgroundColor: 'rgba(234, 179, 8, 0.1)', 
            borderRadius: '1rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: '#eab308'
          }}>
            <Lock size={32} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#f8fafc', marginBottom: '0.5rem', letterSpacing: '-1px' }}>Admin Login</h1>
          <p style={{ color: '#94a3b8' }}>Masuk untuk mengelola platform Anda</p>
        </div>

        <form action={clientAction} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)', 
              borderRadius: '0.75rem', 
              color: '#ef4444',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input 
                name="email" 
                type="email" 
                required 
                placeholder="admin@antigravity.com"
                style={{ 
                  width: '100%', 
                  padding: '0.8rem 1rem 0.8rem 3rem', 
                  borderRadius: '0.75rem', 
                  backgroundColor: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: '#f8fafc',
                  outline: 'none',
                  fontSize: '1rem'
                }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input 
                name="password" 
                type="password" 
                required 
                placeholder="••••••••"
                style={{ 
                  width: '100%', 
                  padding: '0.8rem 1rem 0.8rem 3rem', 
                  borderRadius: '0.75rem', 
                  backgroundColor: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: '#f8fafc',
                  outline: 'none',
                  fontSize: '1rem'
                }} 
              />
            </div>
          </div>

          <SubmitButton />
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', color: '#64748b' }}>
          Belum punya akun admin? <Link href="/register" style={{ color: '#eab308', fontWeight: 700 }}>Daftar di sini</Link>
        </div>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button 
      type="submit" 
      disabled={pending}
      style={{ 
        marginTop: '1rem',
        width: '100%',
        padding: '1rem',
        borderRadius: '0.75rem',
        backgroundColor: '#eab308',
        color: '#060d17',
        border: 'none',
        fontWeight: 800,
        fontSize: '1rem',
        cursor: pending ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        transition: 'all 0.2s ease',
        boxShadow: '0 10px 20px -5px rgba(234, 179, 8, 0.3)'
      }}
    >
      {pending ? <Loader2 size={20} className="animate-spin" /> : <>Login Admin <ChevronRight size={18} /></>}
    </button>
  );
}
