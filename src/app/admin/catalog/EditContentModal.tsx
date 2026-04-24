'use client';

import { useState } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2,
  User,
  Film
} from 'lucide-react';
import { adminAlert } from '@/lib/swal';
import { updateContentMetadata } from './actions';

interface CastMember {
  id: number | string;
  name: string;
  character: string;
  profile_path: string | null;
}

export default function EditContentModal({ 
  content, 
  onClose 
}: { 
  content: any, 
  onClose: () => void 
}) {
  const [title, setTitle] = useState(content.title);
  const [cast, setCast] = useState<CastMember[]>(content.cast_data || []);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddActor = () => {
    setCast([...cast, { id: Date.now(), name: '', character: '', profile_path: null }]);
  };

  const handleRemoveActor = (index: number) => {
    setCast(cast.filter((_, i) => i !== index));
  };

  const handleActorChange = (index: number, field: keyof CastMember, value: string) => {
    const newCast = [...cast];
    newCast[index] = { ...newCast[index], [field]: value };
    setCast(newCast);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateContentMetadata(content.id, {
        title,
        cast_data: cast
      });

      if (result.success) {
        adminAlert.success('Berhasil!', 'Metadata konten telah diperbarui.');
        onClose();
      } else {
        adminAlert.error('Gagal!', result.error || 'Terjadi kesalahan.');
      }
    } catch (err) {
      adminAlert.error('Error!', 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-yellow-500 rounded-lg">
              <Film size={20} className="text-black" />
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">Edit Metadata</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-all flex items-center justify-center"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 custom-scrollbar">
          {/* Title field */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[2px]">Judul Konten</label>
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold focus:outline-none focus:border-yellow-500/50 transition-all"
            />
          </div>

          {/* Cast management */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[2px]">Pemain / Aktor</label>
              <button 
                onClick={handleAddActor}
                className="flex items-center gap-2 text-[10px] font-black text-yellow-500 uppercase tracking-widest hover:text-yellow-400 transition-colors"
              >
                <Plus size={14} /> Tambah Aktor
              </button>
            </div>

            <div className="grid gap-3">
              {cast.map((actor, idx) => (
                <div key={actor.id} className="flex gap-3 items-center group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-600 shrink-0 border border-white/5 group-hover:border-yellow-500/30 transition-colors">
                    <User size={18} />
                  </div>
                  <input 
                    placeholder="Nama Aktor"
                    value={actor.name}
                    onChange={(e) => handleActorChange(idx, 'name', e.target.value)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500/30 transition-all"
                  />
                  <input 
                    placeholder="Peran (Karakter)"
                    value={actor.character}
                    onChange={(e) => handleActorChange(idx, 'character', e.target.value)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500/30 transition-all"
                  />
                  <button 
                    onClick={() => handleActorChange(idx, 'profile_path', actor.profile_path ? '' : '/placeholder')}
                    className={`p-3 rounded-xl border transition-all ${actor.profile_path ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-zinc-500 border-white/5 hover:border-red-500/20 hover:text-red-500'}`}
                    title="Profile Image Path (Optional)"
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    onClick={() => handleRemoveActor(idx)}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {cast.length === 0 && (
                <div className="p-8 text-center bg-white/2 border border-dashed border-white/5 rounded-2xl text-zinc-600 text-sm italic">
                  Belum ada aktor yang ditambahkan.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-black/60 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-[2px] rounded-2xl shadow-xl shadow-yellow-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
          >
            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}

function RefreshCw({ size, className }: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
