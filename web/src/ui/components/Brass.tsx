import type { ReactNode } from 'react';
import { useSettings } from '@/store/settings';

// 빈티지 테마 전용 장식 부품 (다른 테마에서는 평범한 카드로)
export const useVintage = () => useSettings((s) => s.theme) === 'vintage';

export function Screw({ className = '' }: { className?: string }) {
  return (
    <span className={`absolute w-3 h-3 rounded-full ${className}`}
      style={{ background: 'radial-gradient(circle at 35% 35%,#fff6d0,#b8902f 55%,#6b4a12)', boxShadow: '0 1px 2px rgba(0,0,0,.6)' }}>
      <span className="absolute inset-x-[2px] top-1/2 h-[1.5px] -translate-y-1/2 rotate-45 bg-[#5a3d0c]/80" />
    </span>
  );
}

export function BrassPlate({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative px-5 py-3 rounded-[22px] ${className}`}
      style={{ background: 'linear-gradient(180deg,#f3dc93,#d4ad55 30%,#b88a35 55%,#e6c879 85%,#c79b45)',
               border: '2px solid #6b4a12', boxShadow: '0 10px 30px rgba(0,0,0,.6), inset 0 2px 0 rgba(255,255,255,.5), inset 0 -2px 0 rgba(0,0,0,.25)' }}>
      <Screw className="top-1.5 left-1.5" /><Screw className="top-1.5 right-1.5" />
      <Screw className="bottom-1.5 left-1.5" /><Screw className="bottom-1.5 right-1.5" />
      {children}
    </div>
  );
}

// 칸마다 숫자가 들어가는 카운터 (Hz, BPM)
export function DrumDigits({ text, unit }: { text: string; unit?: string }) {
  const vintage = useVintage();
  return (
    <div className="flex items-end gap-[3px]">
      {text.split('').map((ch, i) => ch === '.' ? (
        <span key={i} className="text-lg font-black leading-none pb-1 text-dim">.</span>
      ) : (
        <span key={i} className="w-[22px] h-8 rounded-[4px] flex items-center justify-center font-mono text-lg font-black"
          style={vintage
            ? { background: 'linear-gradient(180deg,#bdbdbd,#fff 30%,#fff 70%,#a8a8a8)', color: '#111', border: '1px solid #3b2a1a' }
            : { background: 'rgb(var(--inset))', color: 'rgb(var(--ink))', border: '1px solid rgb(var(--line))' }}>
          {ch}
        </span>
      ))}
      {unit && <span className="ml-1 text-xs font-black pb-1" style={{ color: vintage ? '#3b2a1a' : 'rgb(var(--dim))' }}>{unit}</span>}
    </div>
  );
}
