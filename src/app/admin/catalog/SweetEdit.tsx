'use client';

import { useState } from 'react';
import { Edit3 } from 'lucide-react';
import EditContentModal from './EditContentModal';

export default function SweetEdit({ content }: { content: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        title="Edit Metadata" 
        className="p-2.5 rounded-xl bg-white/5 text-zinc-400 hover:bg-yellow-500 hover:text-black transition-all border border-white/5 hover:border-yellow-500/50"
      >
        <Edit3 size={18} />
      </button>

      {isOpen && (
        <EditContentModal 
          content={content} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  );
}
