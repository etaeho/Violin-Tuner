// 설정 시트: 연주 명령 (음 패턴으로 박자 켜기/끄기)
import { useEffect, useState } from 'react';
import { PATTERN_MAX, PATTERN_MIN, DEFAULT_PATTERN } from '@/audio/commands';
import { mic } from '@/audio/engine';
import { useCommands, cmdTracker } from '@/store/commands';
import { Section } from '@/ui/components/Sheet';
import { Slider } from '@/ui/components/Slider';
import { haptic } from '@/ui/haptic';

const sh = (n: string) => n.replace('#', '♯');

export function CommandsSection() {
  const c = useCommands();
  const [view, setView] = useState<{ rec: { notes: string[]; left: number | null } | null; events: string[] }>({ rec: null, events: [] });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    cmdTracker.onRecorded = (p) => {
      if (p) { useCommands.getState().set({ pattern: p, enabled: true }); setMsg(`패턴 저장됨 (${p.length}음)`); haptic(30); }
      else { setMsg(`음이 ${PATTERN_MIN}개 이상 필요합니다. 다시 녹음해주세요.`); haptic(80); }
    };
    const iv = setInterval(() => {
      const r = cmdTracker.recording;
      setView({
        rec: r ? { notes: [...r.notes], left: r.start === null ? null : Math.max(0, r.windowMs - (performance.now() - r.start)) } : null,
        events: cmdTracker.events.slice(-6).map((e) => e.note),
      });
    }, 100);
    return () => { clearInterval(iv); cmdTracker.onRecorded = null; cmdTracker.cancelRecording(); };
  }, []);

  const notes = view.rec ? view.rec.notes : c.pattern;
  return (
    <Section title="④ 연주 명령 · 박자 켜기/끄기">
      <label className="flex items-center justify-between">
        <span className="flex flex-col"><span className="text-xs font-bold">음 패턴으로 박자 켜기/끄기</span><span className="text-[10px] text-dim">켜지면 연습 탭으로 이동</span></span>
        <input type="checkbox" checked={c.enabled} onChange={(e) => c.set({ enabled: e.target.checked })} className="w-5 h-5 accent-[rgb(var(--accent))]" />
      </label>
      <div className="flex items-center justify-center gap-1.5 flex-wrap min-h-[36px]">
        {view.rec && !notes.length
          ? <span className="text-xs font-bold text-warn animate-pulse">첫 음을 연주하면 녹음이 시작됩니다</span>
          : notes.map((n, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-dim text-xs">→</span>}
              <span className={`px-2 py-1 rounded-xl font-mono font-black text-sm border-2 ${view.rec ? 'border-warn text-warn' : c.enabled ? 'border-accent/60 text-accent' : 'border-line text-dim'}`}>{sh(n)}</span>
            </span>
          ))}
      </div>
      {view.rec && view.rec.left !== null && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 bg-inset rounded-full overflow-hidden"><div className="h-full bg-warn" style={{ width: `${(view.rec.left / c.windowMs) * 100}%` }} /></div>
          <span className="text-[11px] font-bold text-warn text-center">녹음 중… {(view.rec.left / 1000).toFixed(1)}초 · {view.rec.notes.length}/{PATTERN_MAX}음</span>
        </div>
      )}
      {!view.rec && msg && <span className="text-[11px] font-bold text-good text-center">{msg}</span>}
      <div className="flex gap-2">
        {view.rec
          ? <button onClick={() => cmdTracker.cancelRecording()} className="flex-1 chip py-2 text-xs font-bold">녹음 취소</button>
          : <button onClick={async () => { if (await mic.start()) { setMsg(null); cmdTracker.startRecording(c.windowMs); haptic(15); } }}
              className="flex-1 py-2 rounded-pill text-xs font-bold bg-warn/10 border border-warn/40 text-warn">● 패턴 녹음</button>}
        <button onClick={() => { c.set({ pattern: DEFAULT_PATTERN }); haptic(8); }} className="flex-1 chip py-2 text-xs font-bold">기본 (G3→E5→G3)</button>
      </div>
      <Slider label="제한 시간" value={c.windowMs} display={`${(c.windowMs / 1000).toFixed(1)}초`} min={1500} max={5000} step={500}
        onChange={(v) => c.set({ windowMs: v })} hint={`녹음: 첫 음부터 이 시간 동안 연주한 음(${PATTERN_MIN}~${PATTERN_MAX}개)이 패턴. 실행할 때도 이 시간 안에. 각 음은 0.15초 이상. 기준음·드론이 울리는 동안은 동작 안 함.`} />
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-dim">최근 인식:</span>
        {view.events.length ? view.events.map((n, i) => <span key={i} className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-chip">{sh(n)}</span>) : <span className="text-[10px] text-faint">—</span>}
      </div>
    </Section>
  );
}
