import type { ReactNode } from 'react';
import { X } from 'lucide-react';

// 아래에서 올라오는 시트 (설정 등)
export function Sheet({ title, icon, onClose, children }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90%] overflow-y-auto bg-panel border-t border-line rounded-t-[2rem] px-4 pt-3 pb-8 flex flex-col gap-3 tab-in"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-faint rounded-full self-center mb-1" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-black">{icon}{title}</div>
          <button onClick={onClose} aria-label="닫기" className="chip p-2 text-dim"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inset p-4 flex flex-col gap-3">
      <h3 className="text-[10px] font-black tracking-[0.2em] text-dim uppercase">{title}</h3>
      {children}
    </section>
  );
}
