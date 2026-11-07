import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Play, Plus, RotateCcw, Square, TrendingUp } from 'lucide-react';
import { useMetro } from '@/store/metro';
import { useVintage, BrassPlate, DrumDigits } from '@/ui/components/Brass';
import { haptic } from '@/ui/haptic';

const PRESETS = [60, 72, 80, 92, 108, 120];
const SUBDIV = ['♩', '♫', '³', '♬'];
const MARKING = (b: number) => b < 40 ? 'Grave' : b < 60 ? 'Largo' : b < 66 ? 'Larghetto' : b < 76 ? 'Adagio' : b < 108 ? 'Andante' : b < 120 ? 'Moderato' : b < 168 ? 'Allegro' : b < 200 ? 'Presto' : 'Prestissimo';
const ACCENT_STYLE: Record<number, string> = { 2: 'bg-warn', 3: 'bg-[rgb(var(--warn)/.6)]', 1: 'bg-accent', 0: 'bg-transparent border-2 border-faint' };   // 약박 = 테마 강조색 (빈티지는 황동)

// 길게 누르면 연속 변경
function useRepeat(fn: () => void) {
  let t: ReturnType<typeof setTimeout> | null = null, iv: ReturnType<typeof setInterval> | null = null;
  const stop = () => { if (t) clearTimeout(t); if (iv) clearInterval(iv); };
  return { onPointerDown: () => { fn(); t = setTimeout(() => { iv = setInterval(fn, 70); }, 300); }, onPointerUp: stop, onPointerLeave: stop, style: { touchAction: 'none' as const } };
}

export function MetroCard() {
  const m = useMetro();
  const vintage = useVintage();
  const [confirm, setConfirm] = useState(false);
  const [showProg, setShowProg] = useState(false);
  const minus = useRepeat(() => useMetro.getState().nudge(-1));
  const plus = useRepeat(() => useMetro.getState().nudge(1));

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* 박자표 · 빠르기말 · 초기화 */}
      <div className="flex items-center gap-2">
        {([['num', m.num, m.changeNum], ['den', m.den, m.changeDen]] as const).map(([k, v, fn], i) => (
          <div key={k} className="flex items-center gap-1">
            {i === 1 && <span className="text-dim font-black italic mr-1">/</span>}
            <div className="chip flex items-center">
              <button onClick={() => fn(-1)} className="px-1.5 py-1 text-dim" aria-label={`${k} 내리기`}><ChevronDown size={14} /></button>
              <span className={`w-5 text-center font-black ${i ? 'text-accent' : ''}`}>{v}</span>
              <button onClick={() => fn(1)} className="px-1.5 py-1 text-dim" aria-label={`${k} 올리기`}><ChevronUp size={14} /></button>
            </div>
          </div>
        ))}
        <span className="ml-auto text-[11px] font-black tracking-widest text-warn font-display uppercase">{MARKING(m.bpm)}</span>
        <button onClick={() => { if (confirm) { m.reset(); setConfirm(false); } else { setConfirm(true); haptic(8); setTimeout(() => setConfirm(false), 2500); } }}
          aria-label="메트로놈 초기화" className={`chip flex items-center gap-1 ${confirm ? 'px-2.5 py-1.5 text-sharp border-sharp' : 'p-2 text-dim'}`}>
          <RotateCcw size={13} />{confirm && <span className="text-[10px] font-black">한 번 더</span>}
        </button>
      </div>

      {/* 박 (원: 강세, 음표: 박 나누기) */}
      <div className="flex justify-center gap-2 flex-wrap">
        {m.accents.map((a, i) => {
          const fired = m.playing && m.beat === i && m.flash === 'main';
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <button onClick={() => m.cycleAccent(i)} aria-label={`${i + 1}박 강세`}
                className={`${m.num > 8 ? 'w-6 h-6' : 'w-8 h-8'} rounded-full transition-all duration-75 ${ACCENT_STYLE[a]} ${fired ? 'scale-125 shadow-[0_0_14px_rgb(var(--warn))]' : m.playing && m.beat !== i ? 'opacity-45' : ''}`} />
              <button onClick={() => m.cycleSubdiv(i)} className="text-sm text-dim leading-none" aria-label={`${i + 1}박 나누기`}>{SUBDIV[(m.subdivs[i] || 1) - 1]}</button>
            </div>
          );
        })}
      </div>

      {/* BPM */}
      <div className="flex items-center gap-3">
        <button {...minus} className="w-12 h-12 rounded-full chip flex items-center justify-center active:scale-90 shrink-0" aria-label="BPM 내리기"><Minus size={18} className="text-dim pointer-events-none" /></button>
        <div className="flex-1 flex justify-center">
          {vintage
            ? <BrassPlate className="!px-4 !py-2"><DrumDigits text={String(m.bpm).padStart(3, '0')} unit="BPM" /></BrassPlate>
            : <div className="flex items-baseline gap-1"><span className={`text-5xl font-black font-mono leading-none transition-transform duration-75 ${m.flash === 'main' ? 'scale-105' : ''}`}>{m.bpm}</span><span className="text-xs font-black text-dim">BPM</span></div>}
        </div>
        <button {...plus} className="w-12 h-12 rounded-full chip flex items-center justify-center active:scale-90 shrink-0" aria-label="BPM 올리기"><Plus size={18} className="text-dim pointer-events-none" /></button>
      </div>
      <input type="range" min={30} max={250} value={m.bpm} onChange={(e) => m.setBpm(Number(e.target.value))} />

      <div className="flex gap-1.5">
        {PRESETS.map((v) => (
          <button key={v} onClick={() => { m.setBpm(v); haptic(8); }}
            className={`flex-1 py-1 rounded-pill text-[11px] font-black font-mono border ${m.bpm === v ? 'bg-accent text-onaccent border-accent' : 'border-line text-dim'}`}>{v}</button>
        ))}
      </div>

      {/* 점진 템포 */}
      <button onClick={() => setShowProg(!showProg)} className="flex items-center gap-2 text-xs font-bold text-dim">
        <TrendingUp size={14} className={m.prog.on ? 'text-accent' : ''} />
        점진 템포 {m.prog.on ? <b className="text-accent">켜짐 · {m.prog.every}마디마다 +{m.prog.step} (최대 {m.prog.max})</b> : '꺼짐'}
        <ChevronDown size={14} className={`ml-auto transition-transform ${showProg ? 'rotate-180' : ''}`} />
      </button>
      {showProg && (
        <div className="inset p-3 flex flex-col gap-2 text-xs">
          <label className="flex items-center justify-between font-bold">켜기
            <input type="checkbox" checked={m.prog.on} onChange={(e) => m.setProg({ on: e.target.checked })} className="w-5 h-5 accent-[rgb(var(--accent))]" />
          </label>
          {([['every', '몇 마디마다', 1, 16, ''], ['step', '올릴 BPM', 1, 10, '+'], ['max', '최대 BPM', 40, 250, '']] as const).map(([k, label, min, max, pre]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="font-bold">{label}</span>
              <div className="chip flex items-center">
                <button onClick={() => m.setProg({ [k]: Math.max(min, m.prog[k] - (k === 'max' ? 5 : 1)) })} className="px-2 py-1 text-dim"><Minus size={12} /></button>
                <span className="w-10 text-center font-black font-mono">{pre}{m.prog[k]}</span>
                <button onClick={() => m.setProg({ [k]: Math.min(max, m.prog[k] + (k === 'max' ? 5 : 1)) })} className="px-2 py-1 text-dim"><Plus size={12} /></button>
              </div>
            </div>
          ))}
          {m.playing && m.prog.on && <span className="text-dim">{m.bars}마디째 · 시작 {m.startBpm} BPM</span>}
        </div>
      )}

      {/* TAP + 시작 */}
      <div className="flex gap-2.5">
        <button onClick={m.tap} className="w-24 h-14 rounded-2xl chip flex flex-col items-center justify-center active:scale-95">
          <span className="text-sm font-black text-accent">TAP</span><span className="text-[8px] font-bold text-dim">박자 두드리기</span>
        </button>
        <button onClick={m.toggle}
          className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-black active:scale-[0.98] transition-colors border-2 ${m.playing ? 'bg-warn/15 text-warn border-warn/40' : 'bg-accent/15 text-accent border-accent/40'}`}>
          {m.playing ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}{m.playing ? '정지' : '박자 시작'}
        </button>
      </div>
    </div>
  );
}
