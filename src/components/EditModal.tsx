import { useEffect } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function EditModal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111827] border border-slate-700 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <span className="text-xs text-slate-300 uppercase tracking-widest">{title}</span>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          {children}
        </div>
      </div>
    </div>
  );
}
