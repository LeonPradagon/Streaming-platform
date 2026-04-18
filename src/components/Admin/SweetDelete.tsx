'use client';

import { adminAlert } from '@/lib/swal';
import { Trash2 } from 'lucide-react';

export default function SweetDelete({ contentId, contentTitle, deleteAction }: { 
  contentId: string, 
  contentTitle: string,
  deleteAction: (id: string) => Promise<any> 
}) {
  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await adminAlert.confirm(
      'Hapus Konten?', 
      `Apakah Anda yakin ingin menghapus "${contentTitle}"? Tindakan ini tidak dapat dibatalkan.`, 
      'Ya, Hapus'
    );
    
    if (result.isConfirmed) {
      adminAlert.loading('Menghapus...');
      const res = await deleteAction(contentId);
      adminAlert.close();
      if (res?.success === false) {
        adminAlert.error('Gagal!', res.error || 'Terjadi kesalahan saat menghapus.');
      } else {
        adminAlert.success('Terhapus!', 'Konten berhasil dihapus.');
      }
    }
  };

  return (
    <form onSubmit={handleDelete}>
      <button 
        type="submit" 
        title="Delete" 
        style={{ 
          padding: '0.5rem', 
          borderRadius: '0.5rem', 
          border: 'none', 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          color: '#ef4444', 
          cursor: 'pointer' 
        }}
      >
        <Trash2 size={18} />
      </button>
    </form>
  );
}
