import { Mic, MicOff, Minus, Plus, Volume2, VolumeX } from 'lucide-react';
import { useEffect } from 'react';
import { freqToNote } from '@/audio/detector';
import { VIOLIN_STRINGS, nearestString, stringFreq, stringTarget } from '@/audio/strings';
import { mic } from '@/audio/engine';
import { playTone, retuneTone, stopTone } from '@/audio/synth';
import { useTuner } from '@/store/tuner';
import { useLive } from '@/store/live';
import { useVintage, BrassPlate, DrumDigits } from '@/ui/components/Brass';
import { haptic } from '@/ui/haptic';
import { VTape } from './VTape';
import { Ripple } from './Ripple';

const TOLERANCES = [4, 6, 8, 10, 12, 15, 20];

export function TuningScreen() {
  const { a4, tolerance, mode, setA4, setTolerance, setMode } = useTuner();
  const { freq, micState, micMsg, playing, setPlaying } = useLive();
  const vintage = useVintage();

  const live = freq !== null;
  const semi = live ? 12 * Math.log2(freq! / a4) : 0;
  const near = live ? nearestString(semi, mode) : null;
  const note = live ? freqToNote(freq!, a4) : null;

  // 기준음 재생 중 A4/조율방식이 바뀌면 음 높이도 따라감
  useEffect(() => {
    const s = VIOLIN_STRINGS.find((x) => x.name === playing);
    if (s) retuneTone(stringFreq(s, mode, a4));
  }, [a4, mode, playing]);
  useEffect(() => () => stopTone(), []);

  const toggleTone = (name: string) => {
    haptic(15);
    if (playing === name) { stopTone(); setPlaying(null); return; }
    const s = VIOLIN_STRINGS.find((x) => x.name === name)!;
    playTone(stringFreq(s, mode, a4)); setPlaying(name);
  };

  const stateColor = (c: number, perfect: boolean) =>
    perfect ? 'rgb(var(--good))' : Math.abs(c) <= tolerance + 15 ? 'rgb(var(--warn))' : c > 0 ? 'rgb(var(--sharp))' : 'rgb(var(--flat))';

  return (
    <div className="h-full flex flex-col gap-2.5 tab-in">
      {/* 조절: A4 · 범위 · 조율 방식 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="chip flex items-center">
          <button onClick={() => { setA4(a4 - 1); haptic(8); }} className="pl-2.5 pr-1 py-1.5 text-dim" aria-label="A4 내리기"><Minus size={13} /></button>
          <span className="text-xs font-bold text-dim">A4</span>
          <span className="text-sm font-black font-mono w-8 text-center">{a4}</span>
          <button onClick={() => { setA4(a4 + 1); haptic(8); }} className="pr-2.5 pl-1 py-1.5 text-dim" aria-label="A4 올리기"><Plus size={13} /></button>
        </div>
        <button onClick={() => { setTolerance(TOLERANCES[(TOLERANCES.indexOf(tolerance) + 1) % TOLERANCES.length] ?? 10); haptic(8); }}
          className="chip flex items-center gap-1.5 px-3 py-1.5 active:scale-95">
          <span className="w-2 h-2 rounded-full bg-good" />
          <span className="text-xs font-bold text-dim">범위</span>
          <span className="text-sm font-black font-mono">±{tolerance}</span>
        </button>
        <div className="ml-auto flex chip p-0.5">
          {(['equal', 'pure'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); haptic(8); }}
              className={`px-2.5 py-1 rounded-pill text-[11px] font-black transition-colors ${mode === m ? 'bg-accent text-onaccent' : 'text-dim'}`}>
              {m === 'equal' ? '평균율' : '순정 5도'}
            </button>
          ))}
        </div>
      </div>

      {/* 현별 세로 테이프 */}
      <div className="flex-1 min-h-0 flex gap-2.5 px-1">
        {VIOLIN_STRINGS.map((s) => {
          const active = !!near && near.string.name === s.name;
          const isPlaying = playing === s.name;
          const c = active ? near!.cents : 0;
          const perfect = active && Math.abs(c) <= tolerance;
          const color = stateColor(c, perfect);
          // 목표(순정이면 몇 센트 이동)가 바늘에 오도록 테이프 위치를 맞춤
          const center = active ? semi - (stringTarget(s, mode) - s.semitone) : s.semitone;
          const pureMark = mode === 'pure' && s.pureCents !== 0 ? `${s.pureCents > 0 ? '+' : ''}${s.pureCents.toFixed(0)}¢` : '';
          return (
            <div key={s.name} className={`flex-1 flex flex-col items-center gap-1.5 min-h-0 transition-opacity ${active || isPlaying || !live ? '' : 'opacity-55'}`}>
              <span className="h-4 text-[11px] font-black font-mono leading-4" style={{ color: active ? color : 'rgb(var(--dim))' }}>
                {active ? (perfect ? 'OK' : `${c > 0 ? '+' : ''}${c}¢`) : pureMark}
              </span>
              <VTape center={center} active={active} perfect={perfect} tolerance={tolerance} />
              <button onClick={() => toggleTone(s.name)} aria-label={`${s.name} 기준음`}
                className="relative p-1 shrink-0 rounded-full active:scale-95 transition-transform">
                <Ripple cents={c} active={active} perfect={perfect} color={color} />
                <div className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center text-base font-black font-display transition-all duration-200 ${
                  isPlaying ? 'bg-warn/30 border-warn text-ink'
                  : perfect ? 'bg-good border-good text-onaccent scale-110'
                  : active ? 'bg-chip border-ink text-ink'
                  : 'bg-chip border-line text-dim'}`}>
                  {s.note}<span className="text-[8px] absolute top-2.5 right-2.5 opacity-60">{s.octave}</span>
                </div>
                <span className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border flex items-center justify-center ${isPlaying ? 'bg-warn border-warn text-black' : 'bg-chip border-line text-dim'}`}>
                  {isPlaying ? <VolumeX size={10} /> : <Volume2 size={10} />}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 숫자 표시 */}
      <Readout live={live} hz={freq} cents={note?.cents ?? 0} label={note?.label} tolerance={tolerance} micState={micState} vintage={vintage} />

      {/* 마이크가 꺼져 있을 때 */}
      {(micState === 'denied' || micState === 'error') && (
        <div className="card p-4 flex items-start gap-3 shrink-0">
          <MicOff className="text-sharp shrink-0 mt-0.5" size={20} />
          <div className="flex-1 text-xs leading-relaxed">
            <b className="text-ink">{micState === 'denied' ? '마이크 권한이 꺼져 있습니다' : '마이크를 열 수 없습니다'}</b>
            <p className="text-dim">{micState === 'denied' ? '설정 > 앱 > Violin v2 > 권한에서 마이크를 허용해주세요.' : micMsg}</p>
          </div>
          <button onClick={() => mic.start()} className="chip px-3 py-1.5 text-xs font-black text-accent shrink-0">다시 시도</button>
        </div>
      )}
    </div>
  );
}

function Readout({ live, hz, cents, label, tolerance, micState, vintage }: {
  live: boolean; hz: number | null; cents: number; label?: string; tolerance: number; micState: string; vintage: boolean;
}) {
  const ok = live && Math.abs(cents) <= tolerance;
  const col = !live ? 'rgb(var(--faint))' : ok ? 'rgb(var(--good))' : cents > 0 ? 'rgb(var(--sharp))' : 'rgb(var(--flat))';
  const body = (
    <div className="flex items-center justify-center gap-3">
      <span className="flex items-center gap-1 text-[9px] font-black tracking-widest"
        style={{ color: micState === 'live' ? (vintage ? '#1f7a2e' : 'rgb(var(--good))') : 'rgb(var(--sharp))' }}>
        {micState === 'live' ? <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> : <Mic size={10} />}
        {micState === 'live' ? 'LIVE' : micState === 'starting' ? '...' : 'OFF'}
      </span>
      <span className="w-9 text-center text-sm font-black font-display" style={{ color: vintage ? '#3b2a1a' : 'rgb(var(--ink))' }}>{label ?? '—'}</span>
      <DrumDigits text={(hz ?? 0).toFixed(1).padStart(6, '0')} unit="Hz" />
      <span className="text-xl font-black font-mono min-w-[52px]" style={{ color: vintage && ok ? '#1f7a2e' : col }}>
        {live ? (cents > 0 ? `+${cents}` : cents) : 0}<span className="text-[10px]">¢</span>
      </span>
    </div>
  );
  return vintage ? <BrassPlate className="shrink-0 !py-2">{body}</BrassPlate> : <div className="inset py-2 shrink-0">{body}</div>;
}
