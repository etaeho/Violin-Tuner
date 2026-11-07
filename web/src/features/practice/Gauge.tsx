// 음정 게이지: 드론이 울리면 드론 근음 대비 순정 음정, 아니면 가장 가까운 음 대비 센트
import { freqToNote } from '@/audio/detector';
import { intervalVsRoot } from '@/audio/intonation';
import { droneRootFreq } from '@/audio/drone';
import { useLive } from '@/store/live';
import { useTuner } from '@/store/tuner';
import { useDrone } from '@/store/drone';

export function Gauge() {
  const freq = useLive((s) => s.freq);
  const { a4, tolerance } = useTuner();
  const { playing, cfg } = useDrone();
  const live = freq !== null;
  const note = live ? freqToNote(freq!, a4) : null;
  const iv = live && playing ? intervalVsRoot(freq!, droneRootFreq(cfg, a4)) : null;
  const cents = iv ? iv.cents : note?.cents ?? 0;
  const ok = live && Math.abs(cents) <= tolerance;
  const col = !live ? 'rgb(var(--faint))' : ok ? 'rgb(var(--good))' : Math.abs(cents) <= tolerance + 15 ? 'rgb(var(--warn))' : cents > 0 ? 'rgb(var(--sharp))' : 'rgb(var(--flat))';
  const pos = Math.max(-50, Math.min(50, cents));
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black font-display leading-none" style={{ color: live ? 'rgb(var(--ink))' : 'rgb(var(--faint))' }}>
            {note ? note.name.replace('#', '♯') : '—'}<span className="text-xl text-dim">{note?.octave ?? ''}</span>
          </span>
          <span className="text-xs font-bold text-dim">{iv ? `${cfg.root.replace('#', '♯')}${cfg.octave} 기준 ${iv.name}` : '평균율 기준'}</span>
        </div>
        <span className="text-3xl font-black font-mono" style={{ color: col }}>{live ? (cents > 0 ? `+${cents}` : cents) : 0}<span className="text-sm">¢</span></span>
      </div>
      {/* −50 … +50 센트 막대 */}
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-inset border border-line" />
        <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-good/30" style={{ left: `${50 - tolerance}%`, width: `${tolerance * 2}%` }} />
        {[-50, -25, 0, 25, 50].map((t) => (
          <span key={t} className="absolute top-0 h-2 w-px bg-faint" style={{ left: `${50 + t}%` }} />
        ))}
        <div className="absolute top-0 bottom-0 w-1.5 -ml-[3px] rounded-full transition-[left] duration-100"
          style={{ left: `${50 + pos}%`, background: col, boxShadow: live ? `0 0 10px ${col}` : 'none', opacity: live ? 1 : 0.3 }} />
      </div>
      <div className="flex justify-between text-[9px] font-black text-dim -mt-1"><span>♭ −50</span><span>0</span><span>+50 ♯</span></div>
    </div>
  );
}
