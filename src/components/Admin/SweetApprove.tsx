'use client';

import { adminAlert } from '@/lib/swal';
import { Check } from 'lucide-react';

export default function SweetApprove({ approveAllAction }: { approveAllAction: (formData: FormData) => Promise<void> }) {
  const handleApproveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await adminAlert.confirm(
      'Setujui Semua?', 
      'Semua konten pending akan langsung dipublikasikan.', 
      'Ya, Setujui Semua'
    );
    
    if (result.isConfirmed) {
      adminAlert.loading('Memproses...');
      const formData = new FormData();
      await approveAllAction(formData);
      adminAlert.success('Berhasil!', 'Semua konten telah disetujui.');
    }
  };

  return (
    <form onSubmit={handleApproveAll}>
      <button
        type="submit"
        style={{ 
          padding: '0.4rem 1rem', 
          backgroundColor: '#10b981', 
          color: '#060d17', 
          borderRadius: '2rem', 
          fontSize: '0.8rem', 
          fontWeight: 800,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          boxShadow: '0 4px 12px -2px rgba(16, 185, 129, 0.3)'
        }}
      >
        <Check size={14} /> Approve All
      </button>
    </form>
  );
}
