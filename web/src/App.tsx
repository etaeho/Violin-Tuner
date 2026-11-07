import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useSettings } from '@/store/settings';
import { TabBar, TABS } from '@/ui/components/TabBar';
import { TuningScreen } from '@/features/tuning/TuningScreen';
import { PracticeScreen } from '@/features/practice/PracticeScreen';
import { FingerboardScreen } from '@/features/fingerboard/FingerboardScreen';
import { LogScreen } from '@/features/log/LogScreen';
import { SettingsSheet } from '@/features/SettingsSheet';
import { haptic } from '@/ui/haptic';
import { mic } from '@/audio/engine';
import { stopTone } from '@/audio/synth';
import { useTuner } from '@/store/tuner';
import { useLive } from '@/store/live';

const SCREENS = { tuning: TuningScreen, practice: PracticeScreen, fingerboard: FingerboardScreen, log: LogScreen };

export default function App() {
  const theme = useSettings((s) => s.theme);
  const tab = useSettings((s) => s.tab);
  const [showSettings, setShowSettings] = useState(false);

  // 테마 = <html data-theme> → themes.css 변수가 바뀜
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // 켜면 바로 듣기: 마이크 자동 시작, 앱을 내리면 정지, 첫 터치 때 오디오 재개
  useEffect(() => {
    const { minFreq, maxFreq } = useTuner.getState().sens;
    mic.setRange(minFreq, maxFreq);
    mic.start();
    const onVis = () => { if (document.visibilityState === 'hidden') { mic.stop(); stopTone(); useLive.getState().setPlaying(null); } else mic.start(); };
    const onTouch = () => mic.resume();
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('pointerdown', onTouch);
    return () => { document.removeEventListener('visibilitychange', onVis); document.removeEventListener('pointerdown', onTouch); mic.stop(); };
  }, []);

  const Screen = SCREENS[tab];
  const title = TABS.find((t) => t.id === tab)?.label;
  return (
    <div className="fixed inset-0 flex flex-col"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <header className="shrink-0 flex items-center justify-between px-4 h-14" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        <h1 className="text-lg font-black font-display tracking-wide">{title}</h1>
        <button onClick={() => { setShowSettings(true); haptic(8); }}
          className="chip flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold active:scale-95">
          <SlidersHorizontal size={13} className="text-accent" /> 설정
        </button>
      </header>
      <main key={tab} className="flex-1 min-h-0 px-4 pb-2 w-full max-w-md mx-auto">
        <Screen />
      </main>
      <TabBar />
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
    </div>
  );
}
