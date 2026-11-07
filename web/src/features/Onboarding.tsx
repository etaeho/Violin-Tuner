// 첫 실행 안내 (30초): 마이크 허용 → 주변 소음 측정 → 테마
import { useState } from 'react';
import { AudioWaveform, Check, Mic } from 'lucide-react';
import { mic } from '@/audio/engine';
import { calibrateNoise, useLive } from '@/store/live';
import { THEMES, useSettings } from '@/store/settings';
import { haptic } from '@/ui/haptic';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const micState = useLive((s) => s.micState);
  const level = useLive((s) => s.level);
  const { theme, setTheme, finishOnboarding } = useSettings();
  const [calib, setCalib] = useState<null | 'running' | { noise: number; gate: number }>(null);

  const askMic = async () => { haptic(10); if (await mic.start()) setStep(1); };
  const runCalib = async () => { setCalib('running'); const r = await calibrateNoise(3000); setCalib(r); haptic(30); };

  return (
    <div className="absolute inset-0 z-[80] bg-app flex flex-col px-6 tab-in"
      style={{ backgroundImage: 'var(--app-image)', paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex gap-1.5 justify-center mb-8">
        {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-accent' : i < step ? 'w-4 bg-accent/50' : 'w-4 bg-faint'}`} />)}
      </div>

      {step === 0 && (
        <Page icon={<span className="text-5xl">🎻</span>} title="바이올린 연습 파트너"
          text={'켜면 바로 듣고 음정을 보여줍니다.\n튜닝 · 박자 · 드론 · 기록을 한 앱에서.\n\n먼저 마이크를 허용해주세요. 소리는 폰 안에서만 분석되고 저장되지 않습니다.'}>
          <button onClick={askMic} disabled={micState === 'starting'} className="w-full h-14 rounded-2xl bg-accent text-onaccent font-black flex items-center justify-center gap-2 active:scale-[0.98]">
            <Mic size={18} />{micState === 'starting' ? '허용 기다리는 중…' : '마이크 허용'}
          </button>
          {(micState === 'denied' || micState === 'error') && <p className="text-xs text-sharp text-center mt-3">마이크를 쓸 수 없습니다. 설정 &gt; 앱 &gt; Violin v2 &gt; 권한에서 허용한 뒤 다시 눌러주세요.</p>}
          <button onClick={() => setStep(1)} className="w-full mt-3 text-xs text-dim">나중에</button>
        </Page>
      )}

      {step === 1 && (
        <Page icon={<AudioWaveform size={48} className="text-accent" />} title="주변 소음 맞추기"
          text={'3초 동안 조용히 있어주세요.\n주변 소음보다 큰 소리만 분석하도록 맞춰서, 잡음에 튀지 않게 합니다.'}>
          <div className="w-full h-3 bg-inset rounded-full overflow-hidden border border-line mb-4">
            <div className={`h-full transition-[width] duration-75 ${level.gate ? 'bg-good' : 'bg-faint'}`} style={{ width: `${Math.max(0, Math.min(100, (level.db + 80) / 0.8))}%` }} />
          </div>
          {calib && calib !== 'running'
            ? <p className="text-sm text-good font-bold text-center mb-4 flex items-center justify-center gap-1.5"><Check size={16} />소음 {calib.noise} dB → 기준 {calib.gate} dB</p>
            : null}
          {calib && calib !== 'running'
            ? <button onClick={() => setStep(2)} className="w-full h-14 rounded-2xl bg-accent text-onaccent font-black">다음</button>
            : <button onClick={runCalib} disabled={calib === 'running' || micState !== 'live'} className="w-full h-14 rounded-2xl bg-accent text-onaccent font-black disabled:opacity-50">
                {calib === 'running' ? '조용히… 측정 중' : micState !== 'live' ? '마이크가 꺼져 있습니다' : '측정 시작 (3초)'}
              </button>}
          <button onClick={() => setStep(2)} className="w-full mt-3 text-xs text-dim">건너뛰기 (나중에 설정에서 가능)</button>
        </Page>
      )}

      {step === 2 && (
        <Page icon={<span className="text-5xl">🎨</span>} title="화면 테마" text="나중에 설정에서 바꿀 수 있습니다.">
          <div className="grid grid-cols-3 gap-2 w-full mb-6">
            {THEMES.map((t) => (
              <button key={t.id} onClick={() => { setTheme(t.id); haptic(10); }}
                className={`rounded-xl py-3 border-2 flex flex-col items-center gap-0.5 ${theme === t.id ? 'border-accent bg-accent/10' : 'border-line bg-chip'}`}>
                <span className={`text-sm font-black ${theme === t.id ? 'text-accent' : ''}`}>{t.name}</span>
                <span className="text-[9px] text-dim">{t.desc}</span>
              </button>
            ))}
          </div>
          <button onClick={() => { finishOnboarding(); mic.start(); haptic(20); }} className="w-full h-14 rounded-2xl bg-accent text-onaccent font-black">시작하기</button>
        </Page>
      )}
    </div>
  );
}

function Page({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        {icon}
        <h2 className="text-2xl font-black font-display">{title}</h2>
        <p className="text-sm text-dim leading-relaxed whitespace-pre-line">{text}</p>
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}
