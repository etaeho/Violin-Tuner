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
import { useMetro } from '@/store/metro';
import { useDrone } from '@/store/drone';
import { useCommands, cmdTracker } from '@/store/commands';
import { useUi } from '@/store/ui';

const SCREENS = { tuning: TuningScreen, practice: PracticeScreen, fingerboard: FingerboardScreen, log: LogScreen };

export default function App() {
  const theme = useSettings((s) => s.theme);
  const tab = useSettings((s) => s.tab);
  const [showSettings, setShowSettings] = useState(false);
  const toast = useUi((s) => s.toast);

  // 테마 = <html data-theme> → themes.css 변수가 바뀜
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // 켜면 바로 듣기: 마이크 자동 시작, 앱을 내리면 정지, 첫 터치 때 오디오 재개
  useEffect(() => {
    const { minFreq, maxFreq } = useTuner.getState().sens;
    mic.setRange(minFreq, maxFreq);
    mic.start();
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        mic.stop(); stopTone(); useLive.getState().setPlaying(null); useMetro.getState().stop(); useDrone.getState().stop();
      } else mic.start();
    };
    // 연주 명령 → 박자 켜기/끄기 (켤 때는 연습 탭으로)
    cmdTracker.onCommand = () => {
      const m = useMetro.getState(); const starting = !m.playing;
      m.toggle();
      if (starting) useSettings.getState().setTab('practice');
      haptic([30, 40, 30]);
      useUi.getState().show(`🎻 ${useCommands.getState().pattern.join(' → ').replace(/#/g, '♯')} · 박자 ${starting ? '시작' : '정지'}`);
    };
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
      {toast && (
        <div className="absolute inset-x-0 top-16 z-[60] flex justify-center pointer-events-none">
          <div className="card px-4 py-2.5 text-sm font-bold shadow-xl tab-in">{toast}</div>
        </div>
      )}
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
    </div>
  );
}
