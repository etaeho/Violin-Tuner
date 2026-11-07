import { useEffect, useRef, useState } from 'react';
import { Flame, Play, Square, Target, X } from 'lucide-react';
import { freqToNote } from '@/audio/detector';
import { VIOLIN_STRINGS } from '@/audio/strings';
import { playTone, stopTone } from '@/audio/synth';
import { KEYS, pretty, scaleSemitones, semitoneLabel, spellInKey, CHROMATIC } from '@/music/keys';
import { mergePer } from '@/music/practiceLog';
import { useFingerboard } from '@/store/fingerboard';
import { useLive, noteSinks } from '@/store/live';
import { useTuner } from '@/store/tuner';
import { useMetro } from '@/store/metro';
import { useLog } from '@/store/log';
import { haptic } from '@/ui/haptic';

const POSITIONS = 16;          // 개방현 + 15칸 (대략 4포지션까지)

export function FingerboardScreen() {
  const { key, heat, setKey, toggleHeat } = useFingerboard();
  const { a4, tolerance } = useTuner();
  const freq = useLive((s) => s.freq);
  const { playing, setPlaying } = useLive();
  const metro = useMetro();
  const days = useLog((s) => s.days);
  const per = heat ? mergePer(days, 30) : {};

  const detected = freq ? freqToNote(freq, a4) : null;
  const scale = useScalePractice(key);

  const flashCol = metro.playing && metro.flash === 'main' ? (metro.accents[metro.beat] === 2 ? 'rgb(var(--warn))' : 'rgb(var(--accent))') : null;
  const downbeat = metro.flash === 'main' && metro.beat === 0;

  const tap = (semi: number) => {
    const label = semitoneLabel(semi);
    haptic(10);
    if (playing === label) { stopTone(); setPlaying(null); return; }
    playTone(a4 * 2 ** (semi / 12)); setPlaying(label);
  };

  return (
    <div className="h-full flex flex-col gap-2.5 tab-in">
      {/* 조표 · 히트맵 · 스케일 연습 · 박자 */}
      <div className="flex items-center gap-2 shrink-0">
        <select value={key} onChange={(e) => setKey(e.target.value)} className="chip px-2.5 py-1.5 text-xs font-black text-ink outline-none max-w-[118px]">
          {KEYS.map((k) => <option key={k.id} value={k.id} className="bg-panel">{k.label}</option>)}
        </select>
        <button onClick={() => { toggleHeat(); haptic(8); }} className={`chip flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-black whitespace-nowrap shrink-0 ${heat ? 'text-sharp border-sharp/50' : 'text-dim'}`}>
          <Flame size={12} />히트맵
        </button>
        <button onClick={scale.active ? scale.stop : scale.start} className={`chip flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-black whitespace-nowrap shrink-0 ${scale.active ? 'text-accent border-accent/50' : 'text-dim'}`}>
          <Target size={12} />스케일
        </button>
        <button onClick={metro.toggle} aria-label="박자" className="ml-auto chip flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 transition-shadow shrink-0"
          style={flashCol ? { borderColor: flashCol, boxShadow: `0 0 12px ${flashCol}` } : {}}>
          {metro.accents.slice(0, 8).map((a, i) => (
            <span key={i} className="rounded-full transition-all duration-75" style={{
              width: metro.playing && metro.beat === i && metro.flash === 'main' ? 9 : 6, height: metro.playing && metro.beat === i && metro.flash === 'main' ? 9 : 6,
              background: a === 0 ? 'transparent' : a === 2 ? 'rgb(var(--warn))' : 'rgb(var(--accent))', border: a === 0 ? '1px solid rgb(var(--faint))' : 'none',
              opacity: !metro.playing ? 0.35 : metro.beat === i ? 1 : 0.3 }} />
          ))}
          <span className="text-[11px] font-black font-mono">{metro.bpm}</span>
          {metro.playing ? <Square size={9} fill="currentColor" /> : <Play size={9} fill="currentColor" />}
        </button>
      </div>

      {/* 스케일 연습 안내 */}
      {scale.active && (
        <div className="card px-4 py-2.5 flex items-center gap-3 shrink-0">
          {scale.done ? (
            <>
              <span className="text-sm font-black">완료! 평균 오차 <span className="text-accent">{scale.avgAbs.toFixed(0)}¢</span> · 맞음 {scale.okCount}/{scale.seq.length}</span>
              <button onClick={scale.start} className="ml-auto chip px-3 py-1 text-xs font-black text-accent">다시</button>
            </>
          ) : (
            <>
              <span className="text-[10px] font-black text-dim">다음 음</span>
              <span className="text-2xl font-black font-display text-accent">{pretty(spellInKey((((scale.seq[scale.idx] + 9) % 12) + 12) % 12, key) ?? CHROMATIC[(((scale.seq[scale.idx] + 9) % 12) + 12) % 12][0])}
                <span className="text-sm text-dim">{semitoneLabel(scale.seq[scale.idx]).replace(/\D+/, '')}</span></span>
              <div className="flex gap-1 ml-auto">
                {scale.seq.map((_, i) => {
                  const r = scale.results[i];
                  return <span key={i} className={`w-2.5 h-2.5 rounded-full ${r === undefined ? (i === scale.idx ? 'bg-accent animate-pulse' : 'bg-faint') : Math.abs(r) <= tolerance ? 'bg-good' : 'bg-sharp'}`} />;
                })}
              </div>
            </>
          )}
          <button onClick={scale.stop} aria-label="스케일 연습 끝" className="text-dim"><X size={16} /></button>
        </div>
      )}

      {/* 지판 */}
      <div className="flex-1 min-h-0 rounded-2xl border border-line bg-inset relative px-1.5 py-2 flex flex-col transition-shadow duration-75"
        style={{ boxShadow: flashCol ? `inset 0 0 0 ${downbeat ? 3 : 2}px ${flashCol}, 0 0 ${downbeat ? 24 : 14}px ${flashCol}` : 'none' }}>
        <div className="flex mb-1">
          {VIOLIN_STRINGS.map((s) => <div key={s.name} className="flex-1 flex justify-center"><span className="chip px-2 py-0.5 text-[10px] font-black text-warn">{s.note}</span></div>)}
        </div>
        <div className="flex-1 min-h-0 flex relative">
          {/* 줄 */}
          {VIOLIN_STRINGS.map((s, i) => <div key={s.name} className="absolute top-0 bottom-0 bg-faint rounded-full" style={{ left: `${12.5 + i * 25}%`, width: 4 - i * 0.8, marginLeft: -(4 - i * 0.8) / 2 }} />)}
          {VIOLIN_STRINGS.map((s) => (
            <div key={s.name} className="flex-1 flex flex-col relative z-10">
              {Array.from({ length: POSITIONS }, (_, pos) => {
                const semi = s.semitone + pos, label = semitoneLabel(semi);
                const pc = (((semi + 9) % 12) + 12) % 12;
                const spelled = spellInKey(pc, key);
                const isDet = detected?.semitone === semi;
                const isPlay = playing === label;
                const isTarget = scale.active && !scale.done && scale.seq[scale.idx] === semi;
                const st = per[label];
                const mean = st && st.n >= 3 ? st.sum / st.n : null;
                const name = pretty(spelled ?? CHROMATIC[pc][0]);
                let cls = 'bg-panel border-line text-ink';
                let style: React.CSSProperties = {};
                if (isPlay) cls = 'bg-warn/30 border-warn text-ink scale-125';
                else if (isDet) cls = `${Math.abs(detected!.cents) <= tolerance ? 'bg-good border-good' : 'bg-sharp border-sharp'} text-onaccent scale-125 z-20`;
                else if (isTarget) cls = 'bg-accent/20 border-accent text-accent scale-110 animate-pulse';
                else if (mean !== null) {
                  const k = Math.min(1, Math.abs(mean) / 25);
                  style = { background: `rgb(var(--${mean > 0 ? 'sharp' : 'flat'}) / ${0.15 + k * 0.6})`, borderColor: `rgb(var(--${mean > 0 ? 'sharp' : 'flat'}))` };
                }
                return (
                  <div key={pos} className={`flex-1 flex items-center justify-center relative ${pos === 12 ? 'border-t-2 border-accent/40' : pos === 5 || pos === 7 ? 'border-t border-line' : ''}`}>
                    {spelled || isDet || isPlay || isTarget ? (
                      <button onClick={() => tap(semi)}
                        className={`min-w-[30px] px-1.5 py-[1px] rounded-full border text-[11px] font-black font-display leading-tight transition-all duration-100 ${pos === 0 ? 'rounded-md' : ''} ${cls}`} style={style}>
                        {name}{mean !== null && !isDet && !isPlay && <span className="text-[8px] ml-0.5">{mean > 0 ? '▲' : '▼'}</span>}
                      </button>
                    ) : (
                      <button onClick={() => tap(semi)} className="w-2 h-2 rounded-full bg-faint" aria-label={label} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {heat && <p className="text-[10px] text-dim text-center shrink-0"><span className="text-sharp font-black">▲ 빨강</span> = 자주 높게 · <span className="text-flat font-black">▼ 파랑</span> = 자주 낮게 (최근 30일, 3번 이상 연주한 음)</p>}
    </div>
  );
}

// 스케일 연습: 다음 음을 안내하고, 그 음을 0.15초 이상 연주하면 센트를 기록하고 넘어감
function useScalePractice(key: string) {
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const seq = scaleSemitones(key);
  const st = useRef({ idx: 0, run: '', since: 0, last: 0 });
  const tolerance = useTuner((s) => s.tolerance);

  useEffect(() => {
    if (!active) return;
    const sink = (label: string, cents: number, now: number) => {
      const s = st.current;
      const target = semitoneLabel(seq[s.idx] ?? 999);
      if (label !== target) { s.run = ''; return; }
      if (s.run !== label || now - s.last > 150) { s.run = label; s.since = now; }
      s.last = now;
      if (now - s.since >= 150) {
        s.run = ''; s.idx++;
        setResults((r) => [...r, cents]); setIdx(s.idx);
        haptic(Math.abs(cents) <= tolerance ? 15 : [10, 30, 10]);
      }
    };
    noteSinks.add(sink);
    return () => { noteSinks.delete(sink); };
  }, [active, key]);

  const start = () => { st.current = { idx: 0, run: '', since: 0, last: 0 }; setIdx(0); setResults([]); setActive(true); haptic(10); };
  const stop = () => setActive(false);
  const done = active && idx >= seq.length;
  const okCount = results.filter((c) => Math.abs(c) <= tolerance).length;
  const avgAbs = results.length ? results.reduce((a, c) => a + Math.abs(c), 0) / results.length : 0;
  return { active, idx, results, seq, start, stop, done, okCount, avgAbs };
}
