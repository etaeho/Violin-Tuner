import { Minus, Play, Plus, Square } from 'lucide-react';
import { DRONE_INTERVALS, droneNotes, droneRootFreq, type Timbre } from '@/audio/drone';
import { useDrone } from '@/store/drone';
import { useTuner } from '@/store/tuner';
import { haptic } from '@/ui/haptic';

const FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
const QUICK = [{ root: 'G', octave: 3 }, { root: 'D', octave: 4 }, { root: 'A', octave: 4 }, { root: 'E', octave: 5 }];
const TIMBRES: { id: Timbre; label: string }[] = [{ id: 'cello', label: '첼로' }, { id: 'organ', label: '오르간' }, { id: 'soft', label: '부드럽게' }];
const sh = (n: string) => n.replace('#', '♯');

export function DroneCard() {
  const { cfg, playing, update, toggleInterval, setTimbre, toggle } = useDrone();
  const a4 = useTuner((s) => s.a4);
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {droneNotes(cfg).map((n, i) => <span key={i} className={`chip px-2 py-0.5 text-xs font-black font-mono ${i === 0 ? 'text-accent' : ''}`}>{sh(n)}</span>)}
        </div>
        <span className="text-[11px] font-mono font-bold text-dim">{droneRootFreq(cfg, a4).toFixed(1)} Hz</span>
      </div>

      {/* 근음: 5도권 순서 */}
      <div className="grid grid-cols-6 gap-1.5">
        {FIFTHS.map((n) => (
          <button key={n} onClick={() => { update({ root: n }); haptic(8); }}
            className={`py-2 rounded-xl text-sm font-black font-display border transition-all active:scale-90 ${cfg.root === n ? 'bg-accent text-onaccent border-accent' : 'bg-chip border-line text-ink'}`}>{sh(n)}</button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {QUICK.map((q) => (
          <button key={q.root} onClick={() => { update(q); haptic(8); }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-black border ${cfg.root === q.root && cfg.octave === q.octave ? 'border-accent text-accent' : 'border-line text-dim'}`}>
            {q.root}<span className="text-[9px] opacity-60">{q.octave}</span>
          </button>
        ))}
        <div className="chip flex items-center">
          <button onClick={() => update({ octave: Math.max(2, cfg.octave - 1) })} className="px-2 py-1.5 text-dim" aria-label="옥타브 내리기"><Minus size={12} /></button>
          <span className="text-[10px] font-black text-dim w-9 text-center">옥타브 <b className="text-ink">{cfg.octave}</b></span>
          <button onClick={() => update({ octave: Math.min(6, cfg.octave + 1) })} className="px-2 py-1.5 text-dim" aria-label="옥타브 올리기"><Plus size={12} /></button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {DRONE_INTERVALS.map((iv) => (
          <button key={iv.id} onClick={() => toggleInterval(iv.id)}
            className={`py-1.5 rounded-xl text-xs font-black border ${cfg.intervals[iv.id] ? 'bg-accent/15 text-accent border-accent/50' : 'border-line text-dim'}`}>+ {iv.label}</button>
        ))}
      </div>

      <div className="flex inset p-1 gap-1 !rounded-pill">
        {TIMBRES.map((t) => (
          <button key={t.id} onClick={() => setTimbre(t.id)}
            className={`flex-1 py-1 rounded-pill text-xs font-black ${cfg.timbre === t.id ? 'bg-accent text-onaccent' : 'text-dim'}`}>{t.label}</button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[10px] font-black text-dim">
        <span className="w-8">볼륨</span>
        <input type="range" min={0} max={1} step={0.05} value={cfg.volume} onChange={(e) => update({ volume: Number(e.target.value) })} className="flex-1" />
        <span className="w-8 text-right font-mono text-ink">{Math.round(cfg.volume * 100)}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] font-black text-dim">
        <span className="w-8">페이드</span>
        <input type="range" min={0} max={3} step={0.1} value={cfg.fade} onChange={(e) => update({ fade: Number(e.target.value) })} className="flex-1" />
        <span className="w-8 text-right font-mono text-ink">{cfg.fade.toFixed(1)}s</span>
      </div>

      <button onClick={toggle}
        className={`h-12 rounded-2xl flex items-center justify-center gap-2 font-black border-2 active:scale-[0.98] ${playing ? 'bg-warn/15 text-warn border-warn/40' : 'bg-accent/15 text-accent border-accent/40'}`}>
        {playing ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{playing ? '드론 정지' : '드론 시작'}
      </button>
    </div>
  );
}
