// 세로로 흐르는 음 테이프 (위 = 높은 음). 가운데 가로 바늘이 목표.
import { NOTE_NAMES } from '@/audio/detector';
import { useVintage } from '@/ui/components/Brass';

const SP = 56;   // 반음 간격(px) → 10센트 ≈ 5.6px

export function VTape({ center, active, perfect, tolerance }: { center: number; active: boolean; perfect: boolean; tolerance: number }) {
  const vintage = useVintage();
  const base = Math.round(center);
  const keys: number[] = [];
  for (let k = base - 4; k <= base + 4; k++) keys.push(k);
  const needle = !active ? 'rgb(var(--faint))' : perfect ? 'rgb(var(--good))' : 'rgb(var(--sharp))';
  return (
    <div className="relative w-full flex-1 min-h-[120px] overflow-hidden rounded-xl"
      style={vintage
        ? { background: 'linear-gradient(90deg,#c9c0a8,#f6f1e4 30%,#f6f1e4 70%,#c9c0a8)', border: '3px solid #6b4a12', boxShadow: 'inset 0 3px 8px rgba(0,0,0,.5)' }
        : { background: 'rgb(var(--inset))', border: '1px solid rgb(var(--line))' }}>
      {/* 허용 범위 띠 */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2"
        style={{ height: Math.max(2, (tolerance * 2 / 100) * SP), background: perfect ? 'rgb(var(--good) / .35)' : 'rgb(var(--good) / .12)' }} />
      {keys.map((k) => {
        const name = NOTE_NAMES[((k + 9) % 12 + 12) % 12];
        const oct = Math.floor((k + 57) / 12);
        const cur = active && k === base;
        const ink = vintage
          ? (cur ? '#1f2a14' : 'rgba(59,42,26,.5)')
          : cur ? (perfect ? 'rgb(var(--good))' : 'rgb(var(--ink))') : active ? 'rgb(var(--dim))' : 'rgb(var(--faint))';
        return (
          <div key={k} className="absolute inset-x-0 top-1/2 transition-transform duration-100 ease-out"
            style={{ height: SP, marginTop: -SP / 2, transform: `translateY(${(center - k) * SP}px)` }}>
            {Array.from({ length: 10 }, (_, j) => (
              <div key={j} className="absolute left-0" style={{ top: `${j * 10}%`, height: 1, width: j === 5 ? 14 : j === 0 ? 0 : 6,
                background: vintage ? '#3b2a1a' : 'rgb(var(--faint))', opacity: j === 5 ? 1 : 0.7 }} />
            ))}
            <div className="absolute inset-y-0 left-4 right-1 flex items-center justify-center">
              <span className="font-black leading-none font-display" style={{ fontSize: 15, color: ink }}>
                {name[0]}<span className="text-[10px] align-top">{name[1] === '#' ? '♯' : ''}</span><span className="text-[9px] opacity-60">{oct}</span>
              </span>
            </div>
          </div>
        );
      })}
      <div className="absolute inset-0 pointer-events-none" style={{ background: vintage
        ? 'linear-gradient(180deg,rgba(40,25,10,.55),transparent 22%,transparent 78%,rgba(40,25,10,.55))'
        : 'linear-gradient(180deg,rgb(var(--inset)),transparent 25%,transparent 75%,rgb(var(--inset)))' }} />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2.5px] z-10" style={{ background: needle, boxShadow: active ? `0 0 8px ${needle}` : 'none' }} />
    </div>
  );
}
