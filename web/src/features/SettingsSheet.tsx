import { useState } from 'react';
import { AudioWaveform, SlidersHorizontal } from 'lucide-react';
import { Sheet, Section } from '@/ui/components/Sheet';
import { Slider, Meter } from '@/ui/components/Slider';
import { THEMES, useSettings, type ThemeId } from '@/store/settings';
import { useTuner } from '@/store/tuner';
import { useLive, calibrateNoise } from '@/store/live';
import { haptic } from '@/ui/haptic';
import { CommandsSection } from './CommandsSection';

// 테마 미리보기: 각 테마 토큰으로 직접 칠함
const PREVIEW: Record<ThemeId, { bg: string; card: string; ink: string; accent: string }> = {
  tape: { bg: '#000', card: '#111', ink: '#e5e7eb', accent: '#4afc9d' },
  vintage: { bg: 'linear-gradient(180deg,#6e4220,#3a200d)', card: '#1a0f07', ink: '#f4e3b5', accent: '#f6dd94' },
  light: { bg: '#f4f3ee', card: '#fff', ink: '#18181b', accent: '#059669' },
};

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const { sens, setSens, resetSens } = useTuner();
  const level = useLive((s) => s.level);
  const micState = useLive((s) => s.micState);
  const [calib, setCalib] = useState<null | 'running' | { noise: number; gate: number }>(null);

  const runCalib = async () => {
    setCalib('running'); haptic(10);
    const r = await calibrateNoise(3000);
    setCalib(r); haptic(30);
  };
  const db = Math.max(-80, level.db);

  return (
    <Sheet title="설정" icon={<SlidersHorizontal size={16} className="text-accent" />} onClose={onClose}>
      <Section title="테마">
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const p = PREVIEW[t.id], on = theme === t.id;
            return (
              <button key={t.id} onClick={() => { setTheme(t.id); haptic(10); }}
                className={`rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${on ? 'border-accent' : 'border-line'}`}>
                <div className="h-16 p-2 flex flex-col justify-end gap-1" style={{ background: p.bg }}>
                  <div className="h-6 rounded-md flex items-center justify-center gap-1" style={{ background: p.card }}>
                    {[0, 1, 2, 3].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === 2 ? p.accent : p.ink, opacity: i === 2 ? 1 : 0.3 }} />)}
                  </div>
                </div>
                <div className={`py-1.5 ${on ? 'bg-accent/10' : 'bg-chip'}`}>
                  <div className={`text-xs font-black ${on ? 'text-accent' : 'text-ink'}`}>{t.name}</div>
                  <div className="text-[9px] text-dim">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="① 입력 테스트 · 소음 차단">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] font-bold text-dim">
            <span>입력 레벨 {micState !== 'live' && '(마이크 꺼짐)'}</span><span className="font-mono text-ink">{db.toFixed(0)} dB</span>
          </div>
          <Meter value={db} min={-80} max={0} marker={sens.gateDb} active={level.gate} />
          <div className="flex gap-1.5 mt-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-pill ${level.gate ? 'bg-good/15 text-good' : 'bg-chip text-dim'}`}>게이트 {level.gate ? '열림' : '닫힘'}</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-pill ${level.accepted ? 'bg-good/15 text-good' : 'bg-chip text-dim'}`}>
              {level.accepted ? `감지 ✓ ${level.raw.toFixed(1)}Hz` : '감지 안 함'}
            </span>
          </div>
        </div>
        <button onClick={runCalib} disabled={calib === 'running'}
          className="chip flex items-center justify-center gap-2 py-3 text-sm font-bold active:scale-95 disabled:opacity-60">
          <AudioWaveform size={15} className="text-accent" />
          {calib === 'running' ? '조용히 해주세요… (3초)' : '주변 소음 자동 측정 (3초)'}
        </button>
        {calib && calib !== 'running' && <span className="text-[11px] text-good text-center font-bold">소음 {calib.noise} dB → 임계값 {calib.gate} dB</span>}
        <Slider label="소음 차단 임계값" value={sens.gateDb} display={`${sens.gateDb} dB`} min={-80} max={-10} step={1}
          onChange={(v) => setSens({ gateDb: v })} hint="흰 선보다 큰 소리만 분석. 잡음에 반응하면 오른쪽으로, 약한 소리를 못 잡으면 왼쪽으로." />
      </Section>

      <Section title="② 음정 신뢰도">
        <Meter value={level.clarity} min={0.5} max={1} marker={sens.clarity} active={level.gate && level.clarity >= sens.clarity} />
        <Slider label="최소 신뢰도" value={sens.clarity} display={sens.clarity.toFixed(2)} min={0.7} max={0.98} step={0.01}
          onChange={(v) => setSens({ clarity: v })} hint="잡음·말소리는 낮고 현 소리는 0.9 이상. 높일수록 잡음에 강함." />
      </Section>

      <Section title="③ 안정화 · 범위">
        <Slider label="확정 횟수" value={sens.stableFrames} display={`${sens.stableFrames}회 · ${Math.round(sens.stableFrames * 21)}ms`} min={1} max={8} step={1}
          onChange={(v) => setSens({ stableFrames: v })} hint="같은 음이 이만큼 연속돼야 표시 (순간 잡음 차단)" />
        <Slider label="평균" value={sens.smoothing} min={1} max={12} step={1} onChange={(v) => setSens({ smoothing: v })} hint="클수록 부드럽고 느리게" />
        <Slider label="표시 유지" value={sens.holdMs} display={`${sens.holdMs}ms`} min={0} max={1500} step={50} onChange={(v) => setSens({ holdMs: v })} />
        <Slider label="최저 주파수" value={sens.minFreq} display={`${sens.minFreq} Hz`} min={60} max={300} step={5}
          onChange={(v) => setSens({ minFreq: v })} hint="바이올린 최저음 G3 = 196Hz" />
        <button onClick={() => { resetSens(); setCalib(null); haptic(10); }} className="chip py-2 text-xs font-bold text-dim">감도 기본값으로</button>
      </Section>

      <CommandsSection />

      <Section title="정보">
        <p className="text-xs text-dim leading-relaxed">
          Violin Tuner <b className="text-ink">v2 개발 버전</b> — 기존 앱(v1)과 따로 설치됩니다. 음정 분석은 오디오 전용 스레드에서 실행됩니다.
        </p>
      </Section>
    </Sheet>
  );
}
